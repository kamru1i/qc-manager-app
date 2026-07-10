import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing credentials' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    // 1. Authenticate supervisor/admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing Authorization header' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    const token = authHeader.replace('Bearer ', '');
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
      console.error('[AddLeave Route] auth.getUser() error:', e);
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
        console.error('[AddLeave Route] auth.getUser(token) error:', e);
      }
    }

    if (authError || !user) {
      console.error('[AddLeave Route] Auth verification failed:', authError?.message || 'No user session', 'Token parts count:', token ? token.split('.').length : 0);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    // Fetch requester's profile using service role to check role
    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
    const { data: requesterProfile, error: rpError } = await supabaseServer
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (rpError || !requesterProfile) {
      return NextResponse.json(
        { error: 'Forbidden: Profile not found' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    const isSupervisor = requesterProfile.role === 'supervisor';
    const isAdmin = requesterProfile.role === 'admin';

    if (!isSupervisor && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Access denied' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    // 2. Parse payload
    const { insertData } = await request.json();
    if (!insertData || !Array.isArray(insertData) || insertData.length === 0) {
      return NextResponse.json(
        { error: 'Bad Request: Missing or empty insertData' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // 3. For supervisor, verify authorization for each user_id in insertData
    if (isSupervisor) {
      const targetUserIds = Array.from(new Set(insertData.map(item => item.user_id)));
      
      for (const targetUserId of targetUserIds) {
        const { data: targetProfile, error: tpError } = await supabaseServer
          .from('profiles')
          .select('supervisor_ids')
          .eq('id', targetUserId)
          .single();

        if (tpError || !targetProfile) {
          return NextResponse.json(
            { error: `Forbidden: Target staff profile not found for ${targetUserId}` },
            { status: 403, headers: getCorsHeaders(request) }
          );
        }

        const isSupervisedByMe = targetUserId === user.id || (Array.isArray(targetProfile.supervisor_ids) && targetProfile.supervisor_ids.includes(user.id));
        if (!isSupervisedByMe) {
          return NextResponse.json(
            { error: `Forbidden: You do not supervise the user ${targetUserId}` },
            { status: 403, headers: getCorsHeaders(request) }
          );
        }
      }
    }

    // 4. Perform the insertion using service role client to bypass RLS
    const { data: insertedData, error: insertError } = await supabaseServer
      .from('chuti')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Failed to insert leave records' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    return NextResponse.json(
      { success: true, data: insertedData },
      { status: 200, headers: getCorsHeaders(request) }
    );

  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
