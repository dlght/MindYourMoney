import { getTabBarStyle } from "@/theme/tabBarStyle";
import { themeColors } from "@/theme/colors";

describe("getTabBarStyle", () => {
  it("floors paddingBottom at 8 when the device reports a zero safe-area inset", () => {
    const style = getTabBarStyle({ bottom: 0 }, themeColors.light);

    expect(style.paddingBottom).toBe(8);
    expect(style.height).toBe(56);
  });

  it("respects a non-zero safe-area inset (e.g. a home indicator)", () => {
    const style = getTabBarStyle({ bottom: 34 }, themeColors.light);

    expect(style.paddingBottom).toBe(34);
    expect(style.height).toBe(90);
  });

  it("uses the surface token (not background) so the bar is distinct from page content — light theme", () => {
    const style = getTabBarStyle({ bottom: 0 }, themeColors.light);

    expect(style.backgroundColor).toBe(themeColors.light.surface);
    expect(style.backgroundColor).not.toBe(themeColors.light.background);
  });

  it("uses the surface token (not background) so the bar is distinct from page content — dark theme", () => {
    const style = getTabBarStyle({ bottom: 0 }, themeColors.dark);

    expect(style.backgroundColor).toBe(themeColors.dark.surface);
    expect(style.backgroundColor).not.toBe(themeColors.dark.background);
  });

  it("includes platform-appropriate elevation/shadow so the bar reads as raised, not flat", () => {
    const style = getTabBarStyle({ bottom: 0 }, themeColors.light);

    expect(style.elevation).toBeGreaterThan(0);
    expect(style.shadowOpacity).toBeGreaterThan(0);
    expect(style.shadowOffset).toEqual(expect.objectContaining({ height: expect.any(Number) }));
  });
});
