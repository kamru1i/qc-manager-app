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
  console.log('QC MANAGER — POST-AUDIT FIXES VERIFICATION');
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

  // 1. Late Join Calculation
  console.log('1. Testing Late Join Calculation (Sign-Out Independence):');
  const ljStandard = calculateLeaveOrOvertime('Late Join', '14:15', '22:30', '13:00', '22:30');
  assert(ljStandard === '01:15', 'Scheduled 13:00, Arrived 14:15, Out 22:30 -> Expected 01:15, got ' + ljStandard);

  const ljOverstay = calculateLeaveOrOvertime('Late Join', '14:15', '23:30', '13:00', '22:30');
  assert(ljOverstay === '01:15', 'Staying past shift end must NOT reduce late join -> Expected 01:15, got ' + ljOverstay);

  const ljEarlyLeave = calculateLeaveOrOvertime('Late Join', '14:15', '21:00', '13:00', '22:30');
  assert(ljEarlyLeave === '01:15', 'Leaving early must NOT increase late join -> Expected 01:15, got ' + ljEarlyLeave);

  const ljOnTime = calculateLeaveOrOvertime('Late Join', '12:55', '22:30', '13:00', '22:30');
  assert(ljOnTime === '00:00', 'Arriving on time/early -> Expected 00:00, got ' + ljOnTime);

  const ljOvernight1 = calculateLeaveOrOvertime('Late Join', '23:30', '06:00', '22:00', '06:00');
  assert(ljOvernight1 === '01:30', 'Overnight shift late join before midnight -> Expected 01:30, got ' + ljOvernight1);

  const ljOvernight2 = calculateLeaveOrOvertime('Late Join', '01:00', '06:00', '22:00', '06:00');
  assert(ljOvernight2 === '03:00', 'Overnight shift late join past midnight -> Expected 03:00, got ' + ljOvernight2);

  // 2. Early Leave Calculation
  console.log('\n2. Testing Early Leave Calculation (Sign-In Independence):');
  const elStandard = calculateLeaveOrOvertime('Early Leave', '13:00', '21:30', '13:00', '22:30');
  assert(elStandard === '01:00', 'Scheduled end 22:30, Left 21:30 -> Expected 01:00, got ' + elStandard);

  const elEarlyArrival = calculateLeaveOrOvertime('Early Leave', '11:00', '21:30', '13:00', '22:30');
  assert(elEarlyArrival === '01:00', 'Early arrival must NOT offset early leave -> Expected 01:00, got ' + elEarlyArrival);

  const elLateArrival = calculateLeaveOrOvertime('Early Leave', '15:00', '21:30', '13:00', '22:30');
  assert(elLateArrival === '01:00', 'Late arrival must NOT affect early leave -> Expected 01:00, got ' + elLateArrival);

  const elNormalEnd = calculateLeaveOrOvertime('Early Leave', '13:00', '22:30', '13:00', '22:30');
  assert(elNormalEnd === '00:00', 'Leaving at/after scheduled end -> Expected 00:00, got ' + elNormalEnd);

  const elOvernight = calculateLeaveOrOvertime('Early Leave', '22:00', '04:30', '22:00', '06:00');
  assert(elOvernight === '01:30', 'Overnight shift early leave -> Expected 01:30, got ' + elOvernight);

  // 3. Timezone Formatting in Asia/Dhaka (+06:00)
  console.log('\n3. Testing Asia/Dhaka (+06:00) Localization:');
  const formattedDate = formatDate('2026-06-30T19:00:00.000Z');
  assert(formattedDate === '01-07-2026', '2026-06-30T19:00:00Z formatted in Dhaka -> Expected 01-07-2026, got ' + formattedDate);

  const formattedTime = formatTimeToAMPM('2026-06-30T19:00:00.000Z');
  assert(formattedTime.includes('01:00') && formattedTime.includes('AM'), '2026-06-30T19:00:00Z formatted in Dhaka -> Expected 01:00 AM, got ' + formattedTime);

  // 4. Permission Decoupling for Leaderboard
  console.log('\n4. Testing Permission Decoupling for Leaderboard:');
  const mockUserWithoutQuotes = {
    id: 'user-no-quotes',
    role: 'user',
    has_quotes_access: false,
    has_chuti_access: true,
    has_todo_access: true,
  };
  const canViewLeaderboard = canAccessModule(mockUserWithoutQuotes, null, 'leaderboard');
  assert(canViewLeaderboard === true, 'User with Quotes OFF must be able to view Leaderboard -> got ' + canViewLeaderboard);

  const canViewAllReport = canAccessModule(mockUserWithoutQuotes, null, 'all_report');
  assert(canViewAllReport === false, 'User with Quotes OFF must NOT access all_report -> got ' + canViewAllReport);

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

  // Test admin sales summary by setting session auth uid to admin
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
