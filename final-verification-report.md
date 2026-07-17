# QC Manager v6.0.0 — FINAL VERIFICATION & PRODUCTION READINESS REPORT

Date: 2026-07-17 · Branch: `main` @ `be443ef` (clean tree, 6 commits ahead of origin)
Scope: final verification pass — verified prior fixes, ran fresh scans, reviewed Desktop/Android/CI-CD, dead code + duplication. Companion detail file: `dead-code-duplication-audit.md`. Prior findings baseline: `opus-4.8-report.md`.

---

## 1. Verification Report

### 1.1 Previously required changes (§11 of prior report) — ALL VERIFIED FIXED

| Prior issue                                                                      | Status                       | Evidence                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 C-NEW-1 — unthrottled leaderboard RPC on every records/profiles event         | ✅ **Fixed** (`03eed62`)     | `page.tsx:1042-1073` — 30s throttle with trailing timeout + unmount cleanup; records handler uses `throttledFetchGlobalRankings` (`:1076-1081`)                                                                                                                                                                                                |
| 🔴 C-NEW-1b — profiles handler fired RPC on heartbeat writes                     | ✅ **Fixed** (`06bcc04`)     | `page.tsx:1101-1121` — rank-field diffing (`username, full_name, role, has_quotes_access`) against cached previous row (correctly handles default REPLICA IDENTITY where `payload.old` only has the PK)                                                                                                                                        |
| 🔴 C-NEW-2 — `sync_top_performer_badges` rewrote ALL profile rows on every mount | ✅ **Fixed** (both halves)   | Client: once-daily localStorage guard `page.tsx:714-750`. SQL: `supabase/fix_badge_sync_noop_updates.sql` — badge-removal filtered to rows that HAVE a badge, assignment uses `IS DISTINCT FROM` → repeat runs are zero-rewrite, zero-realtime no-ops                                                                                          |
| ⚠️ R1/R2 — triple profiles state (3 full-table fetches)                          | ✅ **Fixed** (`d9a9a31`)     | `ProfilesContext.tsx` mounted at `page.tsx:417`; all three holders (`page.tsx:577`, `useDashboardData.ts:48`, `UserManagementDashboard.tsx:71`) and the quotes hook (`useQuotesDashboardData.ts:84`) proxy the context. **Zero** leftover `useState<Profile[]>` copies (grep-verified)                                                         |
| ⚠️ C4 — 26 `select('*')` calls                                                   | ✅ **Fixed** (`d9a9a31`)     | `src/utils/dbColumns.ts` — centralized column constants sourced from generated `database.types.ts`. Remaining `select("*")` count: **2**, both `{ count: 'exact', head: true }` (QuoteRulesPanel:303,433) — head requests, zero row egress. Per-staff panels now column-limited (`UserAnalyticsPanel.tsx:42`, `UserQuotesHistoryPanel.tsx:78`) |
| Optional — duplicate `fetchAvailableDates`                                       | ✅ **Fixed** (`0e795e3`)     | Extracted to `src/utils/availableDatesHelper.ts`, consumed by both hooks                                                                                                                                                                                                                                                                       |
| Optional — Tauri connectivity ping 12s                                           | ✅ **Fixed**                 | `NetworkProvider.tsx:93-95` — now 45s with explanatory comment (~1,900 pings/day/client, down from 7,200)                                                                                                                                                                                                                                      |
| Optional — schema drift                                                          | ✅ **Addressed** (`05c169a`) | `src/types/database.types.ts` generated from live DB via `supabase gen types --linked`; `dbColumns.ts` documents it as source of truth. `schema.sql` remains stale (known, memoized) — regeneration still recommended but no longer blocks anything                                                                                            |

### 1.2 Regressions

**None found.** All C1–C6/H2 era fixes remain intact (single `.channel()` call in `RealtimeContext.tsx`, DOM-event fan-out, throttles). `next build` passes clean (10 routes, 0 errors). `tsc --noEmit` clean.

### 1.3 Remaining (new) findings — none critical

