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
        { error: 'Server error processing request' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    if (!profile) {
      // Return the same success response to prevent username enumeration.
      // Do NOT reveal whether the username exists or not.
      console.log(`[ForgotPassword] Username not found: ${cleanUsername} (silent success)`);
      return NextResponse.json({ success: true }, { headers: getCorsHeaders(request) });
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

    return NextResponse.json({ success: true }, { headers: getCorsHeaders(request) });
  } catch (err) {
    console.error('[ForgotPassword] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
