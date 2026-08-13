import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '@/utils/apiHelpers';
import { CHUTI_COLUMNS } from '@/utils/dbColumns';

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

    const { data: { user }, error: authError } = await supabaseWithAuth.auth.getUser(token);

    if (authError || !user) {
      console.error('[AddLeave Route] Auth verification failed:', authError?.message || 'No user session', 'Token parts count:', token ? token.split('.').length : 0);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    // Fetch through the caller-scoped client so RLS remains part of enforcement.
    const { data: requesterProfile, error: rpError } = await supabaseWithAuth
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
    // Superadmin inherits all admin capability.
    const isAdmin = requesterProfile.role === 'admin' || requesterProfile.role === 'superadmin';

    if (!isSupervisor && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Access denied' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    // 2. Parse payload
    const { insertData } = await request.json();
    if (!insertData || !Array.isArray(insertData) || insertData.length === 0 || insertData.length > 100) {
      return NextResponse.json(
        { error: 'Bad Request: insertData must contain between 1 and 100 records' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // 3. Sanitize payload: whitelist only allowed fields to prevent injection
    //    of security-sensitive values (status, admin_edit_status, is_edited, etc.)
    const sanitizedRecords = insertData.map((item: Record<string, unknown>) => ({
      user_id: item.user_id,
      date: item.date,
      leave_type: item.leave_type,
      adjustment: item.adjustment ?? false,
      adjusted_hour: item.adjusted_hour ?? null,
      sign_in_time: item.sign_in_time ?? null,
      sign_out_time: item.sign_out_time ?? null,
      leave_hour: item.leave_hour ?? null,
      reserve_holiday: item.reserve_holiday ?? null,
      adjust_short_leave: item.adjust_short_leave ?? false,
      comment: item.comment ?? null,
      bulk_id: item.bulk_id ?? null,
      // Server-enforced fields — NOT user-controllable:
      status: isAdmin ? 'approved' : 'approved_by_supervisor',
      reserve_adjustment_status: 'none',
      admin_edit_status: 'none',
      is_edited: false,
    }));

    // 4. Insert as the authenticated caller. RLS and the write-validation
    // trigger enforce every target row; a bad row rolls back the full batch.
    const { data: insertedData, error: insertError } = await supabaseWithAuth
      .from('chuti')
      .insert(sanitizedRecords)
      .select(CHUTI_COLUMNS);

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
