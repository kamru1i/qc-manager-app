# 🌟 ছুটি (Chuti) — Role-Based Office Leave Tracker

A premium, modern, and offline-first Progressive Web App (PWA) built with **Next.js (TypeScript)** and **Supabase (PostgreSQL)**. It is designed to manage employee sign-in/out, track working hours, and automate multi-role leave approvals and adjustments (Full Day, Short Leave, Overtime, and Reserve Holiday) with Google Sheets-level logic and synchronization.

---

## 🚀 Key Features

### 👤 User (Staff) Dashboard
*   **Time Tracking**: Live tracking of daily working hours and break durations.
*   **Sign-In / Sign-Out**: Single-click sign-in/out with customizable default timings.
*   **Leave Requests**: Submit applications for 4 types of leaves (Full Leave, Short Leave, Overtime, and Reserve Holiday).
*   **Government Holiday Response**: Users with reserve options enabled can select between taking a holiday payment ("Get Paid") or reserving it for future leaves ("Reserve") directly from interactive dashboard banners. For users with reserve disabled, payment is automatically routed to salary with a direct notification (no admin intervention needed). Admin is only notified in Admin Mode for users who manually make choices.
*   **Bulk Full Leave Entry & Single-Action Approval**: Dynamically submit up to 10 dates for Full Leave simultaneously using a "+" button in the interface. Prevents duplicate selection and inserts distinct database rows under a shared `bulk_id`. In the supervisor and admin dashboards, the request is grouped into a **single, unified action row** (displaying all dates as a comma-separated list), allowing the supervisor or admin to approve, reject, or request revision for the entire bulk package in one click.
*   **Leave Adjustment**: Request adjustments (e.g., using accumulated overtime or reserve holidays to offset short leaves).
*   **Personal Filtering Panel**: Filter personal records by category, year (with year-locked calendars), or custom date ranges.
*   **Excel Exports**: Export filtered personal leave and attendance histories directly to Excel.
*   **Realtime Sync**: Seamlessly syncs updates with the administrative database in real time.

### 👥 Supervisor Panel
*   **Request Management**: Approve or reject leave, adjustment, or profile change requests submitted by supervisees.
*   **Hierarchical Approvals**: Support for multi-stage supervisor-to-admin workflows (e.g., `pending_supervisor` -> `approved_by_supervisor` -> `approved`).

### 🔑 Admin Dashboard
*   **Comprehensive Staff List**: A master table displaying every staff member's unadjusted leave and overtime counts.
*   **User Account Control**: Create, update, or delete staff credentials, passwords, and roles directly from the interface.
*   **Holiday Response Report & Export**: A dedicated administrative panel to search, filter by date/name, and export employee holiday choices (Paid vs. Reserve) to Excel and PDF for salary integrations.
*   **Settings Overrides**: Customize individual rules per user, such as enabling/disabling overtime (`allow_overtime`), reserve holidays (`allow_reserve`), or supervisor approval bypass (`needs_supervisor_approval`).
*   **Quick Adjustments**: Perform instant, direct leave adjustments for any user, bypassing normal multi-level approval workflows.
*   **Master Data Export**: Export the entire company’s leave summary database to Excel in one click.

### 📶 Offline-First & Realtime Features (PWA)
*   **Service Worker (`sw.js`)**: Caches static assets for offline startup and updates. Handles GET requests only to prevent cache poisoning.
*   **IndexedDB Storage (`offlineSync.ts`)**: Locally queues attendance logs and leave submissions if the device loses connection. Prevented connection leaks and duplicate synchronization issues.
*   **Background Synchronization**: Automatically syncs queued offline data to Supabase once internet connectivity is restored, featuring a dynamic online reconnection toast.
*   **Supabase Realtime Replication**: Real-time listeners automatically update dashboard metrics and tables when database changes occur, avoiding manual page reloads.
*   **Web Push Notifications**: Alerts users of status updates, profile modifications, or approval events in real time.

