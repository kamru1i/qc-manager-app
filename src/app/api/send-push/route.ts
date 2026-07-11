import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders, CooldownLimiter } from '@/utils/apiHelpers';

// Initialize web-push
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('VAPID public or private key is missing in environmental variables. Web Push will fail.');
} else {
  webpush.setVapidDetails(
    'mailto:admin@office.local',
    vapidPublicKey,
    vapidPrivateKey
  );
}

// Bounded cooldown limiter: 5 seconds per user (regular users only)
const cooldownLimiter = new CooldownLimiter(5000);

interface PushSubscriptionRow {
  sub_id: string;
  sub_user_id: string;
  sub_endpoint: string;
  sub_p256dh: string;
  sub_auth: string;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[SendPush] Missing Supabase environment variables.');
      return NextResponse.json(
        { error: 'Server configuration error: missing database credentials' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate the requester using their Supabase JWT
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.error('[SendPush] Missing Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized: Missing Authorization header' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create a Supabase client with the user's JWT for auth verification only
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    let user = null;
    let authError = null;

    try {
      const { data: { user: u }, error: err } = await supabaseWithAuth.auth.getUser();
      user = u;
      authError = err;
    } catch (e) {
      console.error('[SendPush] auth.getUser() error:', e);
    }

    if (authError || !user) {
      try {
        const { data: { user: u }, error: err } = await supabaseWithAuth.auth.getUser(token);
        if (u && !err) {
          user = u;
          authError = null;
        } else {
          authError = err || authError;
        }
      } catch (e) {
        console.error('[SendPush] auth.getUser(token) error:', e);
      }
    }

    if (authError || !user) {
      console.error('[SendPush] Auth verification failed:', authError?.message || 'No user session', 'Token parts count:', token ? token.split('.').length : 0);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    // Fetch sender's role to check if admin/supervisor
    const { data: senderProfile } = await supabaseWithAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isRateLimitedRole = !senderProfile || senderProfile.role === 'user';

    // Rate limiting check (Only for regular users to prevent spam)
    if (isRateLimitedRole) {
      if (cooldownLimiter.isLimited(user.id)) {
        console.warn(`[SendPush] Rate limit hit for user ${user.id}`);
        return NextResponse.json(
          { error: 'Too Many Requests: Please wait 5 seconds between notification requests.' },
          { status: 429, headers: getCorsHeaders(request) }
        );
      }
    }

    console.log(`[SendPush] Authenticated user: ${user.email} (ID: ${user.id})`);

    // 2. Parse request body
    const { userIds, title, body, url, tag } = await request.json();
    console.log('[SendPush] Request body userIds:', userIds);

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid userIds array' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Bad Request: Missing title or body' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // 3. Resolve special keywords like 'admins' or 'supervisors' using clean server client
    let targetUserIds: string[] = userIds.filter((id: string) => id !== 'admins' && id !== 'supervisors');

    const needsAdmins = userIds.includes('admins');
    const needsSupervisors = userIds.includes('supervisors');

    if (needsAdmins || needsSupervisors) {
      const rolesToFetch: string[] = [];
      if (needsAdmins) rolesToFetch.push('admin');
      if (needsSupervisors) rolesToFetch.push('supervisor');

      console.log(`[SendPush] Resolving roles: ${rolesToFetch.join(', ')}`);
      
      // Use clean server client to execute RPC to bypass RLS completely
      const { data: roleUsers, error: roleError } = await supabaseServer
        .rpc('get_user_ids_by_roles', { p_roles: rolesToFetch });

      if (roleError) {
        console.error('[SendPush] Error resolving role-based user IDs:', roleError);
      } else if (roleUsers && roleUsers.length > 0) {
        const ids = roleUsers.map((r: { user_id: string }) => r.user_id);
        console.log(`[SendPush] Resolved user IDs for roles:`, ids);
        targetUserIds = Array.from(new Set([...targetUserIds, ...ids]));
      } else {
        console.log(`[SendPush] No users found with roles:`, rolesToFetch);
      }
    }

    console.log('[SendPush] Final target user IDs:', targetUserIds);

    // If target list resolved to empty, return early
    if (targetUserIds.length === 0) {
      console.log('[SendPush] Resolved target list is empty. Aborting.');
      return NextResponse.json(
        { success: true, sentCount: 0, message: 'Resolved targets are empty' },
        { headers: getCorsHeaders(request) }
      );
    }

    // 4. Fetch active subscriptions using clean server client
    console.log('[SendPush] Fetching subscriptions for target user IDs...');
    const { data: subscriptions, error: dbError } = await supabaseServer
      .rpc('get_push_subscriptions_for_users', { p_user_ids: targetUserIds });

    if (dbError) {
      console.error('[SendPush] Error fetching push subscriptions:', dbError);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    console.log(`[SendPush] Found ${subscriptions?.length || 0} subscriptions in database.`);

    // BROADCAST TO ACTIVE DESKTOP CLIENTS (TAURI)
    // Even if they don't have a web push subscription, active desktop users will receive this broadcast.
    // Send to a per-user channel (`desktop-notifications-<userId>`) instead of one shared channel so
    // only the targeted recipient's client receives the message — this avoids fanning every broadcast
    // out to every connected desktop client (major realtime egress saver).
    try {
      const broadcastResults = await Promise.all(
        targetUserIds.map(async (uid) => {
          const response = await fetch(`${supabaseUrl}/realtime/v1/broadcast`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              channel: `desktop-notifications-${uid}`,
              event: 'os-push',
              payload: {
                targetUserIds: [uid],
                title,
                body
              }
            }),
          });
          return response.ok;
        })
      );
      const okCount = broadcastResults.filter(Boolean).length;
      console.log(`[SendPush] Broadcasted notification to ${okCount}/${targetUserIds.length} desktop client channels via REST API.`);
    } catch (broadcastErr) {
      console.warn('[SendPush] Failed to broadcast to desktop clients:', broadcastErr);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[SendPush] No subscriptions found. Aborting web push.');
      return NextResponse.json(
        { success: true, sentCount: 0, message: 'Broadcasted to desktop clients. No active web push subscriptions found.' },
        { headers: getCorsHeaders(request) }
      );
    }

    // 5. Send notifications
    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      tag: tag || 'chuti-alert',
    });

