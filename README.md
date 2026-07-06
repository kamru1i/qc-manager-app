# 🌟 QC App — Unified Office Leave Tracker & Quotes Manager

**Version 3.0.9** | A premium, modern, and high-performance desktop and web utility built with **Next.js (TypeScript)**, **Supabase (PostgreSQL)**, and **Tauri v2**. It integrates two comprehensive corporate workspaces under a single secure, role-based role management structure.

---

## 🚀 Workspace Ecosystem

The QC App consists of two primary corporate workspaces, accessible dynamically based on administrator-configured employee access permissions:

### 1. 📅 Leave Tracker Workspace (Chuti)
*   **Sign-In / Sign-Out Panel**: One-click logging of daily attendances with customizable default shifts.
*   **Live Work Hours Tracking**: Realtime calculation of daily office hours and active break durations.
*   **Leave Submissions**: Request workflows for 4 distinct leave categories:
    - **Full Leave** (Annual leave and Eid vacation days)
    - **Short Leave** (Hourly personal absences)
    - **Overtime** (Logging of extra hours)
    - **Reserve Holiday** (E.g., working on official holidays to bank leave days)
*   **Government Holiday Banners**: 
    - Users with reserve capabilities enabled can choose between taking holiday pay ("Get Paid") or reserving it for future leave adjustment ("Reserve").
    - Users with reserve disabled automatically receive pay addition notifications (bypassing unnecessary screens and admin approvals).
*   **Bulk Full Leave Submission**: Add up to 10 separate dates simultaneously using an interactive calendar panel. In supervisor/admin dashboards, these dates are grouped into a **single, unified action row** for one-click approval, rejection, or revision request.
*   **Leave Deficit Adjustments**: Easily request adjustments using accrued overtime hours or reserve holidays to offset short leave deficits.

### 2. 📝 Quotes Manager Workspace
*   **Compliance Audit Panel**: Conduct deep compliance rules checking on corporate document types (e.g. PDF/Excel quotes).
*   **Rules & Configuration Engine**: Administrators and authorized managers can create, edit, or delete compliance checking rules, viewing execution histories.
*   **Category Checklist Selector**: Permissions specify allowed document categories (e.g. Van, Bike) per staff account.
*   **Can Manage Rules Permission**: Restricts compliance database edits to specific staff members (always allowed for Admins).

---

## 🔑 Administrative Control & Dashboard

A master control panel allows Administrators and Supervisors to oversee company-wide operations:
*   **Employee 360° Profile Hub**: Clicking any staff in User Management opens a full hub — Leave History, Quotes History, KPI & Performance, and Profile Settings sub-tabs — for a complete employee overview.
*   **Switchable Notification Panels**: Admins toggle between the Admin Approval Panel (detailed request cards) and their personal User Notification Panel. Session preference is remembered.
*   **Inline User Configuration**: The old pop-up modals have been replaced by a premium inline settings page (`StaffSettingsForm`). Setting up a new staff account or editing an existing profile uses the exact same layout.
*   **Circular UI Components**: All checkbox selectors (Leave settings, Govt Holidays, Overtime, Reserve, Can Manage Quote Rules) are styled as perfect circular inputs.
*   **Smooth Slide Transitions**: Workspace access toggles feature premium sliding toggle track animations.
*   **Standardized Field Heights**: All dropdown selectors and text fields are locked to consistent heights (`h-[36px]`) to align perfectly.
*   **Password Setup Enforcement**: Users logging in with the default password `1234` are immediately presented with a credentials modal, blocking dashboard navigation until they specify a custom secure password.
*   **Automatic 10-Minute Lockout**: New accounts must complete their profile within 10 minutes, backed by a persistent localStorage timestamp preventing timer bypass on reboot or window closing.
*   **Cascading Profile Deletion**: Removing a user account triggers PostgreSQL cascade constraints to clean up all related attendance, leaves, rules, and push subscriptions.

---

## 📶 Offline-First & Realtime Architecture

