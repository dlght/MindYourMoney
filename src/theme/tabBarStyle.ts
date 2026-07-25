import type { ThemeColors } from "@/theme/colors";

export interface TabBarInsets {
  bottom: number;
}

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
    paddingBottom: Math.max(insets.bottom, 8),
    height: 56 + insets.bottom,
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  };
}
