# 🌟 QC App — Unified Office Leave Tracker & Quotes Manager

A premium, modern, and high-performance desktop and web utility built with **Next.js (TypeScript)**, **Supabase (PostgreSQL)**, and **Tauri v2**. It integrates two comprehensive corporate workspaces under a single secure, role-based role management structure.

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
*   **Staff Master List**: Complete employee grid showing details, active role badges, and accrued leave/overtime hours.
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
| **Frontend** | React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide Icons |
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

---

## 📜 Version History / Changelog

### 🚀 v1.0.0 (First Official Release)
*   **Unified Workspace Launch**: Integrated both Leave Tracker (Chuti) and Quotes Manager workspaces under a single secure application shell.
*   **Inline User Configuration**: Replaced popup modals with a reusable, highly responsive inline settings panel (`StaffSettingsForm`) for editing and adding staff profiles.
*   **Circular UI Components**: Standardized all checkboxes as perfect circles.
*   **Slide Transitions**: Added smooth CSS sliding animations to all toggle switches.
*   **Space Correction inside Supervisor Lists**: Fixed a flexbox gap alignment bug that caused an unnecessary empty space on the left of supervisor check circles.
*   **Dev Mode Updater Quiet Mode**: App updater checks are now disabled in development environment to avoid console clutter.
*   **Cascading Cleanup Rules**: Programmed database cascades to delete associated records cleanly when removing a staff profile.
*   **Password Setup Enforcement**: Automated modal lock to force new users using default credentials `1234` to update their login passwords.

*Developed by Kamrul Islam, IT Officer, B&F Corporate.*
