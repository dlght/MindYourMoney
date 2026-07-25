# Contract: Tab Bar Visual Distinction & Safe-Area Clearance

Defines the concrete, checkable rule FR-001/FR-002/FR-003/FR-004/FR-005
require for `app/(tabs)/_layout.tsx`'s `Tabs` `screenOptions.tabBarStyle`, so
"clearly visible and usable" isn't left to visual judgment alone.

## Rule

On every primary screen (Home, Add, Rules, Settings), in both light and dark
theme, on both native and the PWA/web build, the rendered tab bar MUST:

1. **Be visually distinct from page content**: background color MUST be
   `themeColors[scheme].surface` (not `.background`, which matches the page),
   AND the bar MUST carry a platform-appropriate elevation/shadow (Android
   `elevation`, iOS `shadowColor`/`shadowOffset`/`shadowOpacity`/
   `shadowRadius`, web via the same `shadow*` props translated to
   `box-shadow` by React Native Web) in addition to the existing
   `borderTopColor` hairline.
2. **Never render a tab icon or label under the device's bottom safe-area
   inset**: the bar's `paddingBottom` MUST be at least
   `useSafeAreaInsets().bottom`, with a floor of 8px so bars on 0-inset
   devices (older Android, most desktop/browser contexts) still keep a
   visible margin below the icons.
3. **Preserve a minimum comfortable tap target**: total bar height (icon +
   label + all padding, excluding the safe-area reservation itself) MUST
   remain at least the platform-standard ~56px band already implied by the
   unmodified icon/label sizes — the fix adds padding/elevation around the
   existing tap targets, it does not shrink them.

## Non-goals

- No change to the tab set, icons, route structure, or `Tabs.Screen` options
  beyond `screenOptions.tabBarStyle`.
- No new design-token system — reuses `src/theme/colors.ts`'s existing
  `surface`/`border`/`background` tokens.
- Does not touch modal/sheet UI (`ExpenseSheet.tsx`, `RuleSheet.tsx`), which
  is unrelated to the persistent bottom tab bar.

## Verification

SC-001 (0 obscured elements under the safe area) and SC-002 (measurably
distinct from adjacent content in both themes) are checked via:
- A component-level test asserting the computed `tabBarStyle` object's
  `paddingBottom`/`height` reflect a given mocked `useSafeAreaInsets()`
  value, and that `backgroundColor` resolves to `.surface` (not
  `.background`) for both `light` and `dark` `colors` inputs.
- Manual/quickstart visual check across light/dark and a simulated
  safe-area-inset device profile (native) and mobile-width browser viewport
  (web).
