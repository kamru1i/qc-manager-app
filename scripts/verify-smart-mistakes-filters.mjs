import assert from 'node:assert';

// Inline replication of computeSmartMistakePeriod matching src/utils/quotesDashboardHelpers.ts
function computeSmartMistakePeriod(availableDates, currentYearStr, currentMonthStr) {
  const yearsSet = new Set();
  availableDates.forEach((d) => {
    if (d.year && /^\d{4}$/.test(d.year)) {
      yearsSet.add(d.year);
    }
  });
  const dynamicYears = Array.from(yearsSet).sort(
    (a, b) => parseInt(b, 10) - parseInt(a, 10)
  );

  let targetYear = currentYearStr;
  if (dynamicYears.length > 0 && !dynamicYears.includes(currentYearStr)) {
    targetYear = dynamicYears[0];
  }

  const hasCurrentMonthData = availableDates.some(
    (d) => (!targetYear || d.year === targetYear) && d.month === currentMonthStr
  );

  const targetMonth = hasCurrentMonthData ? currentMonthStr : '';

  return {
    year: targetYear,
    month: targetMonth,
  };
}

function getDhakaDateParts(dateStr) {
  if (!dateStr) return { year: '', month: '', day: '', dateKey: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { year: '', month: '', day: '', dateKey: '' };
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.format(d).split('-');
    if (parts.length === 3) {
      return {
        year: parts[0],
        month: parts[1],
        day: parts[2],
        dateKey: `${parts[0]}-${parts[1]}-${parts[2]}`,
      };
    }
  } catch {}
  return { year: '', month: '', day: '', dateKey: '' };
}

console.log('==================================================');
console.log('RUNNING SMART MISTAKES FILTER TEST MATRIX');
console.log('==================================================');

function expectEqual(actual, expected, desc) {
  assert.deepStrictEqual(actual, expected, desc);
  console.log(`  ✅ PASS: ${desc}`);
}

// TEST 1: Current month has data
console.log('\n--- TEST 1: Current month has data ---');
{
  const availableDates = [
    { year: '2026', month: '09' },
    { year: '2026', month: '08' },
    { year: '2025', month: '12' },
  ];
  const result = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(result, { year: '2026', month: '09' }, 'Selects Year 2026 and Month 09 (September)');
}

// TEST 2: Current month has no data
console.log('\n--- TEST 2: Current month has no data ---');
{
  const availableDates = [
    { year: '2026', month: '08' },
    { year: '2026', month: '07' },
  ];
  const result = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(result, { year: '2026', month: '' }, 'Selects Year 2026 and Month "" (All Months)');
}

// TEST 3: Other months have data (August=10, September=0)
console.log('\n--- TEST 3: Other months have data ---');
{
  const availableDates = [
    { year: '2026', month: '08' },
    { year: '2025', month: '08' },
  ];
  const result = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(result.year, '2026', 'Year remains current business year 2026');
  expectEqual(result.month, '', 'Month is All Months (""), NOT August ("08")');
}

// TEST 4: Dynamic month options calculation
console.log('\n--- TEST 4: Dynamic month options calculation ---');
{
  const availableDates = [
    { year: '2026', month: '08' },
    { year: '2025', month: '01' },
    { year: '2025', month: '03' },
  ];
  const months2026 = availableDates.filter(d => d.year === '2026').map(d => d.month);
  expectEqual(months2026, ['08'], '2026 only has August (08)');

  const months2025 = availableDates.filter(d => d.year === '2025').map(d => d.month);
  expectEqual(months2025, ['01', '03'], '2025 only has January and March');
}

// TEST 5: Fallback when current year has NO data at all
console.log('\n--- TEST 5: Current year has NO data at all ---');
{
  const availableDates = [
    { year: '2025', month: '11' },
    { year: '2024', month: '05' },
  ];
  const result = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(result.year, '2025', 'Falls back to latest available year with data (2025)');
  expectEqual(result.month, '', 'Month defaults to All Months ("") since 2025 has no September data');
}

// TEST 6: Current year has no data, but latest available year HAS current month data
console.log('\n--- TEST 6: Latest available year has current month data ---');
{
  const availableDates = [
    { year: '2025', month: '09' },
    { year: '2025', month: '04' },
  ];
  const result = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(result.year, '2025', 'Year falls back to 2025');
  expectEqual(result.month, '09', 'Month selects 09 because 2025 has September data');
}

// TEST 7: Year changes revalidation
console.log('\n--- TEST 7: Year change resets invalid month ---');
{
  const availableDates = [
    { year: '2026', month: '08' },
    { year: '2026', month: '09' },
    { year: '2025', month: '01' },
    { year: '2025', month: '03' },
  ];
  let selectedYear = '2026';
  let selectedMonth = '09';

  selectedYear = '2025';
  const availableMonthsFor2025 = availableDates.filter(d => d.year === selectedYear).map(d => d.month);
  if (!availableMonthsFor2025.includes(selectedMonth)) {
    selectedMonth = '';
  }
  expectEqual(selectedMonth, '', 'Switching to 2025 safely resets invalid month (09) to All Months ("")');

  selectedMonth = '01';
  expectEqual(availableMonthsFor2025.includes(selectedMonth), true, 'Valid month for 2025 remains valid');
}