    const typedSubscriptions = (subscriptions || []) as PushSubscriptionRow[];

    const sendPromises = typedSubscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.sub_endpoint,
        keys: {
          p256dh: sub.sub_p256dh,
          auth: sub.sub_auth,
        },
      };

      try {
        console.log(`[SendPush] Sending notification to sub ${sub.sub_id} (user: ${sub.sub_user_id})`);
        await webpush.sendNotification(pushSubscription, payload);
        console.log(`[SendPush] Sent successfully to sub ${sub.sub_id}`);
        return { id: sub.sub_id, success: true };
      } catch (err) {
        const errorObject = err as { message?: string; statusCode?: number } | null | undefined;
        console.warn(`[SendPush] Failed to send push notification to sub ${sub.sub_id}:`, errorObject?.message || String(err));
        
        // Purge subscription if it's expired or gone (404 / 410)
        if (errorObject?.statusCode === 410 || errorObject?.statusCode === 404) {
          console.log(`[SendPush] Purging inactive subscription ${sub.sub_id}`);
          await supabaseServer.rpc('delete_push_subscription', { p_sub_id: sub.sub_id });
        }
        
        return { id: sub.sub_id, success: false, statusCode: errorObject?.statusCode };
      }
    });

    const results = await Promise.all(sendPromises);
    const successfulSends = results.filter(r => r.success).length;

    console.log(`[SendPush] Sending completed. Success: ${successfulSends}/${subscriptions.length}`);

    return NextResponse.json({
      success: true,
      sentCount: successfulSends,
      totalCount: subscriptions.length,
    }, { headers: getCorsHeaders(request) });

  } catch (err) {
    console.error('[SendPush] Unexpected error in send-push API route:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
