# MindYourMoney — Product Discovery & Build Plan

> A spec-driven blueprint for a mobile app that tracks upcoming and monthly expenses and alerts you about the big ones — before they hit. Written to be fed into Spec Kit + Claude Code for iterative implementation.

---

## 1. Discovery

### Problem
People know their salary but are routinely surprised by lumpy expenses: annual insurance, car tax, subscriptions renewing, a big utility bill in winter. Budgeting apps focus on *past* spending analysis; almost none focus on *forward-looking alerts with user-defined rules*.

### Core value proposition
"Never be surprised by an expense again." MindYourMoney is a **forward-looking expense radar**: you log upcoming and recurring expenses, define alert rules (amount thresholds, days-before warnings, category rules), and the app notifies you proactively.

### Target user
- A single person or household managing their own money (not businesses).
- Wants low-effort manual entry, not bank syncing (bank APIs are a later, optional feature — they add cost, compliance and complexity).

### What MindYourMoney is NOT (scope guardrails)
- Not a bank-connected transaction aggregator (v1).
- Not an investment tracker.
- Not a shared/split-the-bill app like Splitwise (groups here = *categories*, not people).

### Key user stories
1. As a user, I add an upcoming expense with amount, due date, category, and optional recurrence.
2. As a user, I define notification rules like "warn me 5 days before any expense over €200".
3. As a user, I see next month's total upcoming expenses at a glance, grouped by category.
4. As a user, I mark an expense as paid and it rolls forward if recurring.
5. As a user, I get a monthly summary: planned vs. actually paid.

---

## 2. Expense groups (categories)

Ship these as defaults, let users add/rename/archive their own. Each has a color and icon for the modern UI.

| Group | Examples | Suggested icon/color |
|---|---|---|
| 🏠 Housing | Rent, mortgage, property tax, home insurance | house / indigo |
| ⚡ Utilities | Electricity, water, heating, internet, phone | bolt / amber |
| 🚗 Transport | Car payment, fuel, insurance, vignette, public transit pass, maintenance | car / blue |
| 🛒 Groceries & Household | Food, cleaning supplies | cart / green |
| 💊 Health | Health insurance, medication, dentist, gym | heart / red |
| 📺 Subscriptions | Netflix, Spotify, iCloud, software licenses | repeat / purple |
| 🎓 Education & Kids | Tuition, courses, school supplies, childcare | book / teal |
| 🎉 Lifestyle & Leisure | Dining out, travel, hobbies, gifts | sparkles / pink |
| 🏦 Debt & Savings | Loan installments, credit card payment, savings transfer | bank / slate |
| 🧾 Taxes & Fees | Income tax, municipal fees, bank fees | receipt / orange |
| ❓ Other | Anything uncategorized | dots / gray |

Design rule: expenses require a category; "Other" is the fallback so entry never blocks on categorization.

---

## 3. Notification rules — initial defaults

Rules are the heart of the product. Model each rule as **condition(s) + trigger timing + channel**.

### Default rules shipped on first launch (user can edit/disable)
1. **Big expense ahead** — any upcoming expense **≥ €200** → notify **5 days before** due date, and again **1 day before** if not marked paid.
2. **Due tomorrow** — any expense of any amount → notify 1 day before (quiet, grouped notification).
3. **Monthly heads-up** — on the **25th of each month**: "Next month you have N expenses totaling €X. Biggest: [name, amount, date]."
4. **Budget breach** — if a category's planned total for next month exceeds its budget (once budgets exist, MVP2) → notify immediately when the expense that breaches it is added.
5. **Recurring price jump** — if a recurring expense is edited to an amount >10% higher than last cycle → confirm + optional notify (MVP2).

### Rule schema (what the rule builder supports)
- **Conditions** (AND-combined): `amount >= X`, `category in [...]`, `recurring == true/false`, `tag == ...`
- **Trigger**: `N days before due date` (0–30), `on a fixed day of month`, `when expense is created/edited`
- **Action**: push notification (v1); email/digest (later)
- **Snooze/again logic**: optional second reminder N days later if not marked paid

MVP1 ships rules 1–3 with a simple builder (threshold amount + days-before + optional category filter). The full condition engine comes in MVP2.

---

## 4. Technology stack (free-tier, modern, mobile)

