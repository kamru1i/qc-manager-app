import { RecordItem, Profile } from "@/types";

export interface BadgeInfo {
  userId: string;
  rank: number;
  badgeType: "blue" | "grey";
  monthName: string;
  consecutiveMonths: number;
  yearlyTopPerformances: number;
}

/**
 * Calculates leaderboard rankings for a specific month and year.
 */
export function getLeaderboardForMonth(
  records: RecordItem[],
  year: string,
  month: string, // '01' through '12'
  profilesList: Profile[],
) {
  const userCounts: Record<string, number> = {};

  // Count only records in the target month/year
  records.forEach((r) => {
    if (!r.submitted_at || !r.user_id) return;
    const date = new Date(r.submitted_at);
    const yStr = date.getFullYear().toString();
    const mStr = String(date.getMonth() + 1).padStart(2, "0");

    if (yStr === year && mStr === month) {
      userCounts[r.user_id] = (userCounts[r.user_id] || 0) + 1;
    }
  });

  // Map to list with details
  const list = profilesList.map((p) => {
    const count = userCounts[p.id] || 0;
    return {
      userId: p.id,
      name: p.full_name || p.username,
      codename: p.username.toUpperCase(),
      count,
    };
  });

  // Sort by count desc, then by codename asc for deterministic ordering
  return list
    .filter((u) => u.count > 0)
    .sort((a, b) => b.count - a.count || a.codename.localeCompare(b.codename));
}

/**
 * Computes all top performer badges (for the previous calendar month)
 * and calculates streaks and annual wins.
 */
export function calculateTopPerformerBadges(
  records: RecordItem[],
  profilesList: Profile[],
): Record<string, BadgeInfo> {
  const badges: Record<string, BadgeInfo> = {};
  if (records.length === 0 || profilesList.length === 0) return badges;

  const today = new Date();

  // Previous month parameters
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevYearStr = prevMonthDate.getFullYear().toString();
  const prevMonthStr = String(prevMonthDate.getMonth() + 1).padStart(2, "0");
  const prevMonthName = prevMonthDate.toLocaleString("default", {
    month: "long",
  });

  // Get previous month's rankings
  const lastMonthRankings = getLeaderboardForMonth(
    records,
    prevYearStr,
    prevMonthStr,
    profilesList,
  );

  // Top 5 users get badges
  const top5LastMonth = lastMonthRankings.slice(0, 5);

  // For each of the top 5, compute their streak and yearly stats
  top5LastMonth.forEach((user, index) => {
    const rank = index + 1;
    const badgeType = rank <= 3 ? ("blue" as const) : ("grey" as const);

    // Calculate Consecutive Months Streak ending at the previous month
    let consecutiveMonths = 0;
    const checkDate = new Date(prevMonthDate);

    while (true) {
      const checkYearStr = checkDate.getFullYear().toString();
      const checkMonthStr = String(checkDate.getMonth() + 1).padStart(2, "0");

      const rankings = getLeaderboardForMonth(
        records,
        checkYearStr,
        checkMonthStr,
        profilesList,
      );

      // Check if user is in the top 5 for this month
      const userRankIdx = rankings.findIndex((r) => r.userId === user.userId);
      if (userRankIdx >= 0 && userRankIdx < 5) {
        consecutiveMonths++;
        // Go back 1 month
        checkDate.setMonth(checkDate.getMonth() - 1);
      } else {
        break; // Streak broken
      }
    }

    // Calculate Yearly Top 5 Performances in the current year
    let yearlyTopPerformances = 0;
    const currentYear = today.getFullYear();
    for (let m = 0; m < 12; m++) {
      const checkYearStr = currentYear.toString();
      const checkMonthStr = String(m + 1).padStart(2, "0");

      const rankings = getLeaderboardForMonth(
        records,
        checkYearStr,
        checkMonthStr,
        profilesList,
      );

      const userRankIdx = rankings.findIndex((r) => r.userId === user.userId);
      if (userRankIdx >= 0 && userRankIdx < 5) {
        yearlyTopPerformances++;
      }
    }

    badges[user.userId] = {
      userId: user.userId,
      rank,
      badgeType,
      monthName: prevMonthName,
      consecutiveMonths,
      yearlyTopPerformances,
    };
  });

  return badges;
}
