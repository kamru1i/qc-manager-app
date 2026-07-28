# 🌟 QC Manager — Unified Office Leave Tracker & Quotes Manager

**Version 6.7.5** | A premium, modern, and high-performance desktop, web, and mobile utility built with **Next.js 16 (React 19 & TypeScript)**, **Supabase (PostgreSQL)**, **Tauri v2 (Rust Core)**, and **Capacitor v8**. It integrates two comprehensive corporate workspaces under a unified, enterprise-grade, role-based access control (RBAC) and feature flag management structure.

---

## 🚀 Workspace Ecosystem

The QC Manager consists of two primary corporate workspaces, accessible dynamically based on administrator-configured role permissions, user overrides, and global feature flags:

### 1. 📅 Leave Tracker Workspace (Chuti)

- **Sign-In / Sign-Out Panel**: One-click logging of daily attendances with customizable default shifts and live clock rendering for Bangladesh 🇧🇩 and UK 🇬🇧 timezones.
- **Live Work Hours Tracking**: Realtime calculation of daily office hours, remaining shift durations, and active break durations.
- **Leave Submissions**: Request workflows for 4 distinct leave categories:
  - **Full Leave** (Annual leave and Eid vacation days)
  - **Short Leave** (Hourly personal absences with automatic Friday Jummah 20-min adjustments)
  - **Overtime** (Logging of extra hours)
  - **Reserve Holiday** (Working on official holidays to bank leave days)
- **Government Holiday Banners**:
  - Users with reserve capabilities enabled choose between holiday pay ("Get Paid") or reserving it for future leave adjustment ("Reserve").
  - Users with reserve disabled automatically receive pay addition notifications (bypassing unnecessary screens and admin approvals).
- **Bulk Full Leave Submission**: Add up to 10 separate dates simultaneously using an interactive calendar panel. In supervisor/admin dashboards, these dates are grouped into a **single, unified action row** for one-click approval, rejection, or revision request.
- **Leave Deficit Adjustments**: Easily request adjustments using accrued overtime hours or reserve holidays to offset short leave deficits.

### 2. 📝 Quotes Manager Workspace

- **Compliance Audit Panel**: Conduct deep compliance checks on corporate document types (e.g. PDF/Excel quotes).
- **Rules & Configuration Engine**: Authorized managers and administrators create, edit, or delete compliance checking rules and view execution histories.
- **Category Checklist Selector**: Permissions specify allowed document categories (e.g. Van, Bike) per staff account.
- **Copy Helper & Admin Sales Summary**: Includes session info, sales summary, quick copy actions, detailed report, and a server-side deduplicated **Admin Sales Summary** powered by high-performance PostgreSQL RPCs.
- **Document Template Editors**: Live causality editors for EUI and Asitis formats with dynamic driver relationship filtering and Supabase template syncing.
- **Quick Import & Custom Entry**: Features bulk CSV/Excel quote importing and custom manual record entries, both protected by granular tab permissions.

---

## 🔑 Administrative Control, Governance & Security

A master control panel allows Superadmins, Admins, and Supervisors to oversee organization-wide operations securely:

### 1. Employee 360° Profile Hub & Unified Settings Form
- **Unified Profile Form (`StaffSettingsForm`)**: Standardized inline configuration layout used in both `Settings > Profile` and `User Management > User Profile Settings`.
- **Manual Department Control**: 100% manual control over staff department assignments (`Data Entry`, `IT`, etc.), completely preserving admin/user choices without automated background overwrites.
- **Standardized Form UI**: Circular checkbox inputs, smooth sliding track toggles, standardized field heights (`h-[36px]`), and dynamic 3-column inline grid for Change Password.

### 2. Granular Tab Access Control Matrix (`Settings > Access`)
Superadmins and delegated Admins can customize access levels for `User`, `Supervisor`, and `Admin` roles across 6 distinct permission categories:
1. **Main Workspace Sections**: KPI & Performance, Todos Panel, Leaderboards, Audit Logs, User Management, BD/UK Clocks.
2. **Quotes Tracker Subtabs**: Copy Helper, Save File, Monthly List, Quote Rules, Login Codes, Causality Editor, Quick Import, Custom Entry.
3. **Leave Tracker Subtabs**: My History, Govt Responses, Settlement, Leave Settings, Staff Leaves Report.
4. **Settings Subtabs**: Profile, Menu Visibility, Sanitizer, Access Matrix, Feature Flags, VPN.
5. **User Profile View Subtabs**: Leave History, Quotes History, Analytics, KPI & Performance, Profile Settings.
6. **User Profile Settings Components**:
   - `profile_component_leave_workspace` — Leave Tracker Workspace settings card
   - `profile_component_quotes_workspace` — Quotes Manager Workspace settings card
   - `profile_component_kpi_settings` — KPI & Performance Settings card
   - `profile_component_change_password` — Change Password? section

