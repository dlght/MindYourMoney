import type { ThemeColors } from "@/theme/colors";

export interface TabBarInsets {
  bottom: number;
}

// Base height (excluding the safe-area reservation) large enough for a
// comfortable ~48px+ tap target per icon/label pair, not just the glyph
// itself — self-critique from real-device feedback: 56px read as "small
// and hard to click" even once safe-area padding was correct.
const BASE_HEIGHT = 64;

/**
 * Pure style computation (contracts/tab-bar-visibility-contract.md) so the
 * safe-area/elevation rule is unit-testable without rendering the Tabs tree.
 * `paddingBottom` floors at 8 so 0-inset devices (older Android, most
 * desktop browsers) still keep a visible margin below the icons.
 */
export function getTabBarStyle(insets: TabBarInsets, colors: ThemeColors) {
  return {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: Math.max(insets.bottom, 8),
    height: BASE_HEIGHT + insets.bottom,
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  };
}