*   **PWA Service Worker (`sw.js`)**: Caches static assets for lightning-fast loading and offline availability. Restricts caching to GET requests to protect against cache poisoning.
*   **IndexedDB Sync Storage (`offlineSync.ts`)**: Locally queues signs, sign-outs, and leaves when offline, syncing automatically once connection is restored.
*   **Supabase Realtime Listeners**: Replication broadcasts instantly update metrics, list views, and tables on database changes without requiring manual refresh.
*   **Concurrent Push Notifications**: Integrates Web Push API using VAPID keys, with rate-limiting (maximum 1 request per 5 seconds per staff to prevent network spam). Admins and supervisors bypass rate limits to handle bulk approval actions.
*   **Tray Persistence (Tauri Desktop App)**: Minimizing or closing the app window hides it to the system tray, keeping it active in the background to deliver desktop notifications.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Lucide Icons |
| **Database & Realtime** | Supabase (PostgreSQL), Postgres Row-Level Security (RLS), Triggers, Cascades, RPC Functions |
| **Desktop Wrapper** | Tauri v2, Rust Core |
| **Push Notifications** | Web Push API, `web-push` Node Library, VAPID Keys |

---

## 💻 Local Development Setup

### 1. Prerequisites
*   Node.js (v20 or higher)
*   Rust (v1.75+ for Tauri desktop compilation)
*   A Supabase database project

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

# Web Push Credentials
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

*Tip: You can generate VAPID keys using `npx web-push generate-vapid-keys`.*

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

### 🚀 v3.0.9 — Patch Release (Current)
*   **Rebuilt Cross-Platform Auto Updater**: Re-architected `AppUpdater` from scratch for Tauri v2 using `downloadAndInstall()` and `@tauri-apps/plugin-process` relaunch, ensuring seamless, robust auto-update installations on macOS and Windows.

### 🚀 v3.0.8 — Patch Release
*   **Eliminated Double Reload & UI Flickering**: Implemented optimistic state updates for adding, deleting, and adjusting leave entries in User Management > Leave History view, along with silent background data refetching.

### 🚀 v3.0.7 — Patch Release
*   **User Profile Settings Visibility & Admin Approval Workflow**: Enabled direct editing of profile details (Full Name, Job Role, Working Hours, Break Minutes, Default Sign-In/Out) for regular employees and supervisors. Submitting changes creates a pending profile update request for Admin approval, while keeping fields editable before submission.

### 🚀 v3.0.6 — Patch Release
*   **Direct Supabase Leave Insertion**: Resolved desktop app (Tauri) `Failed to fetch` error by inserting leave entries directly through Supabase JavaScript SDK, bypassing external serverless API dependency.
*   **Double Reload Prevention**: Added debounced fetch execution wrapper in User Management Dashboard to prevent duplicate data refetching and UI reloading when performing leave additions or deletions.
*   **Official Base URL Configuration**: Updated `apiUrlHelper.ts` and `.env.local` to use the official Vercel base domain `https://qc-manager-y4bzh900h-kamrul-projects.vercel.app`.
*   **Leave Usage & Stat Card Styling**: Enhanced font sizes for remaining hours and minutes display under Allocated Office Leave in user stats and leave summary cards.

### 🚀 v3.0.5 — Patch Release
*   **Session Lifetime & Auth Robustness**: Implemented auto-refresh token checks prior to submission and fallback logic in supervisor and push route handlers to avoid stale JWT errors.
*   **Custom Alert Confirmation Modal**: Replaced standard browser `confirm` prompts with custom modal designs when deleting leaves in the user profile view.
*   **Right-Click Protection**: Disabled default browser context menus globally while keeping custom project context menus operational. Also disabled custom context menu options for supervisors on non-deletable records.
*   **Linter & Styling Cleanup**: Resolved all remaining TypeScript compiler warning types and corrected Tailwind class formatting.

### 🚀 v3.0.4 — Patch Release
*   **Startup Auto-Update Installation**: Implemented automatic update downloading, installation, and relaunch on application startup, bypassing the manual restart button prompt.
*   **Warning Resolution**: Cleaned up the final explicit `any` linter warning inside the updater checker.

### 🚀 v3.0.3 — Patch Release
*   **Vercel Analytics Integration**: Switched `@vercel/analytics/react` to `@vercel/analytics/next` in the App Router root layout to utilize Next.js-specific optimizations.
*   **Permanent Spellcheck Fix**: Configured workspace settings to disable VS Code CSpell alerts, resolving formatting underline warnings globally.

### 🚀 v3.0.2 — Patch Release
*   **Project-wide Codebase Review & Cleanup**: Cleaned up over 260 compiler and linting warnings. Removed unused states, imports, and variables across `chuti/page.tsx`, `quotes/page.tsx`, and `DashboardModals.tsx`.
*   **Strongly Typed IP Checker**: Defined safe, typed interfaces for 6 external geolocation databases in `IPCheckerModal.tsx`, eliminating all explicit `any` types and improving code robustness.
*   **Production Build Optimization**: Confirmed TypeScript compilation matches 0 error status and compiles without warnings.

