# Dead Code + Duplication Audit — Final Report

Date: 2026-07-17 · Branch: `main` (clean tree, 6 commits ahead of origin)
Method: `tsc --noUnusedLocals --noUnusedParameters` (re-run and diffed — identical to first pass), cross-file unused-export scan (grep-based, verified by hand), commented-out-code scan (0 hits even at a 5-line threshold), and `jscpd` clone detection (min 70 tokens / 8 lines, `database.types.ts` excluded). Every finding below was spot-checked against the codebase; dynamic-import and RPC/SQL usage was checked before calling anything dead.

---

## 1. Dead files (entire file unreferenced — safe to delete)

| File | Lines | Evidence |
|---|---|---|
| `src/components/leaderboard-and-reports/EmployeeRankBadge.tsx` | 20 | No import anywhere (static or dynamic) |
| `src/components/leaderboard-and-reports/RankingChip.tsx` | 43 | No import anywhere |
| `src/utils/downloadHelper.ts` | 46 | No import anywhere (`DownloadPlatform`, `downloadLatestRelease` both unused) |

**Not dead — do not delete:**
- `src/types/database.types.ts` — zero imports today, but it was added intentionally in commit `05c169a` ("initial TypeScript database type definitions") and is presumably about to be wired into `src/utils/supabase.ts` (`createClient<Database>`). Flagging as **dormant, keep**. If you don't plan to wire it in, delete it — right now it contributes nothing.
- `src/hooks/common/useAppReleaseLinks.ts` — imported by `login/page.tsx` but the import is unused there (see §2). If that import is removed the hook becomes dead → candidate for deletion in the same pass.

## 2. Unused exports (file alive, export dead)

