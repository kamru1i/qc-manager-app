import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders, RateLimiter } from '@/utils/apiHelpers';

// Rate limiter: 5 requests per minute per IP (unauthenticated endpoint)
const rateLimiter = new RateLimiter(60000, 5);

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

    // Rate limiting (unauthenticated endpoint — must be protected)
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (rateLimiter.isLimited(ip)) {
      console.warn(`[ForgotPassword] Rate limit hit for IP: ${ip}`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429, headers: getCorsHeaders(request) }
      );
    }

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
        { error: 'Database unavailable' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    if (!profile) {
      // Security best practice: return success response regardless to prevent username enumeration
      return NextResponse.json({ success: true }, { headers: getCorsHeaders(request) });
    }

    const currentSettings = (profile as any).global_settings || {};
    if (currentSettings.password_reset_status === 'pending') {
      // Security: return success response if request is already pending to prevent status enumeration
      return NextResponse.json({ success: true }, { headers: getCorsHeaders(request) });
    }

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
        { error: 'Database unavailable' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    // 3. Find admins to notify (fire-and-forget — don't block the response).
    // Previously this ran synchronously before the response, causing
    // desktop/mobile apps to hit AbortController timeouts and show
    // "network error" even though the password reset was already saved.
    Promise.resolve(
      supabaseServer
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
    ).then(({ error: adminsError }) => {
        if (adminsError) {
          console.error('[ForgotPassword] Error getting admins:', adminsError.message);
        }
      })
      .catch((err: unknown) => {
        console.error('[ForgotPassword] Admin notification failed:', err);
      });

    return NextResponse.json({ success: true }, { headers: getCorsHeaders(request) });
  } catch (err) {
    console.error('[ForgotPassword] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
