# 🌟 QC Manager — Unified Office Leave Tracker & Quotes Manager

**Version 6.3.0** | A premium, modern, and high-performance desktop and web utility built with **Next.js (TypeScript)**, **Supabase (PostgreSQL)**, and **Tauri v2**. It integrates two comprehensive corporate workspaces under a single secure, role-based role management structure.

---

## 🚀 Workspace Ecosystem

The QC Manager consists of two primary corporate workspaces, accessible dynamically based on administrator-configured employee access permissions:

### 1. 📅 Leave Tracker Workspace (Chuti)

- **Sign-In / Sign-Out Panel**: One-click logging of daily attendances with customizable default shifts.
- **Live Work Hours Tracking**: Realtime calculation of daily office hours and active break durations.
- **Leave Submissions**: Request workflows for 4 distinct leave categories:
  - **Full Leave** (Annual leave and Eid vacation days)
  - **Short Leave** (Hourly personal absences)
  - **Overtime** (Logging of extra hours)
  - **Reserve Holiday** (E.g., working on official holidays to bank leave days)
- **Government Holiday Banners**:
  - Users with reserve capabilities enabled can choose between taking holiday pay ("Get Paid") or reserving it for future leave adjustment ("Reserve").
  - Users with reserve disabled automatically receive pay addition notifications (bypassing unnecessary screens and admin approvals).
- **Bulk Full Leave Submission**: Add up to 10 separate dates simultaneously using an interactive calendar panel. In supervisor/admin dashboards, these dates are grouped into a **single, unified action row** for one-click approval, rejection, or revision request.
- **Leave Deficit Adjustments**: Easily request adjustments using accrued overtime hours or reserve holidays to offset short leave deficits.

### 2. 📝 Quotes Manager Workspace

- **Compliance Audit Panel**: Conduct deep compliance rules checking on corporate document types (e.g. PDF/Excel quotes).
- **Rules & Configuration Engine**: Administrators and authorized managers can create, edit, or delete compliance checking rules, viewing execution histories.
- **Category Checklist Selector**: Permissions specify allowed document categories (e.g. Van, Bike) per staff account.
- **Can Manage Rules Permission**: Restricts compliance database edits to specific staff members (always allowed for Admins).

---

## 🔑 Administrative Control & Dashboard

A master control panel allows Administrators and Supervisors to oversee company-wide operations:

- **Employee 360° Profile Hub**: Clicking any staff in User Management opens a full hub — Leave History, Quotes History, KPI & Performance, and Profile Settings sub-tabs — for a complete employee overview.
- **Switchable Notification Panels**: Admins toggle between the Admin Approval Panel (detailed request cards) and their personal User Notification Panel. Session preference is remembered.
- **Inline User Configuration**: The old pop-up modals have been replaced by a premium inline settings page (`StaffSettingsForm`). Setting up a new staff account or editing an existing profile uses the exact same layout.
- **Circular UI Components**: All checkbox selectors (Leave settings, Govt Holidays, Overtime, Reserve, Can Manage Quote Rules) are styled as perfect circular inputs.
- **Smooth Slide Transitions**: Workspace access toggles feature premium sliding toggle track animations.
- **Standardized Field Heights**: All dropdown selectors and text fields are locked to consistent heights (`h-[36px]`) to align perfectly.
- **Password Setup Enforcement**: Users logging in with the default password `1234` are immediately presented with a credentials modal, blocking dashboard navigation until they specify a custom secure password.
- **Automatic 10-Minute Lockout**: New accounts must complete their profile within 10 minutes, backed by a persistent localStorage timestamp preventing timer bypass on reboot or window closing.
- **Cascading Profile Deletion**: Removing a user account triggers PostgreSQL cascade constraints to clean up all related attendance, leaves, rules, and push subscriptions.

---

## 📶 Offline-First & Realtime Architecture

- **PWA Service Worker (`sw.js`)**: Caches static assets for lightning-fast loading and offline availability. Restricts caching to GET requests to protect against cache poisoning.
- **IndexedDB Sync Storage (`offlineSync.ts`)**: Locally queues signs, sign-outs, and leaves when offline, syncing automatically once connection is restored.
- **Supabase Realtime Listeners**: Replication broadcasts instantly update metrics, list views, and tables on database changes without requiring manual refresh.
- **Tray Persistence (Tauri Desktop App)**: Minimizing or closing the app window hides it to the system tray, keeping it active in the background.

---

## 🛠️ Technology Stack

| Layer                   | Technologies Used                                                                           |
| :---------------------- | :------------------------------------------------------------------------------------------ |
| **Frontend**            | React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Lucide Icons                |
| **Database & Realtime** | Supabase (PostgreSQL), Postgres Row-Level Security (RLS), Triggers, Cascades, RPC Functions |
| **Desktop Wrapper**     | Tauri v2, Rust Core                                                                         |

---

## 💻 Local Development Setup

### 1. Prerequisites

- Node.js (v20 or higher)
- Rust (v1.75+ for Tauri desktop compilation)
- A Supabase database project

### 2. Database Setup

Execute the unified SQL script inside your Supabase project's SQL editor:

1.  Run the entire content of `supabase/schema.sql` (Initializes profiles, attendance tables, constraints, cascade rules, RLS policies, and database triggers).

### 3. Environment Config

Create a `.env.local` file in the project root:

```env
# Supabase Keys
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Build & Run Commands

```bash
# Install NPM dependencies
npm install

# Run dev mode (Web browser)
npm run dev

# Run dev mode (Tauri Desktop App)
npm run tauri dev

# Check TypeScript compilations
npx tsc --noEmit

