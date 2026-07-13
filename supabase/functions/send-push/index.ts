import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push"

const ALLOWED_ORIGINS = [
  'tauri://localhost',
  'https://tauri.localhost',
  'http://tauri.localhost',
  'http://localhost:3000',
  'http://localhost:1420',
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing VAPID public/private key settings in env variables" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    webpush.setVapidDetails(
      'mailto:admin@office.local',
      vapidPublicKey,
      vapidPrivateKey
    )

    // 1. Authenticate requester using their auth token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user access' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    // 2. Parse payload request body
    const { userIds, title, body, url, tag } = await req.json()

    if (!userIds || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing userIds, title, or body parameter' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

    // Resolve targetUserIds (handle special keywords)
    let targetUserIds = userIds.filter((id: string) => id !== 'admins' && id !== 'supervisors')
    const needsAdmins = userIds.includes('admins')
    const needsSupervisors = userIds.includes('supervisors')

    if (needsAdmins || needsSupervisors) {
      const rolesToFetch = []
      if (needsAdmins) rolesToFetch.push('admin')
      if (needsSupervisors) rolesToFetch.push('supervisor')

      const { data: roleUsers, error: roleError } = await supabaseServer
        .rpc('get_user_ids_by_roles', { p_roles: rolesToFetch })

      if (!roleError && roleUsers) {
        const ids = roleUsers.map((r: any) => r.user_id)
        targetUserIds = Array.from(new Set([...targetUserIds, ...ids]))
      }
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sentCount: 0, message: 'Resolved targets are empty' }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    // Broadcast to active desktop clients (Tauri)
    try {
      await fetch(`${supabaseUrl}/realtime/v1/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          channel: 'desktop-notifications',
          event: 'os-push',
          payload: { targetUserIds, title, body }
        }),
      })
    } catch (err) {
      console.warn('Realtime broadcast to desktop clients failed:', err)
    }

    // Fetch active web push subscriptions
    const { data: subscriptions, error: dbError } = await supabaseServer
      .rpc('get_push_subscriptions_for_users', { p_user_ids: targetUserIds })

    if (dbError) {
      throw dbError
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, sentCount: 0, message: 'Broadcasted to desktop. No active web push subscriptions found.' }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      tag: tag || 'chuti-alert',
    })

    // 3. Send Web Push notifications
    let successfulSends = 0
    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.sub_endpoint,
        keys: {
          p256dh: sub.sub_p256dh,
          auth: sub.sub_auth,
        },
      }

      try {
        await webpush.sendNotification(pushSubscription, payload)
        successfulSends++
      } catch (err: any) {
        console.warn(`Failed to send webpush to subscription ID ${sub.sub_id}:`, err.message)
        // Inactive / Expired subscription cleanup (404/410)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseServer.rpc('delete_push_subscription', { p_sub_id: sub.sub_id })
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sentCount: successfulSends,
      totalCount: subscriptions.length,
    }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})
