# Contract: Primary Screen Edge Spacing

Defines the minimum spacing rule FR-009/FR-010/FR-011 require across the
four primary screens (`app/(tabs)/index.tsx` →
`DashboardScreen.tsx`, `app/(tabs)/add.tsx`, `app/(tabs)/rules.tsx` →
`RulesScreen.tsx`, `app/(tabs)/settings.tsx`), so "add breathing room" has
a concrete, checkable definition rather than being left to visual
judgment alone.

## Rule

On mobile viewport widths, every primary screen's outermost content
container MUST provide, beyond whatever the device's safe-area insets
already reserve:

- **Top**: at least 16px of additional space between the safe-area
  boundary and the first piece of content (already-existing
  `edges={["top"]}` `SafeAreaView` usage stays; this adds a fixed value on
  top of `insets.top`, following the same inline-arithmetic pattern
  `ExpenseSheet.tsx` already uses for its bottom inset).
- **Bottom**: at least 16px of additional space between the last piece of
  scrollable content and the tab bar, in addition to the tab bar's own
  safe-area handling (does not change `edges` to include `"bottom"` on
  screens where that would double-count the inset per the existing
  `add.tsx` comment — the 16px is content-side padding, not another
  `SafeAreaView` edge).
- **Left/Right**: a consistent 24px (`px-6`, matching the value already in
  use on most of these screens today) horizontal padding on the outermost
  container, applied uniformly across all four screens rather than
  incidentally.

## Non-goals

- No new spacing/design-token system is introduced (research.md #2) — this
  is a normalization of the existing inline/utility-class approach.
- Does not apply to modal/sheet content (`ExpenseSheet.tsx`,
  `RuleSheet.tsx`), which already implements its own inset-aware padding
  correctly and is not in scope per spec.md's "primary screens" framing.

## Verification

SC-004 requires zero elements measured flush (0px effective gap) against a
screen edge. This is checked by the E2E suite (US2) via a bounding-box
measurement against the viewport edges on each primary screen, and
manually via the quickstart.md validation steps.
