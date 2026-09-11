import fs from 'node:fs';
import pg from 'pg';
import { calculateLeaveOrOvertime } from '../src/utils/leaveCalculations.ts';
import { formatDate, formatTimeToAMPM } from '../src/utils/quotesDashboardHelpers.ts';
import { canAccessModule } from '../src/utils/permissionService.ts';

function getEnvValue(name) {
  const raw = fs.readFileSync('.env.local', 'utf8');
  const line = raw.split(/\r?\n/).find(e => e.startsWith(name + '='));
  if (!line) throw new Error(name + ' not configured');
  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}

async function runTests() {
  console.log('==============================================');
  console.log('QC MANAGER — USER INSTRUCTIONS VERIFICATION');
  console.log('==============================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  ✓ PASS: ' + message);
      passed++;
    } else {
      console.error('  ✗ FAIL: ' + message);
      failed++;
    }
  }

  // 1. User Instruction 1: Late Join Calculation
  console.log('1. Testing Late Join with Extra Sign-Out Stay ("barti time"):');
  // Scenario A: 2 hours late, sign out in right time -> 2 hours late join
  const lj2h = calculateLeaveOrOvertime('Late Join', '15:00', '22:30', '13:00', '22:30');
  assert(lj2h === '02:00', 'Arrive 2h late (15:00), Out on time (22:30) -> Expected 02:00, got ' + lj2h);

  // Scenario B: 2 hours late, sign out 1 hour after actual sign out time -> 1 hour late join
  const lj1h = calculateLeaveOrOvertime('Late Join', '15:00', '23:30', '13:00', '22:30');
  assert(lj1h === '01:00', 'Arrive 2h late (15:00), Out 1h extra (23:30) -> Expected 01:00, got ' + lj1h);

  // Scenario C: 2 hours late, sign out 2 hours after actual sign out time -> 0 hours late join
  const lj0h = calculateLeaveOrOvertime('Late Join', '15:00', '00:30', '13:00', '22:30');
  assert(lj0h === '00:00', 'Arrive 2h late (15:00), Out 2h extra (00:30) -> Expected 00:00, got ' + lj0h);

  // Scenario D: Arriving on time or early -> 00:00
  const ljEarly = calculateLeaveOrOvertime('Late Join', '12:30', '22:30', '13:00', '22:30');
  assert(ljEarly === '00:00', 'Arrive before shift start -> Expected 00:00, got ' + ljEarly);

  // 2. User Instruction 2: Early Leave with Early Arrival
  console.log('\n2. Testing Early Leave with Early Arrival Offset:');
  // Scenario A: Normal sign in in right time, sign out 2 hours before sign out time -> 2 hours early leave
  const el2h = calculateLeaveOrOvertime('Early Leave', '13:00', '20:30', '13:00', '22:30');
  assert(el2h === '02:00', 'In right time (13:00), Out 2h early (20:30) -> Expected 02:00, got ' + el2h);

  // Scenario B: Sign in 1 hour before actual shift time, sign out 2 hours before sign out time -> 1 hour early leave
  const el1h = calculateLeaveOrOvertime('Early Leave', '12:00', '20:30', '13:00', '22:30');
  assert(el1h === '01:00', 'In 1h early (12:00), Out 2h early (20:30) -> Expected 01:00, got ' + el1h);

  // Scenario C: Sign in 2 hours before actual shift time, sign out 2 hours before sign out time -> 0 hours early leave
  const el0h = calculateLeaveOrOvertime('Early Leave', '11:00', '20:30', '13:00', '22:30');
  assert(el0h === '00:00', 'In 2h early (11:00), Out 2h early (20:30) -> Expected 00:00, got ' + el0h);

  // Scenario D: Leaving at scheduled shift end -> 00:00
  const elOnTime = calculateLeaveOrOvertime('Early Leave', '13:00', '22:30', '13:00', '22:30');
  assert(elOnTime === '00:00', 'Out at shift end (22:30) -> Expected 00:00, got ' + elOnTime);

  // 3. User Instruction 4: Admin Quotes Workspace OFF permissions
  console.log('\n3. Testing Admin Quotes Workspace OFF:');
  const mockAdminWithQuotesOff = {
    id: 'admin-quotes-off-test',
    role: 'admin',
    has_quotes_access: false,
    has_chuti_access: true,
    has_todo_access: true,
  };
  const adminCanSeeLeaderboard = canAccessModule(mockAdminWithQuotesOff, null, 'leaderboard');
  assert(adminCanSeeLeaderboard === true, 'Admin with Quotes OFF can see Leaderboard -> got ' + adminCanSeeLeaderboard);

  const adminCanSeeAllReport = canAccessModule(mockAdminWithQuotesOff, null, 'all_report');
  assert(adminCanSeeAllReport === true, 'Admin with Quotes OFF can see All Report -> got ' + adminCanSeeAllReport);

  // 4. Timezone Formatting in Asia/Dhaka (+06:00)
  console.log('\n4. Testing Asia/Dhaka (+06:00) Localization:');
  const formattedDate = formatDate('2026-06-30T19:00:00.000Z');
  assert(formattedDate === '01-07-2026', '2026-06-30T19:00:00Z formatted in Dhaka -> Expected 01-07-2026, got ' + formattedDate);

  const formattedTime = formatTimeToAMPM('2026-06-30T19:00:00.000Z');
  assert(formattedTime.includes('01:00') && formattedTime.includes('AM'), '2026-06-30T19:00:00Z formatted in Dhaka -> Expected 01:00 AM, got ' + formattedTime);

  // 5. Live Database Verification
  console.log('\n5. Testing Live Database (Triggers & RPCs):');
  const client = new pg.Client({
    connectionString: getEnvValue('SUPABASE_DB_URL'),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  await client.query('BEGIN');
  const pRes = await client.query("SELECT id, username FROM public.profiles WHERE role = 'admin' LIMIT 1");
  const adminId = pRes.rows[0].id;
  const adminCode = pRes.rows[0].username;

  const insRes = await client.query(
    'INSERT INTO public.records (user_id, file_name, branch_name, codename, file_type, submitted_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING file_type;',
    [adminId, 'AUDIT-VERIFY-TRIGGER', 'Main', adminCode, 'Requote Bike']
  );
  assert(insRes.rows[0].file_type === 'Requote', 'Trigger normalized Requote Bike to Requote on insert -> got ' + insRes.rows[0].file_type);

  const lbRes = await client.query(`
    SELECT count(*) FROM public.get_leaderboard_data(
      p_year => '2026',
      p_month => '07',
      p_period => 'monthly',
      p_today => '2026-07-15',
      p_tz => 'Asia/Dhaka'
    );
  `);
  assert(parseInt(lbRes.rows[0].count, 10) > 0, 'get_leaderboard_data executed successfully with Asia/Dhaka -> got ' + lbRes.rows[0].count + ' rows');

  await client.query(`SET LOCAL request.jwt.claim.sub = '${adminId}'`);
  await client.query(`SET LOCAL "request.jwt.claims" = '{"sub": "${adminId}"}'`);

  const ssRes = await client.query(`
    SELECT * FROM public.get_admin_sales_summary(
      p_today => '2026-07-15',
      p_tz => 'Asia/Dhaka'
    );
  `);
  assert(ssRes.rows.length === 1, 'get_admin_sales_summary executed successfully with Asia/Dhaka -> got 1 summary row');

  await client.query('ROLLBACK');
  await client.end();

  console.log('\n==============================================');
  console.log('SUMMARY: ' + passed + ' PASSED, ' + failed + ' FAILED');
  console.log('==============================================');
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