# Compile production web files
npm run build

# Compile native desktop installer
npm run tauri build
```

## 📜 Version History / Changelog
### 🚀 v6.2.0 — Multi-Device & Copy Helper Release (Current)

- **Multi-Device Login:** A user can now stay logged in simultaneously on Web, Desktop, and Android (up to 10 devices/browsers). Every per-device logout path (manual logout, inactivity expiry, stale-session cleanup, session eviction) now uses `signOut({ scope: 'local' })` — previously the global default revoked every device's refresh token, forcing all other devices out. Account deletion and the first-time-password timeout intentionally remain global sign-outs.
- **Copy Helper for All Users:** The Copy Helper dashboard is now available to every authenticated user (previously hardcoded to the superadmin). Box visibility is driven by the **Sale** file-type permission (User Management → Profile Settings → File Type Permissions) with fully dynamic box numbering: with Sale permission users see Session Info, Sales Summary, Quick Copy Actions, Detailed Report, and the new Admin Sales Summary; without it, only the Detailed Report (as Box 1). Save File remains superadmin-only.
- **Admin Sales Summary (New):** "Sales Report for Admin" box showing today's overall deduplicated sales across all users, computed server-side via a new `get_admin_sales_summary` RPC (SECURITY DEFINER, aggregate-only, partial-indexed). Episode-based dedup: duplicate submissions of a file count once, a Sold submission absorbs prior Unsold attempts, and re-processing a sold file counts as a new attempt — so two Sold entries for the same file name are two sales.
- **Navbar Rank Accuracy:** The rank badge next to the user's name now always matches the Leaderboard page. Removed the stale top-performer-badge rank fallback (which briefly showed last month's "#1") and a client-side rank recomputation that raced the leaderboard RPC — the RPC-fed cache is now the single source of truth; the label stays hidden until the real rank arrives.
- **Bundle Optimization:** The Word-document converter (`html-docx-ts` + JSZip) now lazy-loads on first save instead of shipping in the initial /quotes bundle (largest initial chunk 556 KB → 384 KB); `apple-touch-icon.png` right-sized 392 KB → 6 KB. Faster startup on Web, Desktop, and Android.
- **Lint Hygiene:** Excluded Capacitor build output from ESLint (eliminated ~12,000 false findings) and configured the unused-vars rule to honor the `_`-prefix convention — lint is now 0 errors with a clean, meaningful warning set.

### 🚀 v6.1.0 — Stability & Hardening Release

- **Leaderboard Data Accuracy:** Removed 4,200 duplicate records caused by a faulty cache auto-restore, added a database unique index on `records (user_id, file_name, submitted_at)` so duplicate uploads are rejected at the database level, and removed the auto-restore code entirely. Monthly, yearly, and today leaderboard columns now reflect exact submission counts, fully decoupled from each other.
- **Expanded Working Hours (4h–10h):** Working Hours options now span 4 Hours to 10 Hours in 30-minute increments, generated from a single shared source of truth (`src/utils/workingHours.ts`) consumed by Profile Setup, Profile Settings, and Admin/Supervisor user management. Short Leave and Overtime calculations verified across the full range.
- **Save File Helper — Once-Per-Day Directory:** Fixed the duplicate folder prompt: manual folder selection and "Save As" now share one persisted daily directory, so users are asked at most once per day (resets the next day).
- **Realtime Resilience:** Server-closed realtime channels now automatically resubscribe with exponential backoff (previously the app silently lost live updates until reload), and misleading `CLOSED undefined` console noise was eliminated.
- **Desktop (Tauri) Hardening:** Strict Content-Security-Policy (was `null`), filesystem permissions narrowed to write-only via save dialogs (removed `fs:read-all`/`fs:write-all`), and the update-signing key relocated outside the repository.
- **Android Improvements:** R8 code shrinking + resource shrinking enabled (APK 4.67 MB → 2.59 MB, −45%) with verified Capacitor plugin keep-rules; `versionCode` now derives automatically from the app version (no more manual bumps).
- **CI/CD Safety:** Release workflow now triggers only on `v*` tags (plus manual dispatch) instead of every push to main; OTA registration failures and missing OTA bundles now fail the release loudly instead of passing silently.

### 🚀 v6.0.0 — Major Performance Release

- **Supabase Optimization:** Implemented strict PostgreSQL query filtering inside profile handlers. Prevents cascade fetches on user session ticks and heartbeats, reducing bandwidth and server overhead.
- **Client-Side Query Cleanup:** Removed client-side log deletion queries on activity writes, migrating old-log cleanups to database-side scheduled events.
- **Supabase Performance Tuning:** Deployed database composite indexes for `records`, `chuti`, and `audit_logs` tables to maximize lookup speeds.
- **Automated Database Cleanups:** Scheduled a daily background cron job inside Supabase to automatically purge audit history older than 90 days.

### 🚀 v5.0.13 — Patch Release

- **Open Submission Leaderboard & Role Restricting:** Opened the Performance Analytics leaderboard (A-Z rank list of everyone's submissions) to all logged-in roles. Restricted key charts, branch metrics, and summary conversion insights to Admins and Supervisors only.
- **Dynamic Username Ranks (#XX):** Implemented all-time running submission ranking next to user display names (e.g. `Name #01`). Ranks dynamically re-calculate in real-time as users submit files.
- **AppUpdater Native Restrictions:** Restricted client-side update alerts exclusively to native Tauri and Capacitor apps, preventing updates from checking on web browser views.

### 🚀 v5.0.12 — Patch Release