### 🎨 Modern UI/UX Enhancements & Security
*   **Glassmorphism Modals**: Delete, Adjustment, and Cancellation modals feature clean modern blurred backgrounds (`backdrop-blur-md bg-slate-900/80 border-slate-800`).
*   **Scroll-Safe Overlay Modals**: Critical input forms and settings modals (Profile Settings, Add Leave, Create User, Credentials Edit) now feature `overflow-y-auto` overlay wrappers combined with centering min-height frames to dynamically support low-resolution (e.g. 19-inch monitors) or highly zoomed viewports without clipping headers or action buttons.
*   **Micro-animations**: Dynamic scale interactions on action buttons (`hover:scale-[1.01] active:scale-[0.99]`) for premium responsiveness.
*   **Automatic Offline/Online Toast**: Screen corner toasts alert users of offline status and background synchronization processes.
*   **Password Toggle Visibility**: Sign-in page features an interactive eye icon to hide/show password characters on mobile or desktop.
*   **Pinpoint Auto-Logout Timer**: Users are strictly logged out if they do not complete their password change and profile setup within 10 minutes. Utilizes resilient persistent `localStorage` timestamps to prevent timer reset on page reload or hibernation. Includes an immediate Logout button within the setup modal for convenience.
*   **Rate Limiting & Bypass**: The `/api/send-push` notification API limits users to 1 request per 5 seconds to prevent network spamming, while supervisors and admins bypass this to allow unhindered bulk submissions.
*   **Stacked Push Notifications**: Enabled stacking and concurrent display of multiple push notifications by omitting static tags, preventing notifications from blocking or overwriting each other on the desktop.
*   **Direct & Hierarchical Notification Triggers**:
    *   Submitting a request (or a revision) now immediately notifies both Supervisors and Admins if supervisor approval is required.
    *   Direct profile change submissions notify Admins, and their approval/rejection notifies the staff member.
    *   Direct leave adjustments and edits applied by Admins immediately send push notifications to the corresponding staff member.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide Icons |
| **Database & Auth** | Supabase (PostgreSQL), Postgres Row-Level Security (RLS), Triggers, PG Functions, RPCs |
| **Offline Sync** | IndexedDB API, Service Worker API |
| **Notifications** | Web Push API, `web-push` Node Library, VAPID Keys |

---

## 📁 Project Structure

```text
chuti/
├── public/                 # PWA Icons, manifest.webmanifest, and sw.js (GET-only caching)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── send-push/  # Push API handler with 5-second rate limiting
│   │   │       └── route.ts
│   │   ├── login/          # Login panel with username-to-email mapping & password toggle
│   │   │   └── page.tsx
│   │   ├── globals.css     # Dark-mode glassmorphic theme definitions
│   │   ├── layout.tsx
│   │   └── page.tsx        # Core App Dashboard (Glassmorphic modals, stats, filters, tables)
│   ├── js/                 # Organized directory for diagnostic and maintenance scripts
│   └── utils/
│       ├── offlineSync.ts  # IndexedDB store, fetch, and connection leak-free background sync
│       ├── supabase.ts     # Supabase Client configuration
│       └── webPushHelper.ts# Push notification registration and helper routines
├── supabase/
│   └── schema.sql          # Unified database schema setup (tables, triggers, policies, and RPC functions)
├── eslint.config.mjs       # ESLint configurations with global ignores
├── package.json
│── tsconfig.json
```

---

## 🗄️ Database Schema Details

The database is built on PostgreSQL with strict Row Level Security (RLS) policies.

### Tables
1.  **`public.profiles`**: Contains employee metadata (roles, usernames, default sign-in/out times, and supervisor requirements). Linked to `auth.users` via a Postgres trigger (`on_auth_user_created`) that auto-populates the profile upon signup.
2.  **`public.Chuti`**: Holds attendance logs and leave records. Contains date-uniqueness constraints (`unique_user_date`) to prevent duplicate entries and fields utilizing Postgres `INTERVAL` types for precise hour calculations.
3.  **`public.push_subscriptions`**: Holds VAPID push endpoints, auth tokens, and browser public keys for individual users.

### Row Level Security (RLS) Summary
*   **Users**: Can read/write their own profiles and chuti entries.
*   **Supervisors**: Can read all profiles/Chuti and approve/reject entries for their staff.
*   **Admins**: Possess full read/write permissions for all profiles, Chuti entries, and system configurations.

---

## 💻 Local Development Setup

### 1. Prerequisites
*   Node.js (v18 or higher)
*   A Supabase project setup

### 2. Database Initialization
Run the unified database SQL script in your Supabase SQL Editor:
1.  Execute the entire content of `supabase/schema.sql` (Creates all tables, columns, indexes, RLS policies, triggers, and RPC helper functions).