Verified: identifier appears nowhere outside its defining file (and isn't used internally as an export dependency).

- `src/utils/leaderboardHelper.ts:15,56` — `getLeaderboardForMonth`, `calculateTopPerformerBadges`. Only used by each other inside the file. Badge computation moved server-side (`sync_top_performer_badges` RPC — see `supabase/fix_badge_sync_noop_updates.sql`), leaving these client copies orphaned. The file must stay for `BadgeInfo` (6 importers), but these two functions (~120 lines) can go — **largest single dead-code win**.
- `src/providers/NetworkProvider.tsx:19` — `useNetwork` hook exported but no consumer (provider itself is mounted in `layout.tsx`; keep the provider, drop the hook or keep as public API — your call).
- Type-only unused exports (zero runtime cost, cleanup optional): `RealtimeTable`, `RealtimeHandler` (used internally, just needn't be exported), `ReleaseLinks`, `UseDeviceInfoResult`, `AsitisCausalityPanelProps` / `EUICausalityPanelProps` (used internally), `DeviceOS`, `DeviceArch`, `DeviceType`, `LinuxDistro`, `AdminFine`, `PendingRecordAction` (used internally), `AvailableDate` (used internally), `BACKFILL_MONTH` (used internally).
  → For the "used internally" ones the fix is just removing the `export` keyword.

**False positives from the raw scan (confirmed in-use — leave alone):** `calculateRemainingDaysForCategoryPeriod` (used at `AdminSettlementsPanel.tsx:200`), `isMobileApp` (used at `apiUrlHelper.ts:32`), `isSupervisedTeam` / `isDirectlySupervised` (used inside `permissionService.ts`), `parseTimeToMinutes` (6 internal uses), `InsuranceDatabase` (typing for `INSURANCE_DATABASE` which is imported).

## 3. Unused locals/imports (157 findings, `tsc` verified twice — identical results)

Full list: 157 `TS6133`/`TS6196` hits. Highlights by bucket:

- **Vestigial `React` default imports** (~12 files): `DeleteConfirmModal`, `UserNotificationsModal`, `AppUpdater`, `LeaveApprovalPanel`, all 7 `Admin*Modal` files, `AdjustmentModal`, `downloads/page` — automatic JSX runtime makes these dead.
- **Dead lucide-react icon imports** (~15): `Monitor`/`Apple` (login, page, Navbar), `Download`, `TrendingUp`, `Calendar`, `Check`, `Database`, `Edit2`, `Trash2`, `Info`, `Loader2`, `Lock`, `Bell`, `User`, `Settings`, `ScrollText`, `Save`.
- **`DashboardModals.tsx` — 44 unused destructured props** (lines 31–271). This is the single noisiest file: it accepts a huge props object and uses barely half. The props should be pruned from both the interface and the call site in `page.tsx` — this also shrinks re-render surface.
- **Dead computed values that still cost CPU per render**: `UserLeaveHistoryPanel.tsx` computes `officeLeaveStatsObj`, `adjustedGovtHolidayStats`, `halfYearlyStats`, `eidFitrRemaining`, `eidAdhaRemaining`, `respondedHolidays` (lines 112–159) and never renders them. Same pattern in `UserKpiPerformancePanel.tsx` (`years`, `staffGlobalEmpId`, `staffGlobalDoj`, `isDirty`), `AdminDashboardView.tsx` (`viewingProfile` + 10 unused props), `LeaveUsageSummary.tsx` (`officeTotalDisplay`), `AddLeave.tsx` (`supervisors`, `isAdminRole`), `useChutiOperations.ts` (14 dead destructured vars across notification payload builders).
- **Dead dead-ends**: `forgot-password/route.ts:115-118` builds `adminIds`/`title`/`notificationBody` and never sends them (remnant of removed push-notification flow — matches `supabase/remove_push_notifications.sql`); `AppUpdater.tsx` `dismissed`/`handleRestartNow`; `QuoteRulesPanel.tsx` `handleDeleteRule` (a fully-implemented but unreachable feature); `EditProfileModal.tsx` `hasChutiAccess` state pair; `useAppReleaseLinks` import in `login/page.tsx:17`.

Full machine-readable list preserved at the scratchpad (`tsc-unused-fresh.txt`).

## 4. Commented-out code

**None.** Zero blocks ≥5 consecutive code-like comment lines across `src/` and `scripts/`. This dimension is clean.

## 5. Duplication (jscpd: 130 exact clones, 2,443 duplicated lines = 4.13% of src)

Ranked by consolidation value:

1. **`offlineSync.ts` ↔ `quotesOfflineSync.ts` — 18 clones, ~360 duplicated lines.** These are near-parallel IndexedDB sync engines (leave vs quotes). The clone map covers open/save/get/delete/merge/cache helpers end-to-end. → Extract a generic `createOfflineStore(dbName, storeConfig)` factory; both files become thin config wrappers. Highest-value refactor in the codebase; also halves the surface where sync bugs must be fixed twice.
2. **`AsitisCausalityPanel.tsx` ↔ `EUICausalityPanel.tsx` — 8 clones, ~250 lines** (imports, data fetch, table rendering, pagination all cloned; the EUI panel even self-clones at 495-561). → One `CausalityPanel` component parameterized by insurer config. The unused exported `*Props` interfaces (§2) confirm they were meant to converge.
3. **`useChutiOperations.ts` — 8 internal clones, ~180 lines**: the approve/reject/cancel notification-payload builders (lines 714–1085) repeat the same fetch-supervisor → format-dates → build-payload block 4×. Note the dead vars from §3 sit exactly inside these clones — dedup and dead-var cleanup are the same edit. → Extract `buildLeaveNotificationPayload(record, action)`.
4. **`exportHelper.ts` — 11 internal clones, ~190 lines**: repeated table-header/row-styling blocks across Excel/PDF export variants (248-270 vs 486-508, 794-808 ×3, etc.). → Extract shared column/style constants.
5. **`app/quotes/page.tsx` ↔ `UserQuotesHistoryPanel.tsx` — 5 clones, ~120 lines**: records-table rendering + stats cards duplicated between the live dashboard and the admin history panel. → Shared `QuotesRecordsTable` component.
6. **`UserNotificationsModal.tsx` — 6 self-clones (~110 lines)**: the same notification-row markup repeated per category. → Map over a config array.
7. **`UserKpiPerformancePanel.tsx:1839-1939 ↔ 1958-2058` — the single largest clone (101 lines)**: identical KPI table body rendered twice (screen vs print variant, differing only in a department field). → Extract row component.
8. Lesser but real: `AddLeave.tsx` self-clones + clones into `AdminAddLeaveModal` (~80 lines); `LeaveApprovalPanel` self-clones (~60); `TeamLeaveRecords` (~35); `useDashboardData` internal + `useQuotesTheme`/`useGlobalNotifications`/`useDerivedState` shared theme/notification snippets (~80); skeleton components' internal repeats (cosmetic); API route auth preamble cloned across 3 routes (16 lines — extract a `requireAdmin()` helper).

## 6. Recommended action order

1. Delete 3 dead files + the 2 dead `leaderboardHelper` functions (~230 lines, zero risk).
2. Mechanical sweep of the 157 unused locals/imports (aligns with the 174 eslint `no-unused-vars` warnings already reported in the v6.0.0 QA report; gets lint meaningfully closer to clean). Remove the `useAppReleaseLinks` import, then delete the hook file too.
3. Prune `DashboardModals` 44-prop interface (also a render-perf win).
4. Refactors, by ROI: offline-sync factory → CausalityPanel merge → chuti notification-payload helper → exportHelper constants → shared QuotesRecordsTable.
5. Decide on `database.types.ts`: wire `createClient<Database>` into `src/utils/supabase.ts` or delete the file.

Verification after cleanup: `next build` + `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` should both come back clean; re-run `npx jscpd src` to confirm the duplication % drops (expect ~4.1% → ~2.5% after items 1–4).