- 🟡 **Mobile update check uses `!==` not semver-greater** (`AppUpdater.tsx:152`): if a row for an _older_ version were made newest in `mobile_app_versions`, clients would "update" (downgrade) to it. Low likelihood (CI inserts monotonically), zero egress impact. Optional hardening. — **Fixed** (`isNewerVersion()` semver comparison, tsc clean)
- 🟡 **`handleRestartNow` + `@capgo/capacitor-updater` path is dead code** (`AppUpdater.tsx:220-241` — flagged by tsc): the mobile flow launches the system APK installer directly and never calls it. The `dismissed` state pair is likewise unused. Safe cleanup. — **Fixed** (removed `handleRestartNow`, `dismissed`/`setDismissed`, `downloadedUpdateRef`; uninstalled `@capgo/capacitor-updater` and re-ran `cap sync android` — unused native plugin no longer ships in the APK; tsc + build clean)
- 🟡 Two `onAuthStateChange` listeners (page.tsx + useDashboardData) — pre-existing, cleaned up correctly, moderate duplicate-fetch on SIGNED_IN only. Unchanged from prior report; acceptable. — **Fixed** (new `src/utils/profileFetcher.ts` shares one in-flight own-profile SELECT per login; both listeners now call `fetchOwnProfileRow()` — 2 identical single-row queries per SIGNED_IN → 1; tsc clean)

## 2. Supabase Report

- **Egress**: the two confirmed amplifiers are closed (§1.1). Full-table profile fetch count per session: 3 → **1** (context-owned, IndexedDB-cache-first). All hot-path selects column-limited. Compliance rules now date-filtered (`be443ef`). Records scoped to current user for non-admins (`06bcc04`).
- **Realtime**: still exactly ONE channel (`RealtimeContext.tsx:99`, cleanup verified). Badge-sync no longer fans out N profile-UPDATE events per mount — with the SQL no-op fix, a repeat daily run emits **zero** events. Profile UPDATEs are inline-patched; INSERT/DELETE triggers a single shared refetch.
- **RPC**: `get_leaderboard_data` now throttled at 30s on the navbar path and 2s on the leaderboard hook (pre-existing). `sync_top_performer_badges` once/day/device. No other unthrottled RPC triggers found.
- **Polling inventory** (all cleanup verified): NetworkProvider 45s HEAD ping; AppUpdater 15-min (GitHub manifest on desktop / single-row Supabase query on mobile); localStorage-only 5s poll while password modal open. All acceptable.
- **Expected outcome**: the mounts × profiles × clients realtime amplification and the per-event leaderboard RPC storm are eliminated — the two paths that explained 196→212% egress and 70→80% realtime. Usage should trend down; monitor the Supabase dashboard over the next billing window to confirm.

## 3. React Report

- Hooks/cleanup: all timers, listeners, debounce refs cleaned up (incl. the new rankings throttle cleanup `page.tsx:1064-1068`). No rules-of-hooks violations (lint: 0 errors). No infinite loops; guard refs used consistently. Strict-Mode-safe channel lifecycle.
- Rerenders: ProfilesContext consolidation removes 2 redundant state copies and their update cascades. `DashboardModals.tsx` still takes 44 unused props (see dead-code report) — pruning is the one remaining measurable rerender win. — **Fixed** (pruned all 42 lint-flagged unused destructured values from the `dashboardData`/`adminStaffOps` context pulls — push-subscription pair, tab/staff setters, and the entire unused profile-settings-modal block; eslint on the file now 0 warnings; tsc + `next build` clean)
- 157 unused locals/imports remain (tsc-verified, list in `dead-code-duplication-audit.md`) — cosmetic, no runtime cost except a few dead computed values per render (`UserLeaveHistoryPanel`, `UserKpiPerformancePanel`).

## 4. Database Report

- Indexes: delta-sync single-column indexes present in repo SQL. v6.0.0's composite-index/pg_cron claims remain unverifiable from the repo (schema.sql stale) — regenerate `schema.sql` from live DB to close this.
- Triggers: `check_profile_updates` sound (bypass flag + role checks, no recursion). Badge-sync trigger interplay verified with the new no-op SQL.
- RLS: `USING (true)` on profiles/records = deliberate open-leaderboard tradeoff (unchanged).
- Hygiene (unchanged, non-blocking): most SECURITY DEFINER functions in repo SQL don't pin `search_path` (only `add_leaderboard_rpc.sql` does); `complete_profile_setup` RPC has no repo definition.

## 5. Refactor Report (measurable only — none blocking)

Detail + full clone map in `dead-code-duplication-audit.md`. jscpd: 130 clones, 4.13% duplication. Top ROI:

1. `offlineSync.ts` ↔ `quotesOfflineSync.ts` (~360 dup lines) → one IndexedDB store factory
2. `AsitisCausalityPanel` ↔ `EUICausalityPanel` (~250) → one parameterized panel
3. `useChutiOperations` notification-payload builder repeated 4× (~180)
4. Dead code: 3 dead files + 2 orphaned `leaderboardHelper` functions (~230 lines, zero-risk delete)

## 6. Desktop (Tauri) Report