### 3. Environment Setup
Create a `.env.local` file in the root directory:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Web Push (VAPID) Configuration
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

*Note: You can generate VAPID keys using the command `npx web-push generate-vapid-keys`.*

### 4. Running the App
Install dependencies and run the development environment:
```bash
# Install packages
npm install

# Start Next.js development server
npm run dev

# Check Linting
npm run lint

# Build optimized production bundle
npm run build
```

---
---

# 🌟 ছুটি (Chuti) — রোল-ভিত্তিক অফিস অ্যাটেনডেন্স অ্যান্ড লিভ ট্র্যাকার (Bangla Version)

**Next.js (TypeScript)** এবং **Supabase (PostgreSQL)** দিয়ে তৈরি একটি আধুনিক, প্রিমিয়াম এবং অফলাইন-ফার্স্ট প্রোগ্রেসিভ ওয়েব অ্যাপ (PWA)। এটি মূলত অফিসের কর্মকর্তাদের প্রতিদিনের সাইন-ইন/আউট, কাজের সময় ট্র্যাকিং এবং রোল অনুযায়ী ছুটির অনুমোদন ও সমন্বয়ের (ফুল ডে লিভ, শর্ট লিভ, ওভারটাইম এবং রিজার্ভ হলিডে) কাজগুলো গাণিতিক নিখুঁততায় স্বয়ংক্রিয় করার জন্য ডিজাইন করা হয়েছে।

---

## 🚀 মূল ফিচারসমূহ

### 👤 কর্মকর্তা (Staff) ড্যাশবোর্ড
*   **কাজের সময় ট্র্যাকিং**: দৈনিক মোট কাজের ঘণ্টা এবং ব্রেকের সময় সরাসরি ট্র্যাকিং।
*   **সাইন-ইন / সাইন-আউট**: এক ক্লিকে সাইন-ইন/আউট করার সুবিধা এবং কাস্টম ডিফল্ট সময় সেট করা।
*   **ছুটির আবেদন**: ৪ ধরণের ছুটির (ফুল লিভ, শর্ট লিভ, ওভারটাইম এবং রিজার্ভ হলিডে) আবেদন প্রক্রিয়া।
*   **সরকারি ছুটির সিদ্ধান্ত (Get Paid vs Reserve)**: যার প্রোফাইলে সরকারি ছুটির রিজার্ভ অপশন চালু আছে, সে নোটিফিকেশন ব্যানার থেকে সরাসরি 'Reserve' বা 'Get Paid' নির্বাচন করতে পারবে। আর যার রিজার্ভ অপশন বন্ধ আছে, সে সরাসরি নোটিফিকেশন পাবে যে ছুটির পেমেন্ট বেতনের সাথে যোগ হবে। উভয় ক্ষেত্রেই অপ্রয়োজনীয় বাড়তি নোটিফিকেশন বা জটিলতা এড়ানো হয়েছে এবং এডমিন নোটিফিকেশন প্যানেলে শুধুমাত্র রিজার্ভ অপশন অন থাকা ব্যবহারকারীদের পছন্দগুলো রিয়েল-টাইমে দেখতে পাবেন।
*   **বাল্ক ফুল লিভ এন্ট্রি ও একক অনুমোদন**: "Full Leave" সিলেক্ট করলে প্লাস (+) আইকন বোতামের সাহায্যে এক ক্লিকে সর্বোচ্চ ১০টি অতিরিক্ত তারিখ যোগ করার সুবিধা। ডুপ্লিকেট তারিখ নির্বাচন রোধের লাইভ সতর্কতা এবং প্রতিটি তারিখের আলাদা রেকর্ড একটি কমন `bulk_id` সহ ডাটাবেজে সংরক্ষিত হওয়ার সুবিধা। এছাড়া, সুপারভাইজার এবং অ্যাডমিনের এপ্রুভাল প্যানেলে এটিকে একক রিকোয়েস্ট (কমা দিয়ে তারিখগুলো সাজিয়ে) হিসেবে দেখাবে এবং মাত্র **এক ক্লিকে সম্পূর্ণ বাল্ক প্যাকেজটি অ্যাপ্রুভ বা রিভিশনে পাঠানো যাবে**।
*   **ছুটি সমন্বয় (Adjustment)**: কাজের অতিরিক্ত ঘণ্টা (Overtime) বা জমে থাকা রিজার্ভ ডে দিয়ে শর্ট লিভ অ্যাডজাস্ট করার রিকোয়েস্ট পাঠানো।
*   **ব্যক্তিগত ফিল্টারিং প্যানেল**: বছর-লকড ক্যালেন্ডার এবং ক্যাটাগরি দিয়ে নিজের ছুটির রেকর্ড ফিল্টার করা।
*   **এক্সপোর্ট সুবিধা**: ফিল্টার করা সমস্ত ডেটা এক ক্লিকে Excel ফরম্যাটে ডাউনলোড করার সুবিধা।
*   **রিয়েল-টাইম সিঙ্ক**: এডমিন প্যানেল এবং ইউজারের ড্যাশবোর্ডের মধ্যে ইনস্ট্যান্ট ডেটা সিঙ্ক্রোনাইজেশন।

