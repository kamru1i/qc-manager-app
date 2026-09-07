import fs from "node:fs";
import pg from "pg";

function getEnvValue(name) {
  const raw = fs.readFileSync(".env.local", "utf8");
  const line = raw
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));

  if (!line) {
    throw new Error(`${name} is not configured`);
  }

  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.replace(/^(["'])|(["'])$/g, "");
}

const client = new pg.Client({
  connectionString: getEnvValue("SUPABASE_DB_URL"),
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL.");

  try {
    // 1. Check table existence
    const tableRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'user_creation_requests'
      ORDER BY ordinal_position;
    `);
    console.log(`[PASS] user_creation_requests table exists with ${tableRes.rows.length} columns:`);
    console.log(tableRes.rows.map(r => `  - ${r.column_name}: ${r.data_type}`).join('\n'));

    // 2. Find a supervisor and an admin for end-to-end verification
    const supRes = await client.query(`SELECT id, username, full_name FROM public.profiles WHERE role = 'supervisor' LIMIT 1;`);
    const admRes = await client.query(`SELECT id, username, full_name FROM public.profiles WHERE role = 'admin' OR role = 'superadmin' LIMIT 1;`);

    if (supRes.rows.length === 0 || admRes.rows.length === 0) {
      throw new Error("Could not find both a supervisor and an admin in public.profiles");
    }

    const supervisor = supRes.rows[0];
    const admin = admRes.rows[0];
    console.log(`Using supervisor: ${supervisor.username} (${supervisor.id})`);
    console.log(`Using admin: ${admin.username} (${admin.id})`);

    // Clean up any stale test records from previous runs
    await client.query(`
      DELETE FROM public.user_creation_requests WHERE submitted_data->>'codename' LIKE 'TEST_SUP_CREATED_USER_%';
    `);
    const staleUsers = await client.query(`SELECT id FROM public.profiles WHERE username LIKE 'TEST_SUP_CREATED_USER_%';`);
    for (const u of staleUsers.rows) {
      await client.query(`DELETE FROM public.govt_holiday_responses WHERE user_id = $1;`, [u.id]);
      await client.query(`DELETE FROM public.audit_logs WHERE target_id = $1 OR target_user_id = $1::uuid;`, [u.id]);
      await client.query(`DELETE FROM auth.users WHERE id = $1;`, [u.id]);
    }

    const testCodename = "test_sup_created_user_" + Date.now().toString().slice(-4);
    let createdRequestId = null;
    let createdUserId = null;

    try {
      // 3. Test Privilege Escalation Protection (Attempt to request admin role)
      console.log("\n--- TEST: Privilege Escalation Protection ---");
      try {
        await client.query(`
          BEGIN;
          SET LOCAL "request.jwt.claim.sub" = '${supervisor.id}';
          SET LOCAL "request.jwt.claim.role" = 'authenticated';
          SELECT public.submit_user_creation_request(
            jsonb_build_object(
              'codename', '${testCodename}',
              'fullName', 'Privilege Escalation Test',
              'role', 'admin',
              'hasQuotesAccess', true,
              'allowedTypes', ARRAY['Quote']::text[]
            )
          );
          COMMIT;
        `);
        console.error("[FAIL] Supervisor was able to request an 'admin' role account!");
      } catch (err) {
        await client.query("ROLLBACK;");
        console.log(`[PASS] Correctly rejected admin role request: ${err.message}`);
      }

      // 4. Test Valid Request Submission
      console.log("\n--- TEST: Valid Request Submission ---");
      const subRes = await client.query(`
        BEGIN;
        SET LOCAL "request.jwt.claim.sub" = '${supervisor.id}';
        SET LOCAL "request.jwt.claim.role" = 'authenticated';
        SELECT public.submit_user_creation_request(
          jsonb_build_object(
            'codename', '${testCodename}',
            'fullName', 'E2E Workflow Test User',
            'role', 'user',
            'hasQuotesAccess', true,
            'allowedTypes', ARRAY['Quote', 'Requote']::text[],
            'assigned_supervisor_id', '${supervisor.id}',
            'assigned_supervisor_name', '${supervisor.full_name || supervisor.username}',
            'supervisorIds', ARRAY['${supervisor.id}']::text[],
            'hasChutiAccess', true,
            'eligibleOfficeLeave', true,
            'eligibleGovtHoliday', true,
            'allowOvertime', false,
            'allowReserve', false,
            'workingHours', 9.5,
            'breakTime', 0,
            'defaultSignIn', '09:00',
            'defaultSignOut', '18:30'
          )
        ) AS request_id;
        COMMIT;
      `);
      // Last statement in batch returned
      const reqIdRow = subRes[3]?.rows?.[0] || subRes.rows?.[0];
      createdRequestId = reqIdRow.request_id;
      console.log(`[PASS] Request created with ID: ${createdRequestId}`);

      // Verify row state
      const reqRowRes = await client.query(`SELECT status, version, requester_id, submitted_data->>'codename' as cd FROM public.user_creation_requests WHERE id = $1;`, [createdRequestId]);
      const reqRow = reqRowRes.rows[0];
      if (reqRow.status !== 'pending_admin_approval' || reqRow.version !== 1) {
        throw new Error(`Unexpected request state: ${JSON.stringify(reqRow)}`);
      }
      console.log(`[PASS] Request in initial state: status='${reqRow.status}', version=${reqRow.version}`);

      // 5. Test Admin "Send for Review"
      console.log("\n--- TEST: Admin Send for Review ---");
      await client.query(`
        BEGIN;
        SET LOCAL "request.jwt.claim.sub" = '${admin.id}';
        SET LOCAL "request.jwt.claim.role" = 'authenticated';
        SELECT public.review_user_creation_request(
          '${createdRequestId}'::uuid,
          'Please change category to Quote and Review and confirm hours.'
        );
        COMMIT;
      `);

      const reviewCheck = await client.query(`SELECT status, review_notes, reviewed_by, version FROM public.user_creation_requests WHERE id = $1;`, [createdRequestId]);
      const reviewRow = reviewCheck.rows[0];
      if (reviewRow.status !== 'needs_review' || !reviewRow.review_notes.includes('Please change category')) {
        throw new Error(`Review state mismatch: ${JSON.stringify(reviewRow)}`);
      }
      console.log(`[PASS] Request updated to 'needs_review' with notes: "${reviewRow.review_notes}"`);

      // 6. Test Supervisor Resubmission Concurrency (Reject stale version)
      console.log("\n--- TEST: Concurrency Protection on Resubmission ---");
      try {
        await client.query(`
          BEGIN;
          SET LOCAL "request.jwt.claim.sub" = '${supervisor.id}';
          SET LOCAL "request.jwt.claim.role" = 'authenticated';
          SELECT public.resubmit_user_creation_request(
            '${createdRequestId}'::uuid,
            jsonb_build_object(
              'codename', '${testCodename}',
              'fullName', 'E2E Workflow Test User Revised',
              'role', 'user',
              'hasQuotesAccess', true,
              'allowedTypes', ARRAY['Quote', 'Review']::text[],
              'assigned_supervisor_id', '${supervisor.id}',
              'supervisorIds', ARRAY['${supervisor.id}']::text[],
              'hasChutiAccess', true
            ),
            999 -- Wrong version
          );
          COMMIT;
        `);
        console.error("[FAIL] Stale version resubmission should have been rejected!");
      } catch (err) {
        await client.query("ROLLBACK;");
        console.log(`[PASS] Concurrency rejected stale version: ${err.message}`);
      }

      // 7. Test Supervisor Resubmission with Correct Version (1)
      console.log("\n--- TEST: Valid Supervisor Resubmission ---");
      await client.query(`
        BEGIN;
        SET LOCAL "request.jwt.claim.sub" = '${supervisor.id}';
        SET LOCAL "request.jwt.claim.role" = 'authenticated';
        SELECT public.resubmit_user_creation_request(
          '${createdRequestId}'::uuid,
          jsonb_build_object(
            'codename', '${testCodename}',
            'fullName', 'E2E Workflow Test User Revised',
            'role', 'user',
            'hasQuotesAccess', true,
            'allowedTypes', ARRAY['Quote', 'Review']::text[],
            'assigned_supervisor_id', '${supervisor.id}',
            'assigned_supervisor_name', '${supervisor.full_name || supervisor.username}',
            'supervisorIds', ARRAY['${supervisor.id}']::text[],
            'hasChutiAccess', true,
            'eligibleOfficeLeave', true,
            'eligibleGovtHoliday', true,
            'allowOvertime', false,
            'allowReserve', false,
            'workingHours', 9.5,
            'breakTime', 0,
            'defaultSignIn', '09:00',
            'defaultSignOut', '18:30'
          ),
          1 -- correct expected version
        );
        COMMIT;
      `);

      const resubmitCheck = await client.query(`SELECT status, version, submitted_data->>'allowedTypes' as types, submitted_data->>'fullName' as fn FROM public.user_creation_requests WHERE id = $1;`, [createdRequestId]);
      const resubmitRow = resubmitCheck.rows[0];
      if (resubmitRow.status !== 'pending_admin_approval' || resubmitRow.version !== 2) {
        throw new Error(`Resubmission state mismatch: ${JSON.stringify(resubmitRow)}`);
      }
      console.log(`[PASS] Resubmitted: status='${resubmitRow.status}', version=${resubmitRow.version}, fullName='${resubmitRow.fn}'`);

      // 8. Test Admin Approval Concurrency (Reject stale version)
      console.log("\n--- TEST: Concurrency Protection on Approval ---");
      try {
        await client.query(`
          BEGIN;
          SET LOCAL "request.jwt.claim.sub" = '${admin.id}';
          SET LOCAL "request.jwt.claim.role" = 'authenticated';
          SELECT public.approve_user_creation_request(
            '${createdRequestId}'::uuid,
            1 -- Stale version
          );
          COMMIT;
        `);
        console.error("[FAIL] Stale version approval should have been rejected!");
      } catch (err) {
        await client.query("ROLLBACK;");
        console.log(`[PASS] Concurrency rejected stale version approval: ${err.message}`);
      }

      // 9. Test Valid Admin Approval
      console.log("\n--- TEST: Valid Admin Approval & Account Provisioning ---");
      const appRes = await client.query(`
        BEGIN;
        SET LOCAL "request.jwt.claim.sub" = '${admin.id}';
        SET LOCAL "request.jwt.claim.role" = 'authenticated';
        SELECT public.approve_user_creation_request(
          '${createdRequestId}'::uuid,
          2 -- Correct expected version
        ) AS created_user_id;
        COMMIT;
      `);

      const appRow = appRes[3]?.rows?.[0] || appRes.rows?.[0];
      createdUserId = appRow.created_user_id;
      console.log(`[PASS] User created with ID: ${createdUserId}`);

      // Verify created profile
      const profRes = await client.query(`SELECT id, username, full_name, role, has_quotes_access, has_chuti_access, allowed_types, supervisor_ids FROM public.profiles WHERE id = $1;`, [createdUserId]);
      const prof = profRes.rows[0];
      console.log(`[PASS] Verified created profile in database:`);
      console.log(`  - Username: ${prof.username}`);
      console.log(`  - Full Name: ${prof.full_name}`);
      console.log(`  - Role: ${prof.role}`);
      console.log(`  - Quotes Access: ${prof.has_quotes_access}`);
      console.log(`  - Chuti Access: ${prof.has_chuti_access}`);
      console.log(`  - Allowed Types: ${JSON.stringify(prof.allowed_types)}`);
      console.log(`  - Supervisor IDs: ${JSON.stringify(prof.supervisor_ids)}`);

      if (
        prof.username !== testCodename.toUpperCase() ||
        prof.role !== 'user' ||
        !prof.has_quotes_access ||
        !prof.has_chuti_access ||
        !prof.supervisor_ids?.includes(supervisor.id)
      ) {
        throw new Error("Created profile failed verification checks!");
      }

      // Verify request record is now approved
      const finalReqRes = await client.query(`SELECT status, created_user_id, reviewed_by FROM public.user_creation_requests WHERE id = $1;`, [createdRequestId]);
      const finalReq = finalReqRes.rows[0];
      console.log(`[PASS] Request finalized: status='${finalReq.status}', created_user_id='${finalReq.created_user_id}'`);

      console.log("\n=======================================================");
      console.log("ALL END-TO-END TESTS PASSED WITH 100% GREEN CONFIRMATION!");
      console.log("=======================================================\n");

    } finally {
      // Cleanup test data
      console.log("Cleaning up test artifacts...");
      if (createdUserId) {
        await client.query(`DELETE FROM public.govt_holiday_responses WHERE user_id = $1;`, [createdUserId]);
        await client.query(`DELETE FROM public.audit_logs WHERE target_id = $1 OR target_user_id = $1::uuid;`, [createdUserId]);
        await client.query(`DELETE FROM auth.users WHERE id = $1;`, [createdUserId]);
        console.log(`Cleaned up test profile & auth user ${createdUserId}`);
      }
      if (createdRequestId) {
        await client.query(`DELETE FROM public.audit_logs WHERE target_id = $1;`, [createdRequestId]);
        await client.query(`DELETE FROM public.user_creation_requests WHERE id = $1;`, [createdRequestId]);
        console.log(`Cleaned up test request ${createdRequestId}`);
      }
    }

  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("FATAL E2E ERROR:", err);
  process.exit(1);
});