| Layer | Choice | Why | Free tier |
|---|---|---|---|
| Mobile framework | **React Native + Expo (Expo Router)** | One codebase for iOS + Android, huge ecosystem, first-class with AI coding agents, OTA updates via EAS Update | Expo SDK free; EAS free tier for builds |
| UI kit | **NativeWind (Tailwind for RN)** + **react-native-reanimated** + custom design system | Modern, fast to iterate, not "template-looking" | Free |
| Charts | **victory-native** or **react-native-gifted-charts** | Monthly overview visuals | Free |
| Backend / DB | **Supabase** (Postgres + Row Level Security) | DB, auth, storage, edge functions, cron — one free service | 500MB DB, 50k MAU auth, edge functions included |
| Auth | **Supabase Auth** (email magic link + Apple/Google sign-in) | Zero-cost login, RLS ties data to user | Free |
| Push notifications | **Expo Push Notifications** + Supabase **pg_cron + Edge Function** that evaluates rules daily and sends pushes | Fully free server-driven notifications; local scheduled notifications as offline fallback | Free |
| State/data | **TanStack Query** + Supabase client; **expo-sqlite / MMKV** cache for offline | Snappy, offline-tolerant | Free |
| CI & distribution | **GitHub + GitHub Actions + EAS Build** | Free CI; internal distribution / TestFlight | Free tiers |
| Spec-driven dev | **GitHub Spec Kit** + **Claude Code** | `/constitution → /specify → /plan → /tasks → /implement` loop per feature | Spec Kit is open source |

### Notification architecture (important design decision)
- **Local notifications (MVP1)**: when an expense or rule is created/edited, the app schedules device-local notifications via `expo-notifications`. Zero backend needed, works offline. Limitation: rules re-evaluate only when the app opens.
- **Server-driven (MVP2)**: Supabase `pg_cron` job runs daily → Edge Function evaluates all users' rules against upcoming expenses → sends Expo push tokens batch. Reliable even if the app hasn't been opened.
- MVP1 uses local only; MVP2 adds the server path and keeps local as fallback.

### Alternative stack (if you prefer Google ecosystem)
Flutter + Firebase (Firestore, Firebase Auth, FCM, Cloud Functions). Equally valid; choose it if you prefer Dart. The Expo+Supabase path is recommended because SQL fits expense/rule queries better and RN pairs better with web reuse later.

---

## 5. Data model (Postgres / Supabase)

```sql
-- users handled by supabase auth (auth.users)

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  icon text, color text,
  is_default boolean default false,
  archived boolean default false
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories,
  name text not null,
  amount numeric(12,2) not null,
  currency text default 'EUR',
  due_date date not null,
  recurrence text,          -- null | 'monthly' | 'yearly' | rrule string later
  status text default 'planned',  -- planned | paid | skipped
  paid_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  enabled boolean default true,
  min_amount numeric(12,2),      -- null = any amount
  category_ids uuid[],           -- null = all categories
  days_before int not null default 5,
  repeat_days_before int,        -- optional 2nd reminder
  created_at timestamptz default now()
);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  expense_id uuid,
  rule_id uuid,
  sent_at timestamptz default now(),
  channel text default 'push'
);
-- RLS: every table policy = user_id = auth.uid()
```

---

## 6. MVP1 — smallest thing that delivers the core value

**Goal: a user can add expenses, set one or two simple rules, and actually get notified. Nothing else.**

### In scope
1. **Auth**: email magic-link sign-in (Supabase). Skippable local-only mode optional.
2. **Expense CRUD**: name, amount, due date, category (from default list), recurrence monthly/yearly toggle, mark-as-paid (recurring auto-rolls to next period).
3. **Default categories** seeded per user (list from §2), no custom categories yet.
4. **Simple rules**: the two defaults pre-created ("≥ €200 → 5 days before", "any → 1 day before"); user can edit threshold, days-before, and toggle on/off.
5. **Local notifications** scheduled/rescheduled on every expense/rule change.
6. **Home screen**: "Next 30 days" list sorted by due date, total for next month, biggest upcoming expense highlighted.
7. **Modern UI baseline**: dark/light theme, category colors, one clean font, smooth add-expense sheet.

### Explicitly out of scope for MVP1
Custom categories, budgets, server push, charts, monthly summary, multi-currency, export, complex rule conditions.