### 👥 সুপারভাইজার (Supervisor) প্যানেল
*   **আবেদন ব্যবস্থাপনা**: নিজের টিমের সদস্যদের ছুটির আবেদন, প্রোফাইল আপডেট বা অ্যাডজাস্টমেন্টের অনুরোধ অনুমোদন অথবা প্রত্যাখ্যান করা।
*   **অনুমোদন চেইন**: সুপারভাইজার থেকে এডমিন পর্যন্ত ধাপে ধাপে আবেদন যাওয়ার প্রসেস (`pending_supervisor` -> `approved_by_supervisor` -> `approved`)।

### 🔑 এডমিন (Admin) ড্যাশবোর্ড
*   **মাস্টার সামারি টেবিল**: প্রতিষ্ঠানের সকল স্টাফদের মোট ছুটির হিসাব ও ব্যালেন্স এক নজরে দেখার মাস্টার প্যানেল।
*   **ইউজার অ্যাকাউন্ট কন্ট্রোল**: নতুন স্টাফ তৈরি করা, পাসওয়ার্ড রিসেট বা কোডনেম আপডেট করার সরাসরি প্যানেল।
*   **সরকারি ছুটির রেসপন্স রিপোর্ট ও এক্সপোর্ট**: কর্মকর্তাদের পেমেন্ট বা রিজার্ভ করার সিদ্ধান্তগুলো সহজে অনুসন্ধান করার জন্য সার্চ ফিল্টার প্যানেল এবং এক ক্লিকে Excel ও PDF ফরম্যাটে রিপোর্ট ডাউনলোড করার প্যানেল।
*   **আইন কানুন কাস্টমাইজেশন**: কর্মকর্তা অনুযায়ী রুলস পরিবর্তন করা (যেমন: ওভারটাইম অন/অফ করা, রিজার্ভ ডে অ্যাক্সেস বা সুপারভাইজার অ্যাপ্রুভাল বাধ্যতামূলক করা)।
*   **কুইক অ্যাডজাস্টমেন্ট**: এডমিন প্যানেল থেকে সরাসরি যেকোনো ইউজারের ছুটি ইনস্ট্যান্ট অ্যাডজাস্ট করে দেওয়া (কোনো প্রকার পেন্ডিং অ্যাপ্রুভালের প্রয়োজন ছাড়া)।
*   **মাস্টার ডেটা এক্সপোর্ট**: প্রতিষ্ঠানের সকল কর্মকর্তাদের ছুটির সামগ্রিক ডেটাবেজ এক ক্লিকে Excel-এ ডাউনলোড করা।

### 📶 অফলাইন-ফার্স্ট ও রিয়েল-টাইম প্রযুক্তি (PWA)
*   **সার্ভিস ওয়ার্কার (`sw.js`)**: অফলাইনেও অ্যাপটি লোড হতে সাহায্য করে। এতে ক্যাশ পয়জনিং রুখতে কেবল GET রিকোয়েস্ট ক্যাশ করা হয়।
*   **IndexedDB ব্যাকআপ (`offlineSync.ts`)**: ইন্টারনেট চলে গেলে ইউজারের সাইন-ইন/আউট এবং ছুটির রিকোয়েস্ট লোকাল ডিভাইসে ব্যাকআপ রাখে। ডাটাবেজ কানেকশন লিক ও ডুপ্লিকেট সিঙ্ক সম্পূর্ণ নিষ্ক্রিয় করা হয়েছে।
*   **ব্যাকগ্রাউন্ড সিঙ্ক ও রিকানেক্ট টোস্ট**: ইন্টারনেট পুনরায় চালু হওয়ার সাথে সাথেই লোকাল ডেটা স্বয়ংক্রিয়ভাবে ডেটাবেজে পাঠিয়ে দেয় এবং স্ক্রিনে রিকানেক্ট সাকসেস টোস্ট শো করে।
*   **পুশ নোটিফিকেশন**: ইউজারের আবেদন এডিট, রিজেক্ট বা অ্যাপ্রুভ হলে ব্রাউজারে সরাসরি ইনস্ট্যান্ট পুশ নোটিফিকেশন এলার্ট চলে যায়।

