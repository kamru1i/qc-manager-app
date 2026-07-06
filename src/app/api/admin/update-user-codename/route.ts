import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      return NextResponse.json(
        { error: 'Server configuration error: missing credentials' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate caller
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(request) });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(request) });
    }

    // 2. Check if caller is admin
    const { data: callerProfile, error: callerError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerError || callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: getCorsHeaders(request) });
    }

    // 3. Parse arguments
    const body = await request.json().catch(() => ({}));
    const { userId, newUsername, role } = body;

    if (!userId || !newUsername || !role) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400, headers: getCorsHeaders(request) });
    }

    const cleanUsername = newUsername.trim().toUpperCase();

    // 4. Update profiles table
    const { error: profileError } = await supabaseServer
      .from('profiles')
      .update({ username: cleanUsername })
      .eq('id', userId);

    if (profileError) {
      return NextResponse.json({ error: 'Failed to update profile username: ' + profileError.message }, { status: 500, headers: getCorsHeaders(request) });
    }

    // 5. Fetch user's current email to preserve their existing email domain suffix (e.g. office.local)
    const { data: userData, error: getUserError } = await supabaseServer.auth.admin.getUserById(userId);
    if (getUserError || !userData?.user) {
      return NextResponse.json({ error: 'Failed to retrieve user: ' + (getUserError?.message || 'Not found') }, { status: 400, headers: getCorsHeaders(request) });
    }

    const currentEmail = userData.user.email || '';
    let suffix = 'office.local';
    if (currentEmail.includes('@')) {
      suffix = currentEmail.split('@')[1];
    } else {
      suffix = role === 'admin' ? 'admin.local' : role === 'supervisor' ? 'supervisor.local' : 'user.local';
    }

    const newEmail = `${cleanUsername.toLowerCase()}@${suffix}`;

    const { error: authError } = await supabaseServer.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true
    });

    if (authError) {
      console.error('[UpdateUserCodename] Auth update error:', authError.message);
      return NextResponse.json({ error: 'Failed to update user auth email: ' + authError.message }, { status: 500, headers: getCorsHeaders(request) });
    }

    return NextResponse.json({ success: true, newEmail }, { headers: getCorsHeaders(request) });
  } catch (err: any) {
    console.error('[UpdateUserCodename] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
