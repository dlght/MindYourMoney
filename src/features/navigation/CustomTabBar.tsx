import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View, useColorScheme } from "react-native";
import { themeColors } from "@/theme/colors";

// Fully custom tab bar (F9 follow-up) — replaces reliance on
// screenOptions.tabBarStyle/tabBarLabelStyle/tabBarItemStyle, which on the
// deployed web/PWA build were not producing the actual on-screen sizing
// their computed values implied (confirmed via a real-device debug probe:
// useSafeAreaInsets() correctly reported bottom=34 and the raw CSS
// env(safe-area-inset-bottom) matched, yet the tab bar still visibly
// clipped its labels — pointing at React Navigation's own web tab bar
// rendering, not the inset math, as the actual gap). Rendering every pixel
// here with plain View/Text/Pressable removes that entire black box:
// React Native Web's mapping of these primitives to DOM is simple and
// predictable, so the padding/sizing below is guaranteed to be what
// actually renders, on every platform.
export function CustomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = themeColors[colorScheme];

  return (
    <View
      testID="custom-tab-bar"
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        // No fixed `height` at all — the bar's total height is whatever
        // its content (icon + label + this padding) naturally needs, plus
        // the safe-area reservation below. Content-driven sizing can't
        // under-allocate space the way a fixed height guess can.
        paddingBottom: Math.max(insets.bottom, 8),
        elevation: 8,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused ? colors.accent : colors.textMuted;
        const label =
          options.tabBarLabel !== undefined && typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : (options.title ?? route.name);

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              paddingVertical: 8,
              gap: 2,
            }}
          >
            {options.tabBarIcon?.({ focused: isFocused, color, size: 26 })}
            <Text style={{ fontSize: 12, fontWeight: "500", color }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