- **Updater flow ✅ end-to-end coherent**: `latest.json` endpoint (tauri.conf.json) ← generated by CI with per-platform signatures parsed from `.sig` assets; minisign pubkey pinned; `downloadAndInstall` with progress → auto `relaunch()`. 15-min check + 3s startup check, guarded by `isCheckingRef`, timers cleaned up, dev-mode disabled.
- Tray/window lifecycle correct (close-to-tray, macOS activation policy + Reopen handling, Windows double-click restore). `createUpdaterArtifacts: true` matches the updater. Version aligned across `tauri.conf.json`/`Cargo.toml`/`package.json` (6.0.0).
- 🟡 Hardening (non-blocking): `"csp": null` in tauri.conf.json — a strict CSP is recommended for a webview app; `fs:scope allow **` + `fs:read-all/write-all` is maximally broad — scope to the directories the export/save features actually use. `tauri-private.key` sits in the repo directory (gitignored + untracked, verified) — move outside the repo.

## 7. Android (Capacitor) Report

- Config sane: appId matches Tauri identifier, `webDir: out`, https scheme. Manifest minimal-permission (**INTERNET + REQUEST_INSTALL_PACKAGES only**), FileProvider correctly configured for APK self-update, `launchMode="singleTask"`. minSdk 24 / targetSdk 36, versionCode 19 / versionName 6.0.0.
- Update flow: single-row version query → GitHub APK download with progress → system installer via FileOpener. Valid design for a sideloaded internal app.
- 🟡 Notes: release build has `minifyEnabled false` (larger APK, acceptable for internal distribution); no `signingConfig` in gradle — signing is done post-build in CI via zipalign+apksigner, which is correct and verified (`apksigner verify` + badging + size checks in the workflow). Remember to bump `versionCode` with each release (manual today).

## 8. CI/CD (GitHub Actions) Report

- Single well-structured workflow: 6-target Tauri matrix (fail-fast off) → Android APK (signed release with verified fallback to debug) → combine job that uploads assets, generates SHA256SUMS + `latest.json`, and registers the OTA bundle in `mobile_app_versions` with the service key.
- **Duplicate-asset handling ✅**: `deleteAssetIfExists` with deletion-propagation polling before every upload + retry-on-422 — re-runs won't produce duplicate assets.
- Robustness: upload retries (3×), sig→platform mapping covers all shipped targets incl. nsis variants, checksums computed locally where possible (avoids re-download).
- 🟡 Notes (non-blocking): workflow triggers on every push to main (not just tags) — every push rebuilds 6 desktop targets + APK and republishes; if that's not intended, gate release jobs on `startsWith(github.ref, 'refs/tags/')`. OTA registration failure is caught-and-logged, not failed — deliberate but means a partial release is possible; the log makes it visible.

## 9. Production Scores

| Area                             | Score      | Notes                                                                                           |
| -------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Build / type safety              | 10/10      | Clean build, tsc clean, generated DB types wired as column source-of-truth                      |
| React architecture               | 9/10       | Consolidated state/realtime; residual unused-prop noise only                                    |
| Supabase efficiency              | 9/10       | Both amplifiers closed; 1 profiles fetch; column-limited selects; all triggers throttled/diffed |
| Realtime architecture            | 9.5/10     | One channel, no-op-free badge sync, field-filtered handlers                                     |
| Database design                  | 7.5/10     | Sound; docked for stale schema.sql + unpinned search_path (unverifiable live-DB claims)         |
| Error handling                   | 9/10       | Boundary present, races guarded, offline paths cached                                           |
| Desktop (Tauri)                  | 8.5/10     | Solid updater + lifecycle; docked for null CSP + `**` fs scope                                  |
| Android (Capacitor)              | 8.5/10     | Minimal permissions, verified signing; manual versionCode, no minify                            |
| CI/CD                            | 9/10       | Idempotent, verified, complete; push-to-main trigger worth reviewing                            |
| Maintainability                  | 7.5/10     | 4.13% duplication + 157 unused locals; roadmap in audit file                                    |
| **Overall Production Readiness** | **8.8/10** | Up from 7.5 — both required changes landed and verified                                         |

## 10. Final Sign-Off

Both required changes from the prior audit (throttled/field-filtered leaderboard RPC; gated + no-op-free badge sync) are implemented and verified at the file/line and SQL level, along with every optional improvement (ProfilesContext, column constants, shared date-range util, 45s ping, generated DB types). Build, types, and lint are clean; no regressions; desktop, Android, and CI/CD flows are coherent end-to-end. Remaining items are hygiene (dead code, duplication refactors, CSP/fs-scope tightening, schema.sql regeneration) — none affects correctness, cost, or stability.

# ✅ APPROVED

(Ship it. Monitor Supabase egress/realtime over the next billing window to confirm the downward trend; the hygiene backlog is documented in `dead-code-duplication-audit.md` §6.)
