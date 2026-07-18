// Shape of the top-performer badge stored in profiles.global_settings->top_performer_badge
// (computed server-side by the sync_top_performer_badges SQL function).
export interface BadgeInfo {
  userId: string;
  rank: number;
  badgeType: "blue" | "grey";
  monthName: string;
  consecutiveMonths: number;
  yearlyTopPerformances: number;
}