### 3. Time-Boxed Temporary Access Controls (`Settings > Access`)
- Configurable temporary overrides targeting an entire role (`user`, `supervisor`, `admin`) or a specific individual user by `Codename (Full Name)`.
- Grants or revokes temporary access with explicit duration limits (e.g. 1 hour, 1 day, 7 days) and automatic expiration.

### 4. Global Feature Flags & Per-User Overrides (`Settings > Feature Flags`)
- **Global Toggles**: Superadmins and Admins can toggle features ON/OFF globally across the entire organization. Turning OFF a feature flag immediately revokes access for all roles.
- **Per-User Overrides**: Individual user feature flag overrides (`User Management > Profile Settings > Feature Flags`) allow fine-grained per-staff feature toggles backed by database persistence.

### 5. Multi-Device Auth & Security Hardening
- **Multi-Device Concurrent Login**: Supports up to 10 simultaneous active sessions across Web, Desktop, and Mobile with local token signouts (`signOut({ scope: 'local' })`).
- **Default Password Lockout**: Users logging in with initial credentials (`1234`) are locked to a password setup modal until a custom secure password is created.
- **New Account Onboarding Timer**: 10-minute setup completion timer backed by persistent `localStorage` timestamps.
- **Security Audit Remediation**: PII protection on email lookups, atomic `jsonb_set` settings updates, strict PostgreSQL RLS policies, and RPC execution revokes.

---

## 📶 Offline-First & Realtime Architecture

- **PWA Service Worker (`sw.js`)**: Caches static web assets for offline functionality and fast loading.
- **IndexedDB Sync Storage (`offlineSync.ts`)**: Queues offline signs, sign-outs, and leaves locally, auto-syncing upon network recovery.
- **Role-Filtered Supabase Realtime Listeners**: Selective WebSocket channels prevent company-wide broadcast storms and minimize network egress.
- **System Tray & Native Auto-Updater**: Native desktop app (Tauri v2) minimizes to system tray; native desktop and Android (Capacitor) apps feature automated OTA update checking and in-app installation.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons |
| **Vector Media & Flags** | Crisp SVG Vector Flags (Bangladesh 🇧🇩 & United Kingdom 🇬🇧) |
| **Database & Realtime** | Supabase (PostgreSQL), Postgres RLS, Triggers, Cascades, RPC Functions, Deno Edge Functions |
| **Desktop Wrapper** | Tauri v2 (Rust Core, System Tray, Cross-Platform Desktop Installers) |
| **Mobile Wrapper** | Capacitor v8 (Android APK Packaging, In-App Installer, Native Plugins) |

---

## 💻 Local Development Setup

### 1. Prerequisites
- Node.js (v20 or higher)
- Rust (v1.77+ for Tauri desktop compilation)
- Supabase Project & CLI

### 2. Database Initialization
Run `supabase/schema.sql` in your Supabase SQL Editor to initialize tables, constraints, RLS policies, RPC functions, and cascade cleanup rules.

### 3. Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Build & Verification Commands
```bash
# Install dependencies
npm install

# Run web dev server
npm run dev

# Run Tauri desktop dev mode
npm run tauri dev

# Check TypeScript types (0 errors)
npx tsc --noEmit

# Compile Next.js web build
npm run build

# Build Tauri desktop installer
npm run tauri build
```

---

## 📜 Version History / Changelog

### 🩹 v6.7.5 — Patch Release (Copy Helper Date Controls, Unified Feature Flags & Supervisor Delegation Security) (Current)