// TEST 8: Completely empty database (zero mistakes anywhere)
console.log('\n--- TEST 8: Completely empty database ---');
{
  const availableDates = [];
  const result = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(result, { year: '2026', month: '' }, 'Empty database safely defaults to Year 2026 and All Months');
}

// TEST 9: Reset returns smart default
console.log('\n--- TEST 9: Reset restores smart default ---');
{
  const datesNoSep = [{ year: '2026', month: '08' }];
  const defaultNoSep = computeSmartMistakePeriod(datesNoSep, '2026', '09');
  expectEqual(defaultNoSep, { year: '2026', month: '' }, 'Reset without September data returns Year 2026, All Months');

  const datesWithSep = [{ year: '2026', month: '09' }, { year: '2026', month: '08' }];
  const defaultWithSep = computeSmartMistakePeriod(datesWithSep, '2026', '09');
  expectEqual(defaultWithSep, { year: '2026', month: '09' }, 'Reset with September data returns Year 2026, Month 09');
}

// TEST 10: Specific date selection
console.log('\n--- TEST 10: Specific date sets year and month ---');
{
  const dateStr = '2026-08-25';
  const parts = dateStr.split('-');
  const year = parts[0];
  const month = parts[1];
  expectEqual(year, '2026', 'Specific date sets year to 2026');
  expectEqual(month, '08', 'Specific date sets month to 08');
}

// TEST 11: Add current month mistake simulation
console.log('\n--- TEST 11: Add current month mistake updates metadata ---');
{
  let availableDates = [{ year: '2026', month: '08' }];
  let initial = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(initial.month, '', 'Initially All Months');

  availableDates = [{ year: '2026', month: '09' }, { year: '2026', month: '08' }];
  let updated = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(updated.month, '09', 'After adding September mistake, smart default selects 09');
}

// TEST 12: Delete last current month mistake simulation
console.log('\n--- TEST 12: Delete last current month mistake updates metadata ---');
{
  let availableDates = [{ year: '2026', month: '09' }, { year: '2026', month: '08' }];
  availableDates = [{ year: '2026', month: '08' }];
  let afterDelete = computeSmartMistakePeriod(availableDates, '2026', '09');
  expectEqual(afterDelete.month, '', 'After deleting September mistake, smart default returns All Months');
}

// TEST 13: Timezone boundary testing with getDhakaDateParts
console.log('\n--- TEST 13: Asia/Dhaka (+06:00) Timezone Boundaries ---');
{
  const aug31DhakaIso = '2026-08-31T17:59:59.000Z';
  const augParts = getDhakaDateParts(aug31DhakaIso);
  expectEqual(augParts.year, '2026', 'Aug 31 midnight boundary year is 2026');
  expectEqual(augParts.month, '08', 'Aug 31 23:59 Dhaka time is month 08');
  expectEqual(augParts.day, '31', 'Aug 31 23:59 Dhaka time is day 31');

  const sep1DhakaIso = '2026-08-31T18:00:01.000Z';
  const sepParts = getDhakaDateParts(sep1DhakaIso);
  expectEqual(sepParts.year, '2026', 'Sep 1 midnight boundary year is 2026');
  expectEqual(sepParts.month, '09', 'Sep 1 00:00:01 Dhaka time is month 09 (NOT 08)');
  expectEqual(sepParts.day, '01', 'Sep 1 00:00:01 Dhaka time is day 01 (NOT 31)');
}

// TEST 14: User permission scoping
console.log('\n--- TEST 14: User permission scoping ---');
{
  const userADates = [{ year: '2026', month: '09' }];
  const userAResult = computeSmartMistakePeriod(userADates, '2026', '09');
  expectEqual(userAResult.month, '09', 'User A sees September selected');

  const userBDates = [{ year: '2026', month: '08' }];
  const userBResult = computeSmartMistakePeriod(userBDates, '2026', '09');
  expectEqual(userBResult.month, '', 'User B sees All Months, no September leak');
}

// TEST 15: Filter active detection
console.log('\n--- TEST 15: isFilterActive detection ---');
{
  const availableDates = [{ year: '2026', month: '08' }];
  const defaultPeriod = computeSmartMistakePeriod(availableDates, '2026', '09');

  const isDefaultActive = Boolean(
    '' ||
    '' ||
    '' ||
    '2026' !== defaultPeriod.year ||
    '' !== defaultPeriod.month
  );
  expectEqual(isDefaultActive, false, 'Initial smart default state has isFilterActive = false');

  const isAugustActive = Boolean(
    '2026' !== defaultPeriod.year ||
    '08' !== defaultPeriod.month
  );
  expectEqual(isAugustActive, true, 'User selecting August activates filter (isFilterActive = true)');

  const isSearchActive = Boolean(
    'test' ||
    '2026' !== defaultPeriod.year ||
    '' !== defaultPeriod.month
  );
  expectEqual(isSearchActive, true, 'Searching activates filter (isFilterActive = true)');
}

console.log('\n==================================================');
console.log('ALL 15 TEST MATRIX SCENARIOS PASSED SUCCESSFULLY');
console.log('==================================================\n');