### 🎨 আধুনিক UI/UX এবং সিকিউরিটি আপডেট
*   **গ্লাস-মরফিজম মডাল**: ডিলিট, সমন্বয় এবং ক্যানসেল কনফার্মেশন মডালগুলোকে আধুনিক ব্লার ও শ্যাডো ইফেক্ট (`backdrop-blur-md bg-slate-900/80 border-slate-800`) দেওয়া হয়েছে।
*   **স্ক্রোল-সেফ মডাল ডিজাইন**: ইনপুট ফর্ম এবং সেটিংস মডালগুলোতে (প্রোফাইল সেটিংস, নতুন ছুটির এন্ট্রি, স্টাফ যুক্ত করা, ক্রেডেনশিয়াল এডিট) `overflow-y-auto` এবং ডাইনামিক সেন্টারিং যুক্ত করা হয়েছে। এর ফলে কম রেজোলিউশন বা মনিটর জুম করা থাকলেও মডাল কেটে না গিয়ে সম্পূর্ণ স্ক্রোলযোগ্য থাকে।
*   **মাইক্রো-অ্যানিমেশন**: প্রতিটি অ্যাকশন বাটনে হোভার ও ক্লিকের সময়ে ইন্টারেক্টিভ ও স্মুথ স্কেল ট্রানজিশন ইফেক্ট বসানো হয়েছে।
*   **পাসওয়ার্ড টোগল বাটন**: লগইন করার সুবিধার্থে পাসওয়ার্ড ফিল্ডের ডানে চোখ আইকনযুক্ত শো/হাইড বাটন যোগ করা হয়েছে।
*   **পিনপয়েন্ট অটো-লগআউট টাইমার**: নতুন ইউজার লগইনের পর ১০ মিনিটের মধ্যে পাসওয়ার্ড পরিবর্তন না করলে স্বয়ংক্রিয়ভাবে লগআউট সম্পন্ন হবে। ব্রাউজার রিলোড বা স্লিপ মোডে গেলেও `localStorage` টাইমস্ট্যাম্পের কারণে টাইমার রিসেট হবে না। জরুরী প্রস্থানে সহায়তার জন্য ফার্স্ট-টাইম পাসওয়ার্ড মডালে সরাসরি লগআউট করার বোতাম যুক্ত রয়েছে।
*   **এপিআই রেট লিমিট ও বাইপাস**: প্রতি ব্যবহারকারী ৫ সেকেন্ডে ১ বারের বেশি পুশ রিকোয়েস্ট করতে পারবে না, তবে এডমিন ও সুপারভাইজাররা এই উইন্ডো লিমিট থেকে মুক্ত থাকবেন যাতে বাল্ক রিকোয়েস্ট সহজে পাঠানো যায়।
*   **স্ট্যাকড পুশ নোটিফিকেশন**: নোটিফিকেশন ওভাররাইট হওয়া রোধ করতে স্ট্যাটিক ট্যাগ সরিয়ে একাধিক নোটিফিকেশন একসাথে স্ক্রিনে স্ট্যাক বা শো করার ব্যবস্থা করা হয়েছে।
*   **সরাসরি ও অনুক্রমিক নোটিফিকেশন ট্রিগার:**
    *   ছুটির আবেদন বা রিভিশন সাবমিট করা হলে সুপারভাইজার ও এডমিন উভয়েই পুশ নোটিফিকেশন পাবেন (যদি সুপারভাইজার এপ্রুভাল অন থাকে)।
    *   ইউজারের প্রোফাইল পরিবর্তনের আবেদনের জন্য এডমিনরা এবং এডমিনের সিদ্ধান্ত অনুযায়ী সংশ্লিষ্ট স্টাফ মেম্বার সাথে সাথে পুশ নোটিফিকেশন পাবেন।
    *   এডমিন সরাসরি ছুটির তথ্য এডিট বা সমন্বয় অ্যাপ্রুভ করলে সংশ্লিষ্ট স্টাফ মেম্বার সাথে সাথে পুশ নোটিফিকেশন পাবেন।