- **Copy Helper Date Controls & Independent Filtering**: Added independent per-box date pickers with hover pencil icons, DD/MM/YYYY formatting, and independent record filtering across Box 4 (User Sales Summary), Box 5 (Detailed File Report), and Box 6 (Admin Sales Summary).
- **Copy Helper Feature Flags**: Added `copy_helper_user_summary` (Box 4) and `copy_helper_important_notes` (Important Notes) to the Feature Flags registry with Superadmin control, and ensured dynamic box renumbering without gaps.
- **Unified Temporary Access Controls**: Extended Temporary Access Controls in Profile Settings to support both Navigation Tabs and Feature Flags with target-user granularity.
- **Strict Workspace & Supervisor Access Control**: Restricted Quotes Manager Workspace access toggles and supervisor assignments strictly to Admin/Superadmin.
- **Supervisor Team & Delegation Scoping**: Enforced read-only view mode for Quotes Manager Workspace when viewed by a supervisor for staff outside their assigned or delegated team.

### 🩹 v6.7.4 — Patch Release (Granular Profile Settings Permissions, Feature Flags & Complete Documentation Audit)

- **Granular User Profile Settings Access Control**: Registered `User Profile Settings Components` category under `Settings > Access`, enabling Superadmin and Admin role-level visibility control and temporary overrides for Leave Tracker Workspace, Quotes Manager Workspace, KPI & Performance Settings, and Change Password.
- **Global Feature Flags Integration**: Added matching `profile_component_` entries to `Settings > Feature Flags`, enabling instant global ON/OFF toggles across all user accounts.
- **Dynamic Component Guarding**: Updated `ProfileSettings.tsx` and `StaffSettingsForm.tsx` to dynamically query `isTabVisibleForRole` policies before rendering sensitive profile form sections.
- **Manual Department Preservation**: Enforced 100% manual control over staff department assignments with no automatic overwrites.
- **Full Architectural Audit & Documentation Sync**: Completed an A-Z codebase review and completely refreshed project documentation.

### 🩹 v6.7.3 — Patch Release (Unified Staff Settings, Role Permissions & Manual Department Control)

- **Unified Staff Profile Form**: Replaced fragmented profile inputs with unified `StaffSettingsForm` across both Settings > Profile and User Management > User Profile.
- **Workspace & Feature Flag Permissions**: Enforced strict per-role permissions for Leave Tracker, Quotes Manager, and KPI Performance settings across User, Supervisor, Admin, and Superadmin roles.
- **Individual Feature Flags Bug Fix**: Fixed per-user feature flag overrides to correctly display and persist real database values.
- **Manual Department Control**: Completely removed legacy auto-swap/auto-repair scripts; user and admin manual department configurations are preserved 100%.
- **Dynamic Save Changes Button**: Enforced disabled state by default when no fields are modified, enabling dynamically as soon as permitted fields are edited.
- **Inline Change Password Layout**: Re-aligned the Change Password section into a 3-column inline grid across full container width.

### 🩹 v6.7.2 — Patch Release (Flag Icon Verification, Explicit SVG Dimensions & Auto-Repair Refinement)

- **Explicit Vector SVG Dimensions**: Updated `<BdFlagIcon />` and `<UkFlagIcon />` with explicit SVG dimensions (`width=18`, `height=12`) and crisp borders (`border-white/20`), completely eliminating OS emoji font dependencies.
- **Refined Department Auto-Repair**: Background database migration automatically scans and restores profiles mistakenly set to 'IT' back to 'Data Entry'.
- **Live Clock Cross-Platform Consistency**: Fixed header clock layout rendering on Windows, macOS, Linux, and mobile browsers.

### 🩹 v6.7.1 — Patch Release (Android Auto-Updater Fixes, Cross-Platform SVG Flag Rendering & Department Auto-Repair)

- **Android Mobile Auto-Update Fixes**: Fixed state timing bug preventing mobile update checks, added 3-source version resolution (GitHub manifest, GitHub API, Supabase), and introduced interactive Download & Install action button with fallback.
- **Cross-Platform SVG Vector Flags**: Replaced OS-dependent Unicode flag emojis with crisp inline SVG vector icons for Bangladesh 🇧🇩 and United Kingdom 🇬🇧, fixing Windows Segoe UI text rendering issues.
- **Department Database Auto-Repair**: Implemented automated client-side background migration reverting mistakenly overwritten profile department records from 'IT' back to 'Data Entry'.
- **Safe Global Settings Preservation**: Updated user profile update handler to safely preserve existing KPI skills, department indicators, and department selections upon saving.

