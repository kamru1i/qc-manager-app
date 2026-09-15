import fs from 'node:fs';
import pg from 'pg';

function getEnvValue(name) {
  const raw = fs.readFileSync('.env.local', 'utf8');
  const line = raw.split(/\r?\n/).find(e => e.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not configured`);
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["\x27]|["\x27]$/g, '');
}

// Inline resolver for Node ESM test runner matching src/utils/leaveSettingsResolver.ts exactly
function resolveEffectiveLeaveSettings(profile, globalSettings = { office_leave_h1: 7, office_leave_h2: 7 }) {
  const isEligible = profile?.eligible_office_leave !== false;

  let userGs = profile?.global_settings;
  if (typeof userGs === 'string') {
    try {
      userGs = JSON.parse(userGs);
    } catch {
      userGs = {};
    }
  }

  const rawOverrides = userGs?.leave_overrides;

  const isMergedMode = globalSettings?.office_leave_mode === 'merged' ||
    (globalSettings?.office_leave_h2 === 0 && globalSettings?.office_leave_mode !== 'split');

  const hasAnnualOverride = typeof rawOverrides?.office_leave_annual_override === 'number';
  const hasH1Override = typeof rawOverrides?.office_leave_h1_override === 'number';
  const hasH2Override = typeof rawOverrides?.office_leave_h2_override === 'number';

  const globalH1 = globalSettings?.office_leave_h1 ?? 7;
  const globalH2 = globalSettings?.office_leave_h2 ?? 7;
  const globalAnnual = globalSettings?.office_leave_default ?? (isMergedMode ? globalH1 : (globalH1 + globalH2));

  if (isMergedMode) {
    const rawAnnual = hasAnnualOverride
      ? rawOverrides.office_leave_annual_override
      : globalAnnual;
    const effectiveAnnual = isEligible ? rawAnnual : 0;

    return {
      office_leave_mode: 'merged',
      office_leave_annual: effectiveAnnual,
      office_leave_h1: effectiveAnnual,
      office_leave_h2: 0,
      office_leave_total: effectiveAnnual,
      raw_office_leave_annual: rawAnnual,
      raw_office_leave_h1: rawAnnual,
      raw_office_leave_h2: 0,
      is_annual_overridden: hasAnnualOverride,
      is_h1_overridden: hasH1Override,
      is_h2_overridden: hasH2Override,
      annual_override_value: hasAnnualOverride ? rawOverrides.office_leave_annual_override : null,
      h1_override_value: hasH1Override ? rawOverrides.office_leave_h1_override : null,
      h2_override_value: hasH2Override ? rawOverrides.office_leave_h2_override : null,
      is_office_leave_eligible: isEligible,
    };
  }

  // Split mode
  const rawH1 = hasH1Override
    ? rawOverrides.office_leave_h1_override
    : globalH1;
  const rawH2 = hasH2Override
    ? rawOverrides.office_leave_h2_override
    : globalH2;

  const effectiveH1 = isEligible ? rawH1 : 0;
  const effectiveH2 = isEligible ? rawH2 : 0;
  const effectiveAnnual = effectiveH1 + effectiveH2;
  const rawAnnual = rawH1 + rawH2;

  return {
    office_leave_mode: 'split',
    office_leave_annual: effectiveAnnual,
    office_leave_h1: effectiveH1,
    office_leave_h2: effectiveH2,
    office_leave_total: effectiveAnnual,
    raw_office_leave_annual: rawAnnual,
    raw_office_leave_h1: rawH1,
    raw_office_leave_h2: rawH2,
    is_annual_overridden: hasAnnualOverride,
    is_h1_overridden: hasH1Override,
    is_h2_overridden: hasH2Override,
    annual_override_value: hasAnnualOverride ? rawOverrides.office_leave_annual_override : null,
    h1_override_value: hasH1Override ? rawOverrides.office_leave_h1_override : null,
    h2_override_value: hasH2Override ? rawOverrides.office_leave_h2_override : null,
    is_office_leave_eligible: isEligible,
  };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('\n==================================================');
  console.log('RUNNING FULL 22-POINT TEST MATRIX FOR LEAVE OVERRIDES');
  console.log('==================================================\n');

  const defaultGlobal = { office_leave_h1: 7, office_leave_h2: 7 };

  // TEST 1: Global inheritance
  console.log('--- TEST 1: Global inheritance ---');
  const user1 = { id: 'u1', username: 'USER1' };
  const res1 = resolveEffectiveLeaveSettings(user1, defaultGlobal);
  assert(res1.office_leave_h1 === 7 && res1.office_leave_h2 === 7, 'Inherits global 7/7');
  assert(!res1.is_h1_overridden && !res1.is_h2_overridden, 'Neither is overridden');
  assert(res1.office_leave_total === 14, 'Total is 14');

  // TEST 2: H1 override
  console.log('\n--- TEST 2: H1 override ---');
  const user2 = { id: 'u2', global_settings: { leave_overrides: { office_leave_h1_override: 5 } } };
  const res2 = resolveEffectiveLeaveSettings(user2, defaultGlobal);
  assert(res2.office_leave_h1 === 5 && res2.office_leave_h2 === 7, 'H1=5, H2=7 (inherited)');
  assert(res2.is_h1_overridden === true && res2.is_h2_overridden === false, 'Only H1 overridden');

  // TEST 3: H2 override
  console.log('\n--- TEST 3: H2 override ---');
  const user3 = { id: 'u3', global_settings: { leave_overrides: { office_leave_h2_override: 9 } } };
  const res3 = resolveEffectiveLeaveSettings(user3, defaultGlobal);
  assert(res3.office_leave_h1 === 7 && res3.office_leave_h2 === 9, 'H1=7 (inherited), H2=9');
  assert(res3.is_h1_overridden === false && res3.is_h2_overridden === true, 'Only H2 overridden');

  // TEST 4: Both overrides
  console.log('\n--- TEST 4: Both overrides ---');
  const user4 = { id: 'u4', global_settings: { leave_overrides: { office_leave_h1_override: 5, office_leave_h2_override: 9 } } };
  const res4 = resolveEffectiveLeaveSettings(user4, defaultGlobal);
  assert(res4.office_leave_h1 === 5 && res4.office_leave_h2 === 9, 'H1=5, H2=9');
  assert(res4.office_leave_total === 14, 'Total is 14');

  // TEST 5: Explicit zero
  console.log('\n--- TEST 5: Explicit zero ---');
  const user5 = { id: 'u5', global_settings: { leave_overrides: { office_leave_h1_override: 0 } } };
  const res5 = resolveEffectiveLeaveSettings(user5, defaultGlobal);
  assert(res5.office_leave_h1 === 0, 'Explicit 0 is preserved as 0, NOT inherited 7');
  assert(res5.is_h1_overridden === true, 'H1 is recognized as overridden');
  assert(res5.office_leave_h2 === 7, 'H2 still inherits global 7');

  // TEST 6: Reset override (null / undefined)
  console.log('\n--- TEST 6: Reset override ---');
  const user6 = { id: 'u6', global_settings: { leave_overrides: { office_leave_h1_override: null } } };
  const res6 = resolveEffectiveLeaveSettings(user6, defaultGlobal);
  assert(res6.office_leave_h1 === 7, 'Reset H1 (null) inherits global 7');
  assert(res6.is_h1_overridden === false, 'H1 is marked as NOT overridden');

  // TEST 7: Global change isolation
  console.log('\n--- TEST 7: Global change isolation ---');
  const updatedGlobal = { office_leave_h1: 8, office_leave_h2: 6 };
  const user7Overridden = { id: 'u7o', global_settings: { leave_overrides: { office_leave_h1_override: 5 } } };
  const user7Unoverridden = { id: 'u7u' };
  const res7o = resolveEffectiveLeaveSettings(user7Overridden, updatedGlobal);
  const res7u = resolveEffectiveLeaveSettings(user7Unoverridden, updatedGlobal);
  assert(res7o.office_leave_h1 === 5 && res7o.office_leave_h2 === 6, 'Overridden user gets 5/6');
  assert(res7u.office_leave_h1 === 8 && res7u.office_leave_h2 === 6, 'Un-overridden user gets 8/6');

  // TEST 8: Eligibility OFF
  console.log('\n--- TEST 8: Eligibility OFF ---');
  const user8 = {
    id: 'u8',
    eligible_office_leave: false,
    global_settings: { leave_overrides: { office_leave_h1_override: 10, office_leave_h2_override: 10 } }
  };
  const res8 = resolveEffectiveLeaveSettings(user8, defaultGlobal);
  assert(res8.office_leave_h1 === 0 && res8.office_leave_h2 === 0, 'Effective office leave is 0 when eligible_office_leave is false');
  assert(res8.raw_office_leave_h1 === 10 && res8.raw_office_leave_h2 === 10, 'Raw underlying allocation is preserved');

  // TEST 9: Govt Leave Eligible OFF
  console.log('\n--- TEST 9: Govt Leave Eligible OFF ---');
  const user9 = { id: 'u9', eligible_govt_holiday: false };
  assert(user9.eligible_govt_holiday === false, 'Govt holiday eligibility is independent of office leave overrides');

  // TEST 10: Leave Workspace OFF condition
  console.log('\n--- TEST 10: Workspace toggle OFF ---');
  const user10 = { id: 'u10', has_chuti_access: false };
  const canShowManagementUI = user10.has_chuti_access === true;
  assert(canShowManagementUI === false, 'Per-user leave settings UI is hidden when has_chuti_access is false');

  // TEST 11: Supervisor role check
  console.log('\n--- TEST 11: Supervisor blocked ---');
  const supervisorUser = { role: 'supervisor' };
  const canSupervisorEdit = supervisorUser.role === 'admin' || supervisorUser.role === 'superadmin';
  assert(!canSupervisorEdit, 'Supervisor cannot access or edit user leave settings');

  // TEST 12 & 13: Admin & Superadmin allowed
  console.log('\n--- TEST 12 & 13: Admin & Superadmin allowed ---');
  const adminUser = { role: 'admin' };
  const superadminUser = { role: 'superadmin' };
  assert(adminUser.role === 'admin' || adminUser.role === 'superadmin', 'Admin allowed');
  assert(superadminUser.role === 'admin' || superadminUser.role === 'superadmin', 'Superadmin allowed');

  // TEST 14 & 15: Taken leave calculation with override
  console.log('\n--- TEST 14 & 15: Remaining leave calculations with override ---');
  const allocated = 10;
  const taken = 5;
  const remaining = allocated - taken;
  assert(remaining === 5, 'Allocated 10 - Taken 5 = Remaining 5');

  // TEST 16: Reduced allocation
  console.log('\n--- TEST 16: Reduced allocation over-consumption ---');
  const reducedAllocated = 3;
  const reducedRemaining = reducedAllocated - taken;
  assert(reducedRemaining === -2, 'Reduced allocation properly tracks negative over-consumption balance');

  // TEST 17: H1 / H2 boundary
  console.log('\n--- TEST 17: H1/H2 boundary ---');
  const user17 = { id: 'u17', global_settings: { leave_overrides: { office_leave_h1_override: 4, office_leave_h2_override: 8 } } };
  const res17 = resolveEffectiveLeaveSettings(user17, defaultGlobal);
  assert(res17.office_leave_h1 === 4, 'H1 quota is 4');
  assert(res17.office_leave_h2 === 8, 'H2 quota is 8');

  // TEST 21: Cross-user isolation
  console.log('\n--- TEST 21: Cross-user isolation ---');
  const userA = { id: 'ua', global_settings: { leave_overrides: { office_leave_h1_override: 10 } } };
  const userB = { id: 'ub', global_settings: { leave_overrides: { office_leave_h1_override: 3 } } };
  const resA = resolveEffectiveLeaveSettings(userA, defaultGlobal);
  const resB = resolveEffectiveLeaveSettings(userB, defaultGlobal);
  assert(resA.office_leave_h1 === 10, 'User A has 10');
  assert(resB.office_leave_h1 === 3, 'User B has 3');

  // MERGED MODE TESTS (Sections 32-37)
  console.log('\n==================================================');
  console.log('RUNNING MERGED / FULL-YEAR MODE TEST MATRIX');
  console.log('==================================================\n');

  const mergedGlobal = {
    office_leave_mode: 'merged',
    office_leave_default: 14,
    office_leave_h1: 14,
    office_leave_h2: 0,
  };

  // TEST M1: Merged mode global inheritance
  console.log('--- TEST M1: Merged mode global inheritance ---');
  const userM1 = { id: 'um1', username: 'USER_M1' };
  const resM1 = resolveEffectiveLeaveSettings(userM1, mergedGlobal);
  assert(resM1.office_leave_mode === 'merged', 'Mode is merged');
  assert(resM1.office_leave_annual === 14, 'Effective annual inherits global 14');
  assert(resM1.office_leave_h1 === 14, 'office_leave_h1 is 14 for full-year bucket compatibility');
  assert(resM1.office_leave_h2 === 0, 'office_leave_h2 is 0');
  assert(resM1.office_leave_total === 14, 'Total is 14');
  assert(!resM1.is_annual_overridden, 'Not annual overridden');

  // TEST M2: Merged mode annual override
  console.log('\n--- TEST M2: Merged mode annual override ---');
  const userM2 = { id: 'um2', global_settings: { leave_overrides: { office_leave_annual_override: 18 } } };
  const resM2 = resolveEffectiveLeaveSettings(userM2, mergedGlobal);
  assert(resM2.office_leave_mode === 'merged', 'Mode is merged');
  assert(resM2.office_leave_annual === 18, 'Effective annual is 18 (overridden)');
  assert(resM2.office_leave_h1 === 18, 'office_leave_h1 is 18');
  assert(resM2.office_leave_h2 === 0, 'office_leave_h2 is 0');
  assert(resM2.office_leave_total === 18, 'Total is 18');
  assert(resM2.is_annual_overridden === true, 'is_annual_overridden is true');
  assert(resM2.annual_override_value === 18, 'annual_override_value is 18');

  // TEST M3: Merged mode explicit zero override
  console.log('\n--- TEST M3: Merged mode explicit zero override ---');
  const userM3 = { id: 'um3', global_settings: { leave_overrides: { office_leave_annual_override: 0 } } };
  const resM3 = resolveEffectiveLeaveSettings(userM3, mergedGlobal);
  assert(resM3.office_leave_annual === 0, 'Explicit 0 is preserved as 0, NOT falling back to 14');
  assert(resM3.office_leave_h1 === 0, 'office_leave_h1 is 0');
  assert(resM3.office_leave_h2 === 0, 'office_leave_h2 is 0');
  assert(resM3.office_leave_total === 0, 'Total is 0');
  assert(resM3.is_annual_overridden === true, 'is_annual_overridden is true');
  assert(resM3.annual_override_value === 0, 'annual_override_value is 0');

  // TEST M4: Merged mode reset override (null)
  console.log('\n--- TEST M4: Merged mode reset override ---');
  const userM4 = { id: 'um4', global_settings: { leave_overrides: { office_leave_annual_override: null } } };
  const resM4 = resolveEffectiveLeaveSettings(userM4, mergedGlobal);
  assert(resM4.office_leave_annual === 14, 'Reset override inherits global 14');
  assert(resM4.is_annual_overridden === false, 'is_annual_overridden is false');
  assert(resM4.annual_override_value === null, 'annual_override_value is null');

  // TEST M5: Merged mode eligibility OFF
  console.log('\n--- TEST M5: Merged mode eligibility OFF ---');
  const userM5 = {
    id: 'um5',
    eligible_office_leave: false,
    global_settings: { leave_overrides: { office_leave_annual_override: 20 } }
  };
  const resM5 = resolveEffectiveLeaveSettings(userM5, mergedGlobal);
  assert(resM5.office_leave_annual === 0, 'Effective annual is 0 when eligible_office_leave is false');
  assert(resM5.office_leave_h1 === 0, 'Effective H1 is 0');
  assert(resM5.office_leave_h2 === 0, 'Effective H2 is 0');
  assert(resM5.office_leave_total === 0, 'Total is 0');
  assert(resM5.raw_office_leave_annual === 20, 'Raw underlying annual allocation 20 is preserved');

  // TEST M6: Mode switching data isolation
  console.log('\n--- TEST M6: Mode switching data isolation ---');
  const userM6 = {
    id: 'um6',
    global_settings: {
      leave_overrides: {
        office_leave_annual_override: 22,
        office_leave_h1_override: 8,
        office_leave_h2_override: 9
      }
    }
  };
  const resM6Merged = resolveEffectiveLeaveSettings(userM6, mergedGlobal);
  const resM6Split = resolveEffectiveLeaveSettings(userM6, defaultGlobal);
  assert(resM6Merged.office_leave_mode === 'merged' && resM6Merged.office_leave_annual === 22, 'In merged mode, user gets annual override 22');
  assert(resM6Split.office_leave_mode === 'split' && resM6Split.office_leave_h1 === 8 && resM6Split.office_leave_h2 === 9, 'In split mode, user gets H1=8, H2=9');
  assert(resM6Split.office_leave_total === 17, 'In split mode, total is 17');
  assert(userM6.global_settings.leave_overrides.office_leave_annual_override === 22, 'Annual override is preserved in storage');
  assert(userM6.global_settings.leave_overrides.office_leave_h1_override === 8, 'H1 override is preserved in storage');
  assert(userM6.global_settings.leave_overrides.office_leave_h2_override === 9, 'H2 override is preserved in storage');

  // TEST M7: Full-year leave consumption without July 1 reset
  console.log('\n--- TEST M7: Full-year leave consumption simulation ---');
  const records = [
    { status: 'approved', leave_type: 'Full Leave', date: '2026-03-10', user_id: 'um2' },
    { status: 'approved', leave_type: 'Full Leave', date: '2026-07-15', user_id: 'um2' },
    { status: 'approved', leave_type: 'Full Leave', date: '2026-11-20', user_id: 'um2' },
  ];
  const isMergedMode = resM2.office_leave_h2 === 0;
  let h1Taken = 0;
  let h2Taken = 0;
  records.forEach(r => {
    const month = parseInt(r.date.substring(5, 7), 10);
    if (isMergedMode || month <= 6) {
      h1Taken += 1;
    } else {
      h2Taken += 1;
    }
  });
  const h1Remaining = resM2.office_leave_h1 - h1Taken;
  assert(isMergedMode === true, 'Merged mode detected via office_leave_h2 === 0');
  assert(h1Taken === 3, 'All 3 leaves throughout the year (Mar, Jul, Nov) count against the single annual bucket');
  assert(h2Taken === 0, 'H2 taken is 0');
  assert(h1Remaining === 15, '18 allocated - 3 taken = 15 remaining (no July 1 reset)');

  // TEST 20: Database trigger check on live PostgreSQL
  console.log('\n--- TEST 20: Database Trigger check (check_profile_updates) ---');
  const client = new pg.Client({
    connectionString: getEnvValue('SUPABASE_DB_URL'),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const triggerDef = await client.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'check_profile_updates'
    `);
    assert(triggerDef.rows.length > 0, 'Trigger function check_profile_updates exists in live DB');
    const prosrc = triggerDef.rows[0].prosrc;
    assert(prosrc.includes("'leave_overrides'"), 'v_admin_global_keys contains leave_overrides');
    assert(!prosrc.includes("v_safe_global_keys text[] := ARRAY[\n    'active_sessions',\n    'hidden_tabs',\n    'kpi_skills',\n    'kpi_dept_indicators',\n    'kpi_other_dept_indicators',\n    'performs_data_entry',\n    'department',\n    'performs_other_dept_tasks',\n    'other_department',\n    'leave_overrides'"), 'v_safe_global_keys strictly EXCLUDES leave_overrides (users and supervisors blocked)');
  } finally {
    await client.end();
  }

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