### 🚀 v3.0.1 — Patch Release
*   **User Management Loading Fixed** — Admin & Supervisor user list was failing to load in the desktop app because API calls were using relative paths that don't resolve in the Tauri webview. All API calls now correctly route to the Vercel backend.
*   **Real Download Progress** — The app updater now shows the actual download percentage (e.g. "Downloading v3.0.1… (45%)") instead of a fake pulsing bar.
*   **macOS Auto-Update Fixed** — Added `process:allow-restart` capability so the updater can successfully relaunch the app after installing an update on macOS.

### 🚀 v3.0.0 — Major Release
*   **Server-Persisted Verified Badges**: Shipped a robust backend synchronization system for verified performer badges. This resolves the RLS security restriction conflict where normal staff computed incorrect leaderboard ranks and faked badges locally. Badges are now calculated by the Admin at runtime and saved securely in each user's `global_settings.top_performer_badge` profile record.
*   **Top 5 Leaderboard Priority & Badges**: Leaderboard ranks are locked to the Top 5. The Top 1–3 performers receive a blue verified performer badge, and the Top 4–5 performers receive a grey verified performer badge.
*   **Leaderboard Filtering Updates**: Removed the dynamic team average filter and the tie-breaker rank filter. The leaderboard list now displays the complete Top 5 performance records without rank suppression.

### 🔧 v2.0.1 — Patch Release
*   **Critical Tauri Login Fix**: Users were unable to log in on the desktop app (macOS/Windows) while the web version worked. Root cause was the Supabase client using auth defaults incompatible with Tauri's static WebView (no server-side redirect). Fixed with `detectSessionInUrl: false`, `flowType: 'pkce'`, and explicit `localStorage` binding.
*   **Auto-Updater Unified & Fixed**: Removed duplicate `QuotesAppUpdater`. The single `AppUpdater` now uses correct Tauri v2 detection (`__TAURI_INTERNALS__`), correct `check()` API, and `plugin-process relaunch()` (the old `custom_relaunch` Rust command didn't exist).
*   **macOS DMG Build Fix**: Added `chmod +x bundle_dmg.sh` CI step to fix `failed to bundle project` error on `aarch64-apple-darwin`.
*   **Password Reset RECOVERY Fix**: Changing a user password no longer falsely triggers the RECOVERY database restore system.

### 🚀 v2.0.0 — Major Release
*   **Employee 360° Profile Hub**: Clicking any staff in User Management now opens a full-featured hub with sub-tabs — Leave History, Quotes History, KPI & Performance, and Profile Settings — giving admins a complete employee overview in a single screen.
*   **Switchable Admin/User Notification Panels**: Admins can toggle between a detailed Admin Approval Panel (full leave/profile/password request cards with one-click actions) and a personal User Notification Panel. The last-opened panel preference is persisted per session.
*   **Newest-First Todo Ordering**: Newly added tasks always appear at the top of the todo list.
*   **Profile Change Detection Guard**: Profile update submissions are blocked if no fields were changed, eliminating redundant approval cards in the admin queue.
*   **Isolated Admin Personal Notifications**: Admin user panel now shows only their own personal notifications. All administrative approval requests are exclusively shown in the Admin Panel.
*   **Supervisor Quotes & Audit Log Access**: Supervisors can now view all users' quotes, monthly/daily entry lists, and system audit logs, matching admin-level data visibility.
*   **Light/Dark Theme Sync**: Theme toggle in the Navbar now propagates correctly to all sub-workspaces (Chuti, Quotes) in real-time.
*   **Circular UI Components**: Standardized all checkboxes as perfect circles.
*   **Password Setup Enforcement**: Automated modal lock to force new users using default credentials `1234` to update their login passwords.

### 🚀 v1.0.0 (First Official Release)
*   **Unified Workspace Launch**: Integrated both Leave Tracker (Chuti) and Quotes Manager workspaces under a single secure application shell.
*   **Inline User Configuration**: Replaced popup modals with a reusable, highly responsive inline settings panel (`StaffSettingsForm`) for editing and adding staff profiles.
*   **Circular UI Components**: Standardized all checkboxes as perfect circles.
*   **Slide Transitions**: Added smooth CSS sliding animations to all toggle switches.

---

*Developed by Kamrul Islam, IT Officer, B&F Corporate.*