- **CORS Configuration Fix:** Allowed dynamic CORS origin mapping on backend routes to fully resolve forgotten password failures across all client environments (localhost, web views, and custom domains).
- **Tauri v2 Auto-Updater Fixes:** Added support for discovering and matching `.nsis.zip` and `.msi.zip` packages in release manifest generator. Fixed target URL mappings in generated `latest.json` file.

### 🚀 v5.0.11 — Patch Release

- **Clean Recommended Installer Button Labels:** Standardized the download button text to clean, minimal OS and Distro names (e.g., "Download for macOS", "Download for Windows", "Download for Android", "Download for Ubuntu", "Download for Fedora"), removing cluttered hardware and architecture info (like Apple Silicon/Intel/64-bit) from the main button.
- **Dynamic GitHub Asset Size Resolution:** Implemented real-time release size and download URL fetching from the GitHub Releases API (falling back to the latest public release if the current tag isn't yet published), guaranteeing that sizes are accurately populated.
- **Broadened Apple Silicon Architecture Descriptions:** Explicitly documented support for Apple Silicon (M1/M2/M3/M4/M5 & newer) and future M-series chips on both the download button metadata and the "All Available Releases" list.

### 🚀 v5.0.10 — Patch Release

- **Removed Global Body Safe-Area Spacing:** Removed top, bottom, left, and right safe-area paddings from the global `body` style in `globals.css` to prevent double spacing / blank white gaps below the status bar on mobile platforms.

### 🚀 v5.0.9 — Patch Release

- **Centered Responsive Filters on Mobile:** Repositioned and centered the Month and Year selector inputs directly underneath the Yearly/Monthly toggle switcher on mobile viewports for full layout alignment.
- **Supervisor Read-Only Profile Permissions:** Supervisors can now read the leave tracker workspace settings of all team members while keeping it secure and read-only.
- **Improved Navbar Padding:** Removed extra safe-area status bar spacing for native app headers.
- **Button Styling Alignment:** Updated exit app modals and connection error overlays to align with the premium blue/indigo gradient styling.

### 🚀 v5.0.8 — Patch Release

- **In-App APK Installer for Android:** Implemented native APK download and automated in-app installation flow using `@capacitor/filesystem` and `@capacitor-community/file-opener`.
- **Dynamic Safe-Area Spacing Fix:** Resolved double-spacing margins and padding-top overlap bugs by querying status bar overlay state (`StatusBar.getInfo().overlays`) and dynamically adjusting components.

### 🚀 v5.0.7 — Patch Release

- **Context Menu Viewport Bounding:** Implemented dynamic window viewport collision detection for the leave tracker table's context menu, positioning it upwards/leftwards when long-pressed on trailing or bottom rows to prevent overflow cropping.

### 🚀 v5.0.6 — Patch Release

- **Native Interactions Integration:** Added swipe-to-refresh gesture listeners and a custom hardware back button app exit confirmation prompt on native mobile platforms.
- **Visual Status Bar & Spacing Optimization:** Restructured layout headers and sidebar drawer padding with custom safe-area top offset classes, and replaced dark backgrounds with transparent status bar overlays.
- **OTA Updates Progress Visibility:** Configured a visible progress indicator card for background mobile OTA updates at the bottom of the screen.

### 🚀 v5.0.5 — Patch Release

- **Auto-Updater Progress Bar Alignment:** Restored the non-dismissible updates card layout with center-aligned download percentage bar for native desktop (Tauri) applications.
- **OTA Updates Workflow Integration:** Synchronized and tested Capacitor OTA update check and download workflow.

### 🚀 v5.0.4 — Patch Release

- **Android Safe-Zone Adaptive Icon Pipeline:** Implemented an automated app icon pipeline using `npm run generate-icons` and native `sips` commands, scaling the adaptive foreground layer to 65% safe zone area and transparently padding it to prevent circular mask cropping.
- **Auto-Updater Bypass Prevention:** Configured a non-dismissible download progress bar for desktop (Tauri) updates by removing close buttons and interactive restart prompts, forcing a clean auto-relaunch upon 100% download completion.
- **Safe Area Top Offset Overlap Fix:** Integrated a dynamic `SafeAreaProvider` that measures screen safe area top inset heights in pixels, pushing headers and drawer blocks below the native system status bar.
- **Capacitor Theme-Aware StatusBar Sync:** Added dynamic web theme-to-native status bar color synchronization (`#0f172a` in dark mode, `#ffffff` in light mode), updating background and text styles on theme toggle.

### 🚀 v5.0.3 — Patch Release

- **Platform-Aware Auto-Updater UI & Silent Background Updates:** Restricted the visible update notification card and "Restart Application" button exclusively to native desktop apps (Tauri). Mobile applications (Capacitor/APK) now fetch, download, and apply OTA updates silently in the background.
- **GitHub Actions Debug APK Build Fallback:** Configured GHA workflow to automatically compile and verify a debug APK if release signing keystore secrets are missing from repository variables, preventing build failures.
- **Log Spam & Egress Fixes:** Resolved overnight localhost log warning spam and Supabase mobile updater network polling egress leaks in development.

### 🚀 v5.0.2 — Patch Release

- **Resilient Overwrite & Retry Pipeline:** Added space-insensitive matching and space-to-dot filename normalization to eliminate GitHub release asset upload collisions, plus a 3-attempt retry loop with 5-second backoff and asset refetching.
- **Secure Android Signing & Verification:** Configured automated zipalign, apksigner v1/v2/v3/v4 verification, metadata check using aapt badging, and minimum file size threshold checks.
- **Tauri & Android App Icons Refresh:** Refreshed and optimized launcher assets across both Tauri desktop (icns/ico) and Capacitor Android (mipmap layers).
- **Log Spam & Egress Fixes:** Resolved overnight localhost log warning spam and Supabase mobile updater network polling egress leaks in development.

### 🚀 v5.0.1 — Patch Release

- **Smart Download File Names Alignment:** Decoupled config metadata and aligned all fallback URLs with Tauri release filenames (`QC.Manager_${VERSION}_*`) to eliminate 404 download errors.
- **macOS Apple Silicon M4 Detection:** Refined device detector to correctly map Chromium 'arm' architecture reports to 'Apple Silicon' recommendation targets.
- **Universal Android APK Naming:** Renamed native Android APK to follow standard naming formatting (`QC.Manager_${VERSION}.apk`).

### 🚀 v5.0.0 — Major Release

- **macOS Triple Target Build System:** Implemented a new parallel compilation matrix in GHA generating three separate macOS desktop installers (macOS Apple Silicon, macOS Intel, and macOS Universal).
- **Intelligent Download Routing:** Configured client-side device GPU and browser detection to recommend the specific CPU build, falling back safely to the macOS Universal binary only when architecture cannot be confidently determined.
- **Decommissioned iOS Pipeline:** Completely removed iOS build jobs, Xcode projects, Apple developer code-signing provisioning profiles, and IPA packaging configurations to focus release bandwidth entirely on Android, Tauri Desktop, and Web.
- **Standalone Downloads Portal:** Refactored the "More Downloads" modal container into a standalone client-rendered `/downloads` page, supporting global `Backspace` keypress history navigation and top-left back controls.
- **Native Environment UI Hiding:** Integrated checks to automatically detect native wrappers (Tauri & Capacitor) and suppress redundant download promotion panels inside native client applications.

### 🚀 v4.6.0 — Minor Release

- **Custom Delete Government Holiday Modal**: Replaced the native browser `window.confirm()` dialog with a fully custom, theme-compliant modal showing affected employee responses and decisions.
- **Race Condition Resolution**: Resolved the modal flash issue on app startup/reload by enforcing a strict initialization order (`cached profile` -> `background profile query` -> `notifications/responses fetch` -> `validation`).
- **Realtime Track Optimization**: Enhanced postgres changes listeners for `govt_holiday_responses` to immediately reflect response deletions and updates without waiting for database refetch.

### 🚀 v4.5.0 — Minor Release

- **Quote Rules Edit & Update Support**: Added full editing capability for existing compliance rules, including category, sub-category, company name/title, tags, rule details, and permission-aware update flows.
- **Reusable Rule Modal Experience**: The add-rule flow now supports both create and edit modes through the same modal, with prefilled values, updated button labels, and immediate UI refresh after successful saves.
- **Audit Logging & Persistence Improvements**: Rule updates now preserve the same rule ID, keep the original creation timestamp, update the modification timestamp, and log meaningful field-level changes for audit visibility.
- **Role-Based Management Controls**: Rule edits remain restricted to users with the existing quote rules permission model, preserving the current admin/supervisor/authorized-editor access rules.
- **Deployment Readiness Update**: This release aligns the app versioning, documentation, and desktop release notes for the upcoming 4.5.0 deployment.

### 🚀 v3.4.0 — Minor Release

- **Workspace Modularization**: Restructured components, modals, and hooks into `leave-tracker`, `quotes-tracker`, and `common` scopes, resolving architecture complexity.
- **Performance & Lazy-loading**: Implemented React lazy loading on all heavy workspace panels and tab views with smooth `<Suspense>` loaders, decreasing initial JS payload and speeding up initial page load.
- **Supabase Edge Function Push Notifications**: Ported push notification logic from Node/Next.js to a globally distributed Deno Edge Function (`send-push`), allowing faster delivery, RLS-bypassing secure operations, and zero Serverless function execution billing on Vercel.
- **Linter & Dead Code Cleanup**: Removed unused variables (`isTauri`, `adminActiveTab`, `shiftEndMins`) and excluded Deno functions from `tsconfig` checking for a squeaky-clean build.

### 🚀 v3.3.1 — Patch Release

- **Minimal Scrollbar Aesthetics**: Implemented a global, custom `.custom-scrollbar` utility style (thin, transparent by default, fading in on hover) and applied it to custom select dropdowns, user notifications modal, and leave approval panels.
- **Notifications Persistence & Expiry**: Extended dismissed notifications persistence in local storage to 30 days (preventing them from reappearing after 1 day). Automatically filter out non-actionable informational notifications older than 7 days from the list.
- **React Hook Purity Fix**: Resolved an ESLint compilation error where `Date.now()` was called inside `useMemo` by substituting it with the stable `currentSessionTime` timestamp.

### 🚀 v3.3.0 — Minor Release

- **macOS & Windows Unified Auto-Updater Pipeline**: Integrated a custom updater builder script (`combine-latest-json.js`) into the GitHub Actions build workflow. This merges signatures and artifact payloads from both Windows and macOS platforms into a single, clean `latest.json` file on release, resolving the 404/signature validation issue.
- **macOS System Integration**: Restored macOS native menu functionality (`Menu::default`) including support for native keyboard shortcuts (`Cmd+A`, `Cmd+C`, `Cmd+V`, `Cmd+X`, and `Cmd+R` for page reload).
- **Profile Leave History Syncing**: Fixed a syncing issue where self-submitted leaves (made by Admin, Supervisor, or normal users) were not showing up under User Profile leave history. Now, pending/approved leaves are correctly visible across both the User Dashboard and the User Profile details in the User Management tab.

### 🚀 v3.2.0 — Minor Release

- **Database-Level Badge Syncing**: Migrated top performer badge calculations, consecutive month streaks, and annual wins computation entirely to PostgreSQL level (`sync_top_performer_badges` RPC). Removed client-side heavy record fetching (up to 15,000 records) to eliminate memory overhead, network delays, and connection pool issues.

* **User Leave Editing & Supervisor Access Delegation**:
  - Implemented Temporary Access Delegation modal for supervisors to securely delegate their team's view/approval roles using circular checkbox selectors and circular context menu items (Edit & Remove Access) loaded directly under body portal context menus.
  - Allowed normal users to edit their own leave records. Modified `needsReapproval` checking to reset leave requests back to `pending_supervisor` when settled requests are edited.
  - Added full admin/supervisor editing capabilities for user sign-in/out times, break durations, working hours, and job roles.

- **Decoupled Badge Display & UI Enhancements**: Completely removed `localStorage` caching of computed badges. Rendered all top performer badges directly from the database's `profilesList` state across Navbar, User Management, and Leaderboards to prevent mismatches or stale visual updates. Removed redundant `Total` text wrap constraints inside leave usages summaries.

### 🚀 v3.1.0 — Minor Release

- **Team Daily Leave Records Report**: Implemented a comprehensive daily leave records dashboard allowing supervisors to filter and view their team members' active daily leaves (full & short leaves), and administrators to view all organization daily leaves. Supported custom Excel and PDF exports with dynamic filename formatting.
- **Custom Skeleton Loaders & UX Improvements**: Designed new tailor-made skeleton loaders (`team-leaves-report` and `leaves-table` variants) to seamlessly match loading columns and eliminate action button grids. Fixed Back button routing navigation to exit directly to the leave application landing tab.
- **Code Quality & Linting Compliance**: Resolved React conditional hook violations and cleaned up unused lucide imports, unused variables, and type safety constraints (such as `any[]` array responses in Excel helpers and Postgrest catch block type bindings) to ensure clean next build compilation.

### 🚀 v3.0.9 — Patch Release

- **Rebuilt Cross-Platform Auto Updater**: Re-architected `AppUpdater` from scratch for Tauri v2 using `downloadAndInstall()` and `@tauri-apps/plugin-process` relaunch, ensuring seamless, robust auto-update installations on macOS and Windows.

### 🚀 v3.0.8 — Patch Release

- **Eliminated Double Reload & UI Flickering**: Implemented optimistic state updates for adding, deleting, and adjusting leave entries in User Management > Leave History view, along with silent background data refetching.

### 🚀 v3.0.7 — Patch Release

- **User Profile Settings Visibility & Admin Approval Workflow**: Enabled direct editing of profile details (Full Name, Job Role, Working Hours, Break Minutes, Default Sign-In/Out) for regular employees and supervisors. Submitting changes creates a pending profile update request for Admin approval, while keeping fields editable before submission.

### 🚀 v3.0.6 — Patch Release

- **Direct Supabase Leave Insertion**: Resolved desktop app (Tauri) `Failed to fetch` error by inserting leave entries directly through Supabase JavaScript SDK, bypassing external serverless API dependency.
- **Double Reload Prevention**: Added debounced fetch execution wrapper in User Management Dashboard to prevent duplicate data refetching and UI reloading when performing leave additions or deletions.
- **Official Base URL Configuration**: Updated `apiUrlHelper.ts` and `.env.local` to use the official Vercel base domain `https://qc-manager-y4bzh900h-kamrul-projects.vercel.app`.
- **Leave Usage & Stat Card Styling**: Enhanced font sizes for remaining hours and minutes display under Allocated Office Leave in user stats and leave summary cards.

### 🚀 v3.0.5 — Patch Release

- **Session Lifetime & Auth Robustness**: Implemented auto-refresh token checks prior to submission and fallback logic in supervisor and push route handlers to avoid stale JWT errors.
- **Custom Alert Confirmation Modal**: Replaced standard browser `confirm` prompts with custom modal designs when deleting leaves in the user profile view.
- **Right-Click Protection**: Disabled default browser context menus globally while keeping custom project context menus operational. Also disabled custom context menu options for supervisors on non-deletable records.
- **Linter & Styling Cleanup**: Resolved all remaining TypeScript compiler warning types and corrected Tailwind class formatting.

### 🚀 v4.4.3 — Patch Release (Security, Settings & Cost Optimizations)

- **Top Performer Badge Sync Trigger Fix** — Resolved a critical trigger exception `"Unauthorized profile modification."` raised in PostgreSQL when regular users mounted the dashboard. Configured transaction-local security bypasses (`app.bypass_profile_security`) inside the RPC function to allow safe badge sync updates.
- **Self-Profile Settings Tab Access Fix** — Allows users of role `'user'` to access their own Profile Settings workspace tab successfully.
- **Supabase Cost Optimizations** — Replaced conditional dashboard panel mounting with hidden DOM containers to eliminate duplicate database select queries and realtime channel re-subscriptions when switching workspace tabs.
- **Clock Skew Protection & Concurrency Safeguards** — Restores authentications from negative clock skews and blocks concurrent duplicate database submissions.
- **Dead Code Cleanup** — Pruned unused components (`StaffMasterTable.tsx`), empty API paths (`api/leaderboard`), and redundant imports/variables across the codebase.

### 🚀 v4.4.2 — Patch Release (Audit Hardening & Codename Sync)

- **Audit Log Change Detection Fix** — Blocked the insertion of empty/redundant `"no changes made"` logs when saving a user profile without adjustments. Configured the details log to extract and print only altered properties (representing the `Old Value → New Value` transitions).
- **Cascading Codename Synchronization** — Fixed a key dependency gap where codename edits only updated `profiles` and login email. The API route now automatically cascades the new codename into the `user_metadata` in Supabase Auth, Quotes App `records`, Todo Checklist `todos`, and the past `audit_logs` history tables to preserve data integrity and prevent broken lookups.

### 🚀 v4.4.1 — Patch Release (Security Hardening)

- **Security Audit Remediation** — Implemented comprehensive fixes for vulnerabilities identified during a penetration review:
  - **Forgot-Password Protection (H1)**: Added IP-based rate limiting (5 req/min) and switched to silent success responses for unregistered users to prevent username enumeration.
  - **Supervisor RLS Scoping (H2)**: Restricted supervisor UPDATE/DELETE Row Level Security (RLS) policies on `chuti` exclusively to supervised team members.
  - **Add-Leave Payload Sanitization (H3)**: Sandboxed supervisor leave submission API payloads to prevent admin status bypasses or auditing log spoofing.
  - **RPC Access Enforcement (M1)**: Configured restrictive SQL grants and execution revokes on privileged `SECURITY DEFINER` RPC functions.
  - **Audit Log Integrity Guard (M2)**: Restrained audit logging insertions to verify the caller's authentic user ID (`actor_id = auth.uid()`).
  - **Push Subscription Scope & Entropy Fixes (L1/L2)**: Hardened push notification deletes to owner-only scope and upgraded session tracking keys from math-based random strings to cryptographically secure `crypto.randomUUID()`.

### 🚀 v4.4.0 — Minor Release

- **Jummah Prayer Short Leave Adjustment** — Automatically deducts 20 minutes from calculated short leave durations on Fridays. Includes Friday auto-detection and an `Adjust with Jummah Prayer` toggle interface on the employee and supervisor/admin forms, automatically adding a `20 Min Adjusted with Jummah Prayer` comment.
- **Leave History Loading Fix** — Resolved a critical issue where the User Profile -> Leave History sub-tab in User Management would remain stuck in a perpetual loading state if global settings failed, delayed, or were cancelled. Initialized global settings to `defaultGlobalSettings` as a fallback.

### 🚀 v4.3.1 — Patch Release

- **Supervisor Self-Management and Grouping** — Included supervisor's own leave records on the Team Leave Records page under their own team list. Allowed supervisors to select their own profile in the User Management Dashboard, view their own leave history, and add leave entries for themselves (bypassing supervisor approval directly to Admin approval).
- **Backend Supervisor Verification bypass** — Allowed supervisor self-add operations to pass backend authorization checks.

### 🚀 v4.3.0 — Minor Release

- **Automatic Date Validation & Year Guard** — Restricted leave date picker inputs strictly to the running year (e.g. 2026), with real-time day/month input validation and auto-correction. Prevents submit actions if validation errors exist.
- **Quote File Name Sanitizer** — Automatically sanitizes pasted or typed quote file names to strip out comments (e.g. `(Check Note)`, `(Expert please)`), branch names, file types, and trailing dots in both Daily and Custom entries.
- **Sleek Custom Scrollbars** — Replaced all native browser/OS scrollbars with customized, thin, transparent scrollbars matching the premium dark theme.
- **Supabase Network & Realtime Optimization** — Consolidated multiple separate database subscriptions into single combined channels (over 60% reduction in concurrent active channels) and implemented debounced fetch coalescing to dramatically reduce Supabase Egress and Realtime Message quota consumption.
- **IP Checker Verification Links** — Integrated amber alerting and direct copying for `iphey.com` and `whoer.net` VM verification links inside the IP Checker card.
- **Centred Modals & Login Panel Gradient** — Repositioned edit overlays using React Portals to solve the layout containment blur issues and updated button gradient aesthetics.

### 🚀 v4.2.1 — Patch Release

- **App Icon & Favicon Regeneration** — Generated Tauri desktop application icons and web assets across all platform resolutions from the new brand asset.
- **Login Codes System Key Filtering** — Filtered out system templates and settings records starting with double underscores `__` from showing up as normal entries in the Login Codes Directory.

### 🚀 v4.2.0 — Minor Release

- **Historical KPI Evaluation Reports** — Implemented previous KPI report history lookup and re-evaluation switching workflow in profile settings.
- **Dynamic KPI Evaluation Periods** — Added support for custom date-range evaluation periods (e.g. Quarterly or Annual evaluations) with an inline settings button next to date labels.
- **Improved Workspace Layout** — Relocated KPI and Performance settings to a full-width section at the bottom, keeping Leave and Quotes workspace access cards cleaner side-by-side.
- **Enforced Main Department Display** — Ensured that both the printed sheet and Excel export output display only the main department, even if secondary tasks are assigned.
- **Database Duplicate Records Cleanup** — Safely resolved 4,718 duplicate database entries from June 2026 logs using paginated querying.

### 🚀 v4.1.3 — Patch Release

- **Duplicate Record Cleanups**: Identified and removed 717 duplicate database records by grouping matching `codename`, `file_name`, and `submitted_at` values.
- **Persistent Grid Row Selection**: Refactored selection state hooks inside `RecordsTable.tsx` to preserve row selections during background refetches or database updates.
- **Keyboard Deletion Shortcuts**: Integrated a global `Delete` keyboard shortcut in Quotes and Leaves tables to trigger bulk-deletion flows on selected records (with input-typing guards).
- **Code Quality & Warnings Remediation**: Addressed ESLint warnings, resolved `any` declarations with typed props, fixed hoist ordering, and cleaned up duplicate CSS styles in `UserSettleModal`, `AdminAddLeaveModal`, and `useRecordActions`.

### 🚀 v4.1.2 — Patch Release

- **Auto Fetch and Input Clearing Fix**: Resolved issues in multiple modals (`CustomEntryModal`, `AdminAddLeaveModal`, `UserSettleModal`) where inputs were cleared upon background updates or data fetches. Implemented transition guards to verify `showModal`/`isOpen` state shifts, preventing field resets.

### 🚀 v4.1.1 — Patch Release

- **Duplicate Record Submissions Prevention**: Resolved race conditions causing double insertions into the Supabase database. Implemented synchronous `useRef` locks at the execution layer (`useRecordActions.ts`), event handler submission checks at the view layer (`page.tsx`), and query concurrency flags during IndexedDB background uploads (`quotesOfflineSync.ts`).
- **React Hooks and ESLint Validation**: Resolved React hooks and reference violations inside `src/app/page.tsx` and `useDashboardData.ts` to satisfy compiler rules.

### 🚀 v4.1.0 — Minor Release

- **EUI Causality Format Template Editor**: Shipped a new premium, fully custom workspace editor for EUI Causality format. Supports real-time layout rendering, field edits, dynamic additional drivers (up to 5), Cloud database synchronization (`login_codes` table using `__eui_causality_template__` key), and copy-to-clipboard functionality.
- **Dynamic Numbering & AD Relationship Filtering**: Integrated smart sequential numbering in EUI Causality format. The "Relationship with the AD XX" fields are generated dynamically only when additional drivers are active. It adjusts subsequent field numbers automatically and filters out legacy numbering from saved DB templates.
- **Dynamic Supervisor On-Behalf Commits**: Restructured comment appending inside `AddLeave` form. Adding leaves on behalf of staff now dynamically stamps the supervisor's actual codename (e.g. `MR720 Added | Personal Issue`) instead of leaving the field unsigned.

### 🚀 v4.0.1 — Patch Release

- **Realtime Egress Broadcast Storm Prevention**: Restructured all active real-time channels (`chuti`, `profiles`, `leave_settlements`, `records`) to apply dynamic role-based filters (`user_id=eq...` or `id=eq...`) for regular staff. This guarantees users only listen to their own updates and completely eliminates company-wide database refetch storms on multi-user writes.
- **Stale Auth Closure Fix**: Added `sessionUserRef` tracking inside `AppPortal` and `useDashboardData` to resolve stale closures. Prevents the app from executing full profile downloads and record refetches on background token refreshes (`TOKEN_REFRESHED`).
- **Removed Redundant Audit Logs Subscription**: Removed background real-time listener for the `audit_logs` table. Audit logs are now fetched only on-demand when opening the tab, saving thousands of background read queries.
- **Selective Compliance Rules Fetching**: Wrapped compliance rules fetching and subscriptions to only execute for users with active Quotes workspace access.
- **Admin Pending Review Query Filtering**: Optimized the global notifications approvals query for Admins to fetch only active pending rows (`status.eq.approved_by_supervisor` or pending reserve adjustments) instead of downloading company-wide historical sheets.
- **Instant Tab Transitions (UX Optimization)**: Converted all lazy-loaded sub-tab views inside the Quotes Tracker (like Daily Entry and Monthly Entry forms/tables) into static imports. This eliminates brief skeleton loader flashes, enabling millisecond-level snappy tab switches.

### 🚀 v4.0.0 — Major Release

- **Real-Time Welcome Greeting Sync**: Implemented dynamic localStorage cache reloading and `"profile-updated"` custom window events during onboarding setup and settings saving, ensuring the greeting header ("Welcome, User" issue) updates instantly without requiring browser refreshes.
- **Supervisor Permission Restructuring & Isolation**: Enforced robust access controls restricting supervisors to view and update KPI sheets, leave histories, and profile settings ONLY for staff under their direct or delegated supervision. Supervisors are prevented from editing their own profiles, KPI settings, or Quotes settings.
- **Quotes Access Visibility & History Reading**: Allowed supervisors to view the Quotes History and read-only Profile Settings of all users with quotes access, while hiding their sensitive Leave History and KPI tabs completely.
- **KPI Panel & Egress Query Optimization**: Dramatically reduced Supabase network egress and database query count inside `UserKpiPerformancePanel`:
  - Removed redundant database query loops when saving or editing assessment fields.
  - Decoupled supervisor name fetching from monthly record counting, running the query only when target staff changes.
  - Merged `checkAppraisees` and `fetchAssignedAppraisees` into a single background-loaded hook, eliminating double-fetching and enabling instant modal loading.
- **Appraiser Autocomplete & Suggestion Dropdown**: Shipped an active profiles search suggestion dropdown to the "Appraiser's Name" field. Autocomplete input editing is locked to Admins when target users are not under supervision.
- **Clean Numeric Inputs**: Hidden browser spin arrows (up/down control buttons) from all KPI numeric inputs to support clean, manual typing.

### 🚀 v3.5.0 — Minor Release

- **Asitis Causality Format Editor**: Shipped a live-editable document template editor for Asitis Causality format. Features inline title editing, hover action keys (Add/Delete), and Supabase synchronization.
- **Realtime Database Egress Optimization**: Added a user-level filter (`user_id`) to the real-time WebSocket channel for records, reducing network egress usage by 99%.
- **Audit Logs Query Limiting**: Added a query limit of 150 records to the system audit logs fetcher, preventing loading unnecessary historical log records in the background.
- **Absolute Floating Context Menus**: Changed coordinate calculations to relative position bounding rects, ensuring right-click context menus open exactly under the cursor without layout shifts.
- **Dedicated Skeleton Loaders**: Designed and integrated a loading skeleton for the Asitis Causality workspace to ensure smooth UI transition states.

### 🚀 v3.0.4 — Patch Release

- **Startup Auto-Update Installation**: Implemented automatic update downloading, installation, and relaunch on application startup, bypassing the manual restart button prompt.
- **Warning Resolution**: Cleaned up the final explicit `any` linter warning inside the updater checker.

### 🚀 v3.0.3 — Patch Release

- **Vercel Analytics Integration**: Switched `@vercel/analytics/react` to `@vercel/analytics/next` in the App Router root layout to utilize Next.js-specific optimizations.
- **Permanent Spellcheck Fix**: Configured workspace settings to disable VS Code CSpell alerts, resolving formatting underline warnings globally.

### 🚀 v3.0.2 — Patch Release

- **Project-wide Codebase Review & Cleanup**: Cleaned up over 260 compiler and linting warnings. Removed unused states, imports, and variables across `chuti/page.tsx`, `quotes/page.tsx`, and `DashboardModals.tsx`.
- **Strongly Typed IP Checker**: Defined safe, typed interfaces for 6 external geolocation databases in `IPCheckerModal.tsx`, eliminating all explicit `any` types and improving code robustness.
- **Production Build Optimization**: Confirmed TypeScript compilation matches 0 error status and compiles without warnings.

### 🚀 v3.0.1 — Patch Release

- **User Management Loading Fixed** — Admin & Supervisor user list was failing to load in the desktop app because API calls were using relative paths that don't resolve in the Tauri webview. All API calls now correctly route to the Vercel backend.
- **Real Download Progress** — The app updater now shows the actual download percentage (e.g. "Downloading v3.0.1… (45%)") instead of a fake pulsing bar.
- **macOS Auto-Update Fixed** — Added `process:allow-restart` capability so the updater can successfully relaunch the app after installing an update on macOS.

### 🚀 v3.0.0 — Major Release

- **Server-Persisted Verified Badges**: Shipped a robust backend synchronization system for verified performer badges. This resolves the RLS security restriction conflict where normal staff computed incorrect leaderboard ranks and faked badges locally. Badges are now calculated by the Admin at runtime and saved securely in each user's `global_settings.top_performer_badge` profile record.
- **Top 5 Leaderboard Priority & Badges**: Leaderboard ranks are locked to the Top 5. The Top 1–3 performers receive a blue verified performer badge, and the Top 4–5 performers receive a grey verified performer badge.
- **Leaderboard Filtering Updates**: Removed the dynamic team average filter and the tie-breaker rank filter. The leaderboard list now displays the complete Top 5 performance records without rank suppression.

### 🔧 v2.0.1 — Patch Release

- **Critical Tauri Login Fix**: Users were unable to log in on the desktop app (macOS/Windows) while the web version worked. Root cause was the Supabase client using auth defaults incompatible with Tauri's static WebView (no server-side redirect). Fixed with `detectSessionInUrl: false`, `flowType: 'pkce'`, and explicit `localStorage` binding.
- **Auto-Updater Unified & Fixed**: Removed duplicate `QuotesAppUpdater`. The single `AppUpdater` now uses correct Tauri v2 detection (`__TAURI_INTERNALS__`), correct `check()` API, and `plugin-process relaunch()` (the old `custom_relaunch` Rust command didn't exist).
- **macOS DMG Build Fix**: Added `chmod +x bundle_dmg.sh` CI step to fix `failed to bundle project` error on `aarch64-apple-darwin`.
- **Password Reset RECOVERY Fix**: Changing a user password no longer falsely triggers the RECOVERY database restore system.

### 🚀 v2.0.0 — Major Release

- **Employee 360° Profile Hub**: Clicking any staff in User Management now opens a full-featured hub with sub-tabs — Leave History, Quotes History, KPI & Performance, and Profile Settings — giving admins a complete employee overview in a single screen.
- **Switchable Admin/User Notification Panels**: Admins can toggle between a detailed Admin Approval Panel (full leave/profile/password request cards with one-click actions) and a personal User Notification Panel. The last-opened panel preference is persisted per session.
- **Newest-First Todo Ordering**: Newly added tasks always appear at the top of the todo list.
- **Profile Change Detection Guard**: Profile update submissions are blocked if no fields were changed, eliminating redundant approval cards in the admin queue.
- **Isolated Admin Personal Notifications**: Admin user panel now shows only their own personal notifications. All administrative approval requests are exclusively shown in the Admin Panel.
- **Supervisor Quotes & Audit Log Access**: Supervisors can now view all users' quotes, monthly/daily entry lists, and system audit logs, matching admin-level data visibility.
- **Light/Dark Theme Sync**: Theme toggle in the Navbar now propagates correctly to all sub-workspaces (Chuti, Quotes) in real-time.
- **Circular UI Components**: Standardized all checkboxes as perfect circles.
- **Password Setup Enforcement**: Automated modal lock to force new users using default credentials `1234` to update their login passwords.

### 🚀 v1.0.0 (First Official Release)

- **Unified Workspace Launch**: Integrated both Leave Tracker (Chuti) and Quotes Manager workspaces under a single secure application shell.
- **Inline User Configuration**: Replaced popup modals with a reusable, highly responsive inline settings panel (`StaffSettingsForm`) for editing and adding staff profiles.
- **Circular UI Components**: Standardized all checkboxes as perfect circles.
- **Slide Transitions**: Added smooth CSS sliding animations to all toggle switches.

---

_Developed by Kamrul Islam, IT Officer, B&F Corporate._
