<!--
Sync Impact Report
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification)
Modified principles: n/a (first fill of template)
Added sections:
  - Core Principles I–IX (Mobile-First Delivery, Supabase-Only Backend,
    Free-Tier Discipline, Offline-Tolerant by Default, Notifications Are
    Core Not an Afterthought, Money as Exact Decimal, Consistent Modern UI,
    Spec-Driven Delivery, Small Mergeable Iterations)
  - Governance
Removed sections:
  - Optional "[SECTION_2_NAME]" / "[SECTION_3_NAME]" template slots (not
    needed; their intent — stack constraints and delivery workflow — is
    already covered by Principles I–III and VIII–IX)
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no change needed (Constitution
    Check gate is already generic, references "constitution file")
  - .specify/templates/spec-template.md ✅ no change needed (no
    constitution-specific references)
  - .specify/templates/tasks-template.md ✅ no change needed (task
    categorization is generic; testing-discipline tasks already supported
    as optional)
  - .claude/skills/speckit-*/SKILL.md ✅ reviewed, no outdated
    project-specific references found
Follow-up TODOs: none
-->

# MindYourMoney Constitution

## Core Principles

### I. Mobile-First Delivery
The product ships as a React Native + Expo application using Expo Router
for navigation. TypeScript strict mode is mandatory for all app code.
No web-first or backend-first detours: every feature is designed and
built for the mobile client first.

Rationale: the core value proposition (proactive expense alerts) only
matters if it reaches the user on their phone; splitting effort across
platforms before the mobile experience is solid would dilute the MVP.

### II. Supabase-Only Backend
Postgres, Auth, and Edge Functions on Supabase are the only backend
primitives used. Every table MUST have Row Level Security enabled and
scoped to `auth.uid()`. No custom/self-hosted servers are introduced.

Rationale: one managed backend keeps operational cost and surface area
at zero and guarantees per-user data isolation is enforced at the
database layer, not just in application code.

### III. Free-Tier Discipline
No service or library may be adopted that requires a paid plan or
subscription to function at MVP scale. Every new dependency is checked
against its provider's free-tier limits before being added.

Rationale: this is a personal/side project; cost must stay at zero until
(and unless) the product justifies paid infrastructure.

### IV. Offline-Tolerant by Default
The app MUST open and display previously-loaded data with no network
connection. Reads are served from a local cache first (e.g. cached
Supabase queries, `expo-sqlite`/MMKV); network calls refresh in the
background.

Rationale: expense tracking is a habit-forming, low-friction tool —
it fails as a product if it can't be opened on a train or in a basement
with no signal.

### V. Notifications Are Core, Never an Afterthought
Every mutation to an expense or a rule MUST reconcile the device's
scheduled notifications (create, update, or cancel as needed) as part
of the same operation, not a follow-up step. This reconciliation logic
MUST be covered by tests.

Rationale: notifications are the entire reason this app exists ("never
be surprised by an expense again"); a stale or missing notification is
a product failure, not a minor bug, so it gets the same rigor as data
persistence.

### VI. Money as Exact Decimal
Monetary amounts are stored as `numeric(12,2)` in Postgres and MUST
NEVER be represented as native floating-point numbers in JavaScript/
TypeScript business logic. Use integer cents or a decimal library for
all in-app arithmetic and comparisons.

Rationale: floating-point rounding errors are unacceptable in anything
that reports totals, thresholds, or budget breaches to a user managing
their own money.

### VII. Consistent Modern UI
All screens are built on the NativeWind design system with first-class
dark and light themes. Unstyled default React Native components MUST
NOT ship to users; every visible element goes through the shared design
system.

Rationale: the product's differentiation depends partly on not looking
like a generic budgeting-app template; visual consistency is a stated
product goal, not polish to defer.

### VIII. Spec-Driven Delivery
Every feature MUST ship with a spec, a plan, a task breakdown, and
tests (unit tests for the rule/notification engine, component tests for
screens) before it is considered done.

Rationale: the project is explicitly run through the
`/speckit-constitution → /speckit-specify → /speckit-plan →
/speckit-tasks → /speckit-implement` loop; skipping an artifact breaks
that loop's ability to keep future iterations grounded in agreed scope.

### IX. Small, Mergeable Iterations
One Spec Kit feature equals one mergeable slice of work. Features are
scoped so each can be implemented, reviewed, and merged independently
rather than accumulating into large, multi-feature branches.

Rationale: keeps review tractable and lets the MVP1 → MVP2 → MVP3 →
full-version roadmap (see `docs/mindyourmoney-spec.md`) advance in
verifiable steps instead of big-bang rewrites.

## Governance

This constitution supersedes any ad hoc convention or prior practice
when the two conflict. All plans, specs, and PRs MUST verify compliance
with these nine principles before being merged; any deviation MUST be
recorded and justified in the relevant plan's Complexity Tracking table.

Amendments are made only through the `/speckit-constitution` flow: they
require an updated Sync Impact Report (prepended to this file), a
semantic version bump (MAJOR for incompatible principle removals or
redefinitions, MINOR for new/materially expanded principles, PATCH for
wording/clarification-only changes), and a check that
`.specify/templates/plan-template.md`, `spec-template.md`, and
`tasks-template.md` remain consistent with the updated principles.

Use this file as the source of runtime governance guidance for all
Spec Kit commands (`/speckit-specify`, `/speckit-plan`, `/speckit-tasks`,
`/speckit-implement`, and related skills) operating in this repository.

**Version**: 1.0.0 | **Ratified**: 2026-07-16 | **Last Amended**: 2026-07-16