### 🚀 v6.7.0 — Minor Release (Supervisor Access Controls, Per-Supervisor Overrides, KPI Evaluation Period & Workspace Permission Delegation)

- **Per-Supervisor Specific Access Controls**: Added supervisor dropdown selector and granular subtab permission overrides under Settings > Access (`User Management > User Profile > Leave History / Quotes History / Analytics / KPI & Performance / Profile Settings`).
- **Workspace Permission Delegation & Prompt Modal**: Enables Quotes Manager Workspace with automatic confirmation prompt modal to assign a supervisor. If assigned, filetype permissions and KPI settings are managed by the supervisor (or admin with explicit KPI subtab permission).
- **KPI Evaluation Period & Date Bounding**: Added Full Year (`Jan 1 - Dec 31`) & custom evaluation date ranges for KPI performance calculations automatically fetching submitted quote data.
- **Header & Button Contrast Fixes**: Resolved wrapping white space in leaderboard header and updated disabled button contrast in Light Mode.

### 🚀 v6.6.0 — Minor Release (Role & Per-User Temporary Access Controls, Custom DateTime Picker, Alignment & Feature Flag Management)

- **Superadmin Access Control Matrix**: Registered `Quick Import` & `Custom Quote Entry` as controllable subtabs under Tab Access Matrix (`Settings > Access`).
- **Per-User & Per-Role Temporary Access**: Configurable time-boxed temporary overrides targeting either an entire role (`user`, `supervisor`, `admin`) or a specific single user by `Codename (Full Name)`.
- **Added Save Password Checkbox**: Added a "Save Password" checkbox to the login panel with continuous syncing to `localStorage` and native browser autocomplete attributes (`username`, `current-password`).
- **Multi-User Logout & State Cleanup:** Injected state cleanup on logout (clearing `cached_profile_`, `qc_session_id`), invalidating module-level initial state, and adding fetching concurrency guards to fix loading screen hangs during rapid user switches.
- **Session Heartbeat Egress Elimination:** Completely removed repetitive `profiles.global_settings` heartbeat updates for existing user sessions, eliminating unnecessary Supabase DB writes and Realtime broadcast messages while preserving 1-week inactivity logout.
- **Forgot Password API & Timeout Fix:** Optimized the forgot password endpoint to fire admin notification lookups asynchronously (non-blocking), increased native app (Capacitor/Tauri) fetch timeouts to 15 seconds, and added duplicate tap guards to fix false "network error" popups on desktop and Android apps.
- **Security Audit Remediation:** Resolved 3 critical audit findings: PII protection on email resolution, atomic `jsonb_set` settings updates, and username enumeration prevention.

### 🚀 v6.2.0 — Multi-Device & Copy Helper Release

- **Multi-Device Login:** A user can now stay logged in simultaneously on Web, Desktop, and Android (up to 10 devices/browsers). Every per-device logout path (manual logout, inactivity expiry, stale-session cleanup, session eviction) now uses `signOut({ scope: 'local' })`.
- **Copy Helper for All Users:** The Copy Helper dashboard is now available to every authenticated user. Box visibility is driven by the **Sale** file-type permission.
- **Admin Sales Summary (New):** "Sales Report for Admin" box showing today's overall deduplicated sales across all users, computed server-side via a new `get_admin_sales_summary` RPC.

### 🚀 v6.1.0 — Stability & Hardening Release

- **Leaderboard Data Accuracy:** Removed 4,200 duplicate records caused by a faulty cache auto-restore, added a database unique index on `records (user_id, file_name, submitted_at)`.
- **Expanded Working Hours (4h–10h):** Working Hours options now span 4 Hours to 10 Hours in 30-minute increments, generated from a single shared source of truth (`src/utils/workingHours.ts`).
- **Save File Helper — Once-Per-Day Directory:** Fixed duplicate folder prompt.

### 🚀 v6.0.0 — Major Performance Release

- **Supabase Optimization:** Implemented strict PostgreSQL query filtering inside profile handlers.
- **Automated Database Cleanups:** Scheduled a daily background cron job inside Supabase to automatically purge audit history older than 90 days.

---

_Developed by Kamrul Islam, IT Officer, B&F Corporate._
