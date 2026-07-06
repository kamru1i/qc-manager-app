import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize web-push
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@office.local',
    vapidPublicKey,
    vapidPrivateKey
  );
}

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
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
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[ForgotPassword] Missing Supabase environment variables.');
      return NextResponse.json(
        { error: 'Server configuration error: missing credentials' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json().catch(() => ({}));
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username (codename) is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const cleanUsername = username.trim().toUpperCase();
    if (!cleanUsername) {
      return NextResponse.json(
        { error: 'Username (codename) is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // 1. Resolve username to profile
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, username, full_name, global_settings')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (profileError) {
      console.error('[ForgotPassword] Error searching profile:', profileError.message);
      return NextResponse.json(
        { error: 'Server error processing request' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Username (codename) not found' },
        { status: 404, headers: getCorsHeaders(request) }
      );
    }

    const currentSettings = (profile as any).global_settings || {};
    const updatedSettings = {
      ...currentSettings,
      password_reset_status: 'pending'
    };

    // 2. Update profile password_reset_status to 'pending' inside global_settings
    const { error: updateError } = await supabaseServer
      .from('profiles')
      .update({ global_settings: updatedSettings })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[ForgotPassword] Error updating profile status:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to request password reset' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    // 3. Find admins to notify
    const { data: admins, error: adminsError } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (adminsError) {
      console.error('[ForgotPassword] Error getting admins:', adminsError.message);
    }

    const adminIds = admins?.map(a => a.id) || [];
    const displayName = profile.full_name || profile.username;
    const title = 'Password Reset Request';
    const notificationBody = `${displayName} has requested a password reset.`;

    if (adminIds.length > 0) {
      // 4. Send Web Push notifications to admins if key details are configured
      if (vapidPublicKey && vapidPrivateKey) {
        try {
          const { data: subscriptions } = await supabaseServer
            .rpc('get_push_subscriptions_for_users', { p_user_ids: adminIds });

          if (subscriptions && subscriptions.length > 0) {
            const payload = JSON.stringify({
              title,
              body: notificationBody,
              url: '/',
              tag: 'password-reset-request',
            });

            const sendPromises = subscriptions.map(async (sub: any) => {
              const pushSubscription = {
                endpoint: sub.sub_endpoint,
                keys: {
                  p256dh: sub.sub_p256dh,
                  auth: sub.sub_auth,
                },
              };
              try {
                await webpush.sendNotification(pushSubscription, payload);
              } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await supabaseServer.rpc('delete_push_subscription', { p_sub_id: sub.sub_id });
                }
              }
            });
            await Promise.all(sendPromises);
          }
        } catch (pushErr) {
          console.warn('[ForgotPassword] Failed to send push notifications:', pushErr);
        }
      }

      // 5. Broadcast to active desktop clients (Tauri)
      try {
        const channel = supabaseServer.channel('desktop-notifications');
        await channel.send({
          type: 'broadcast',
          event: 'os-push',
          payload: {
            targetUserIds: adminIds,
            title,
            body: notificationBody,
          }
        });
      } catch (broadcastErr) {
        console.warn('[ForgotPassword] Failed to broadcast to desktop clients:', broadcastErr);
      }
    }

    return NextResponse.json({ success: true }, { headers: getCorsHeaders(request) });
  } catch (err) {
    console.error('[ForgotPassword] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
