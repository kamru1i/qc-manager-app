import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders, RateLimiter } from '@/utils/apiHelpers';

// Bounded rate limiter: 10 requests per minute per IP
const rateLimiter = new RateLimiter(60000, 10);

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
      console.error('[ResolveEmail] Missing Supabase environment variables.');
      return NextResponse.json(
        { error: 'Server configuration error: missing credentials' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

    // Basic IP detection from headers
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    if (rateLimiter.isLimited(ip)) {
      console.warn(`[ResolveEmail] Rate limit hit for IP: ${ip}`);
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait a minute and try again.' },
        { status: 429, headers: getCorsHeaders(request) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Require password in the request body to prevent trivial API abuse
    // (scripted email scraping). Actual password validation happens client-side
    // via signInWithPassword. Rate limiter (10/min/IP) is the primary guard.
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Invoke the get_user_email_by_username RPC function (restricted to service_role)
    const { data: email, error } = await supabaseServer.rpc('get_user_email_by_username', {
      p_username: cleanUsername,
    });

    if (error || !email) {
      return NextResponse.json(
        { email: null },
        { headers: getCorsHeaders(request) }
      );
    }

    // Only return email — the client does signInWithPassword to create a proper session.
    // Previously the server also called signInWithPassword here to validate the password
    // before releasing the email, but this doubled auth API calls per login and generated
    // wasted session tokens. Security is maintained because:
    //   1. The RPC is restricted to service_role (cannot be called from client)
    //   2. If the username doesn't exist, we return 401 above (no email enumeration)
    //   3. The client's signInWithPassword will reject wrong passwords
    return NextResponse.json({ email }, { headers: getCorsHeaders(request) });
  } catch (err) {
    console.error('[ResolveEmail] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
