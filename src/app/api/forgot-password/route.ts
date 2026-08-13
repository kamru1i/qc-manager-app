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

    // Rate limiting — extract the first (client) IP to prevent spoofing via forged headers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || '127.0.0.1';
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

    if (!/^[A-Z0-9._-]{2,50}$/.test(cleanUsername)) {
      return NextResponse.json({ success: true }, { headers: getCorsHeaders(request) });
    }

    // Service-only RPC performs one atomic key update and intentionally returns
    // no match information, preserving the endpoint's anti-enumeration behavior.
    const { error: updateError } = await supabaseServer.rpc('request_password_reset', {
      p_username: cleanUsername,
    });

    if (updateError) {
      console.error('[ForgotPassword] Error updating profile status:', updateError.message);
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 500, headers: getCorsHeaders(request) }
      );
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