---

## 🛠️ টেকনোলজি স্ট্যাক

*   **ফ্রন্টএন্ড**: React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide Icons
*   **ডেটাবেজ ও অথেন্টিকেশন**: Supabase (PostgreSQL), Postgres Row-Level Security (RLS), Triggers, PG Functions, RPCs
*   **অফলাইন সিঙ্ক**: IndexedDB API, Service Worker API
*   **নোটিফিকেশন ইঞ্জিন**: Web Push API, `web-push` Node Library, VAPID Keys

---

## 💻 লোকাল রান করার নিয়মাবলী

১. গিটহাব থেকে ক্লোন করে `npm install` দিয়ে প্যাকেজগুলো ইন্সটল করে নিন।
২. আপনার Supabase প্রোজেক্টের SQL এডিটরে গিয়ে একত্রিত ডাটাবেজ স্ক্রিপ্ট `supabase/schema.sql`-এর সম্পূর্ণ কোডটি রান করুন (এটি প্রোফাইল, ছুটি, নোটিফিকেশন সাবস্ক্রিপশন এবং সমস্ত পলিসি/ফাংশন একসাথে তৈরি করবে)।
৩. প্রজেক্টের রুটে `.env.local` ফাইল তৈরি করে আপনার Supabase এবং VAPID Credentials বসিয়ে দিন:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Web Push (VAPID) Configuration
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```
৪. রান করার জন্য টার্মিনালে কমান্ড ব্যবহার করুন:
   *   লোকাল রান: `npm run dev`
   *   বিল্ড টেস্ট: `npm run build`
   *   লিন্ট টেস্ট: `npm run lint`

---

## 🖥️ Desktop Application (Tauri Integration)

We have integrated **Tauri v2** to package **Office Chuti Tracker** as a native desktop application for **Windows** and **macOS** (Intel & Apple Silicon).

### Prerequisites

To develop or build the desktop app locally, you need:
- **Rust**: Install from [rustup.rs](https://rustup.rs/).
- **Platform Development Tools**:
  - **Windows**: Install Microsoft Visual Studio with the "Desktop development with C++" workload.
  - **macOS**: Install Xcode Command Line Tools via `xcode-select --install`.

### Development & Build Commands

- **Run Dev Environment (Desktop Window)**:
  ```bash
  npm run tauri dev
  ```
- **Build Native Installers**:
  - For local platform build:
    ```bash
    npm run tauri build
    ```
  - For cross-compiling macOS Intel target (on macOS):
    ```bash
    npm run tauri build -- --target x86_64-apple-darwin
    ```
  - For cross-compiling macOS Apple Silicon target (on macOS):
    ```bash
    npm run tauri build -- --target aarch64-apple-darwin
    ```

### Automated GitHub Releases (CI/CD)

An automated build pipeline is configured in [.github/workflows/tauri-build.yml](file:///.github/workflows/tauri-build.yml).
Upon pushing to branches (`main`, `master`) or creating a version tag (e.g. `v2.0.2`), GitHub Actions will:
1. Export Next.js static files (`out/` directory).
2. Set up Rust toolchains.
3. Compile three native target applications:
   - **Windows (x64)** `.msi` / `.exe` installer.
   - **macOS Intel (x86_64)** `.dmg` installer.
   - **macOS Apple Silicon (aarch64)** `.dmg` installer.
4. Automatically attach the build installers to the draft release on GitHub under the current version (e.g., `v2.0.2`).

---

## 📜 Version History / Changelog

### 🚀 v2.0.6 (Latest)
* **Dynamic Review Period Defaults**: Added dynamic fallback selection for review periods under the Review & Settlements panel based on the current calendar month.
* **Leave Carryover Calculations Fix**: Resolved carryover calculation anomalies where H1 leaves were automatically carried over to H2 without a processed H1 settlement.

### 🚀 v2.0.5
* **OS-Specific Tray Customizations**: Added a dynamic Open/Close Chuti option depending on whether the application window is visible or hidden.
* **Windows Click Handler**: Set Windows double-left click to open the app window, single-left click to do nothing, and single-right click to show the tray menu.
* **macOS Click Handler**: Left or right single-click on the tray menu icon will only display the context menu rather than automatically opening the app.

### 🚀 v2.0.4
* **Background Executions**: Enabled background persistence in Tauri on Windows and macOS. When the window is closed, it hides to the tray and remains active to deliver real-time notifications.
* **Tray Context Menu**: Implemented a system tray/menu bar right-click menu with "Open Chuti" (shows and focuses window) and "Exit" (quits application completely) options.
* **macOS Dynamic Dock Management**: Seamlessly show/hide the macOS Dock icon matching window visibility (hides Dock icon in `Accessory` mode when hidden, shows Dock icon in `Regular` mode when window is opened) to maintain a premium macOS native utility design.

### 🚀 v2.0.3
* **Tray Icon Fix**: Resolved the missing tray icon bug on Windows & macOS desktop apps.
* **Native Desktop Notifications**: Integrated direct native notification triggers using Tauri APIs and optimized backend API workflows to broadcast realtime events to active desktop screens immediately.
* **Chrome Multi-Account Push Fix**: Addressed RLS delete policy conflicts on the `push_subscriptions` table to prevent constraint failures when switching user profiles on Chrome.
* **Sleek Settings UX Polish**: Redesigned the settings screen to place a compact \"Test\" button right next to the Desktop Notifications toggle bell icon.

### 🚀 v2.0.2
* **Alignment Fixes**: Center-aligned middle columns (Codename, Role, Full/Short Leave, Overtime) in StaffMasterTable for Admin dashboard, and center-aligned all columns in LeavesRecordsTable for User dashboard.

### 🚀 v2.0.1
* **Visual Polish**: Fixed a loading spinner bug where container backgrounds caused a dark grey horizontal shadow band overlay by changing the layout and loading class wrappers to match the body's pure black background perfectly.

### 🚀 v2.0.0
* **Tauri Native Desktop Notifications**: Enabled native notification capabilities (`"notification:default"`) in Tauri v2 sandbox configuration for full Windows and macOS desktop notification support.
* **Realtime Broadcast Integration**: Integrated native notifications with Supabase realtime broadcast system.

### 🚀 v1.2.0
* **Custom Carry Forward Directions**: Added carry-forward directions selection (H1 to H2 vs H2 to Next Year's H1) with target period dynamic saves.
* **Manual Override Validation**: Enforced validation that manual carry-forward override days must be greater than 0.
* **Advanced Deficit Resolution Options**: Implemented independent deficit resolution options including Salary Deduction, Adjust with H2 Office Leave (H1 records), Adjust with Next Year's H1 Quota (H2 records), and Adjust with Holiday/Eid Reserves (creating/updating second settlement records dynamically).
* **Notification Polish**: Improved processed settlement notification descriptions for negative balance resolutions.

### 🚀 v1.1.1
* **Unified Database Schema**: Consolidated all database migration SQL scripts into the base `supabase/schema.sql` file and removed redundant migration files.
* **Database Default Bug Fix**: Fixed a mismatch where `leave_settlements.status` defaulted to `'pending'` in the schema but was restricted to `('initiated', 'responded', 'processed')` in constraints, changing the default to `'initiated'`.

### 🚀 v1.1.0
* **Premium Skeleton Loaders**: Replaced full-screen and inline spinners with high-fidelity, shimmering table and dashboard skeletons across all major sections (Leaves, Staff list, Settlements, and Admin dashboard).
* **Layout Shift Prevention**: Prevented page shifts on reload/load by properly gating layout renders with conditional loading blocks.
* **Profile Header Parentheses Bug Fix**: Resolved empty parenthesis `()` text rendering in the Admin dashboard profile header when loading profiles.
* **Syntax & Type Safety Checks**: Fixed small syntax bugs and fully validated build compile checks.

### 🚀 v1.0.0
* **Delta Sync Implementation**: Integrated complete Delta sync mechanisms. On subsequent updates, the client only queries records modified since the last sync (`.gte('updated_at', lastSyncedAt)`) and merges updates dynamically into cache, significantly reducing bandwidth and payload sizes.
* **Cache Integrity Overhaul**: Replaced destructive full cache clearing calls with targeted upserts (`upsertCacheItem` and `mergeCacheData`) to prevent losing supervisor/admin cached profiles.
* **Graceful Offline Session Recovery**: Added resilient timeout and catch-block recovery paths in `fetchSession` to prevent redirection to `/login` when offline users experience JWT token expiration.
* **English Conflict Resolution Toasts**: Standardized and translated all offline sync warnings and conflict notifications from Bengali to English, featuring an 8-second visibility duration.
* **Localized App Details**: Translated all application titles, short titles, and push fallback prompts in `manifest.json` and `sw.js` to English.
* **PWA Offline Asset Optimization**: Added PWA configuration manifest, icons, and vector logo files directly to the pre-caching asset lists in the custom Service Worker.

### 🚀 v0.1.7
* **macOS Production Network Fix**: Resolved a webview routing issue where macOS production protocol was misidentified as local dev environment, causing login failures.
* **Tauri Native File Save**: Integrated native dialog and filesystem plugins to allow users to securely save Excel exports directly to their folder choice.
* **Embedded Iframe PDF Printing**: Replaced popups with an embedded iframe print flow to bypass webview popup blocker limitations.
* **Desktop UI Clean Up**: Hidden all download banners and links when the app is running in the desktop Tauri context.
* **Offline Build Speed Up**: Removed unused Google Fonts dependency for offline-compatible builds and faster compile times.

### 🚀 v0.1.6
* **Three-Way Split Settlements**: Implemented detailed split allocations (Carry Forward, Cash Payment, Adjust with other leaves) for Year-End settlements with real-time progress bar feedback and validation check constraints.
* **Selection Flicker Bug Fix**: Synchronous lazy state initialization from props implemented inside settlements editing to eliminate UI flicker.
* **Unified Action Loader Spinners**: Added button loading indicator spinners (`RefreshCw` icon), disabled interactions, and layout stability improvements for Cancel Adjustment, Edit Record, Holiday choice actions, and other modals.
* **Relaxed Password Validations**: Removed strict digit/letter constraint rules on passwords while capping the length bounds securely between 6 to 12 characters.
* **Settlement Clear Filter Option**: Added search and instant clear filters inside the settlements reports listing.

### 🚀 v0.1.5
* **Windows/macOS Startup Hang Fix**: Disabled PWA Service Worker (`sw.js`) registration in the Tauri desktop app context and added automatic unregistration of any old service worker instances to resolve cold boot white-screen issues.
* **Safe Session Initialization**: Added a 4-second timeout protection (`Promise.race`) in Supabase getSession calls to prevent loading overlays from hanging indefinitely during poor network start-up.
* **macOS Bundle Warning Fix**: Changed tauri bundle identifier to `com.Chuti.tracker` to avoid collision warnings.
* **Dynamic Eid Holiday Remaining Cards**: User dashboard now dynamically displays stats cards for Eid-ul-Fitr and Eid-ul-Adha holiday quotas if the user has remaining days (auto-hiding when fully adjusted or 0).
* **Modal Loader Integrations**: Added loading spinner states inside AddLeaveModal and AdminAddLeaveModal to prevent async rendering glitches.
* **Database Schema Fix**: Relocated ALTER PUBLICATION statement in schema.sql to prevent database query errors on clean setup.

### 🚀 v0.1.4
* **Maximized Window on Launch**: The desktop app now launches in maximized state by default (filling the screen while keeping taskbar and title controls visible).
* **High-Quality Anti-Aliased Icons**: Icons are resampled using advanced Lanczos3 downscaling for extreme clarity across all resolutions on Windows/macOS.
* **Smart Govt Holiday Notifications**:
  - *Reserve Enabled Users*: Notified to choose between Reserve / Get Paid. When chosen, the user is not spammed, and only the admin is notified (only in Admin Mode).
  - *Reserve Disabled Users*: Automatically notified that their holiday payment will be added directly to their salary (no admin action required).
* **Smart Notification Separation**: Admin notifications regarding staff actions now only show when in Admin Mode (no longer cluttering the normal User Dashboard).

### 🚀 v0.1.3
* High-quality icon integration and maximized window default launcher adjustments.

### 🚀 v0.1.2
* Multi-size ICO generation, cleaner Tauri installer configuration, and automated build publishing pipeline setup.