### MVP1 success criteria
- Add an expense in under 15 seconds.
- Notification fires at the correct time for both default rules.
- Recurring expense rolls forward when marked paid.

---

## 7. Roadmap after MVP1

### MVP2 — reliability + insight
- Server-driven notifications (pg_cron + Edge Function + Expo push) so alerts fire even if the app is closed for weeks.
- Custom categories (add/rename/color/archive).
- Monthly heads-up digest (rule #3) and per-category **budgets** with breach alerts (rule #4).
- Monthly overview screen: planned vs paid, bar chart by category, month-over-month trend.
- Full rule builder: multiple conditions (amount, categories, recurring flag), second reminder.

### MVP3 — polish + retention
- Home-screen widgets (iOS/Android) showing next big expense.
- Search, tags, attachments (photo of a bill → Supabase Storage).
- Multi-currency with fixed user-set rates; CSV export.
- Onboarding flow with template packs ("Homeowner", "Renter", "Car owner").
- Biometric app lock.

### Full version (v1.0 public)
- Household sharing: invite a partner to a shared space (RLS via `space_id`).
- Smart suggestions: detect likely recurring expenses from entry patterns; yearly-expense calendar heatmap.
- Email monthly digest; notification quiet hours.
- Optional paid tier ideas for sustainability: unlimited attachments, shared spaces >2 people, bank import (via a provider like GoCardless/Nordigen free tier) — all optional, core stays free.
- Accessibility pass, localization (start EN + your local language), App Store / Play release via EAS Submit.

---

## 8. How to run this with Spec Kit + Claude Code

Initialize Spec Kit in the repo, then drive one feature per iteration:

1. **`/constitution`** — paste the principles below.
2. **`/specify`** — paste one feature spec at a time (start with Feature 1).
3. **`/plan`** — provide the stack constraints from §4.
4. **`/tasks`** then **`/implement`** — let the agent execute; review each PR.

### Constitution (paste-ready)
```
MindYourMoney Constitution
1. Mobile-first: React Native + Expo (Expo Router), TypeScript strict mode.
2. Backend is Supabase only (Postgres, Auth, Edge Functions). All tables use RLS scoped to auth.uid(). No custom servers.
3. Free-tier discipline: no service or library requiring payment.
4. Offline-tolerant: reads cached locally; app must open and show data without network.
5. Notifications are a core feature, never an afterthought: every expense/rule mutation must reconcile scheduled notifications, covered by tests.
6. Money is numeric(12,2), never floats in JS logic (use integer cents or decimal lib).
7. UI: NativeWind design system, dark/light themes, no unstyled default components.
8. Every feature ships with: spec, plan, tasks, tests (unit for rule engine, component tests for screens).
9. Small iterations: one Spec Kit feature = one mergeable slice.
```

### Feature specs in build order (each is one `/specify` input)
1. **F1 — Project scaffold & auth**: Expo app with Expo Router tabs (Home, Add, Rules, Settings), Supabase project, magic-link auth, session persistence, seeded default categories on first login.
2. **F2 — Expense CRUD & recurrence**: expenses table + RLS, add/edit/delete sheet, monthly/yearly recurrence, mark-as-paid rolls recurring expenses to next due date.
3. **F3 — Home dashboard**: next-30-days list grouped by date, next-month total, biggest upcoming expense card, empty states.
4. **F4 — Rules & local notifications**: rules table, rule editor (threshold, days-before, category filter, enable toggle), notification scheduler that reconciles all local notifications on any expense/rule change, notifications_log.
5. **F5 — Server push (MVP2)**: store Expo push tokens, pg_cron daily job, Edge Function rule evaluator, dedupe against notifications_log.
6. **F6 — Custom categories & budgets**: category management UI, per-category monthly budget, breach detection on expense create/edit.
7. **F7 — Monthly insights**: planned vs paid summary, category bar chart, month navigation.
8. …continue with MVP3/full-version items as separate specs.

### Acceptance-test seeds for F4 (the critical feature)
- Given rule "≥200, 5 days before" and expense €250 due in 10 days → a notification is scheduled for due_date−5.
- Editing the expense to €150 → that notification is cancelled.
- Disabling the rule → all its notifications are cancelled.
- Marking a recurring expense paid → notifications reschedule for the next occurrence.
