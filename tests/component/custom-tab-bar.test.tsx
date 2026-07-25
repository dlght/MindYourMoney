import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CustomTabBar } from "@/features/navigation/CustomTabBar";

function makeProps(overrides: Partial<BottomTabBarProps> = {}): BottomTabBarProps {
  const routes = [
    { key: "index-key", name: "index" },
    { key: "add-key", name: "add" },
  ];

  const descriptors = {
    "index-key": { options: { title: "Home", tabBarIcon: () => <Text>home-icon</Text> } },
    "add-key": { options: { title: "Add", tabBarIcon: () => <Text>add-icon</Text> } },
  };

  const navigate = jest.fn();
  const emit = jest.fn().mockReturnValue({ defaultPrevented: false });

  return {
    state: { index: 0, routes } as unknown as BottomTabBarProps["state"],
    descriptors: descriptors as unknown as BottomTabBarProps["descriptors"],
    navigation: { navigate, emit } as unknown as BottomTabBarProps["navigation"],
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    ...overrides,
  };
}

describe("CustomTabBar", () => {
  it("renders every route's icon and label", async () => {
    await render(<CustomTabBar {...makeProps()} />);

    expect(screen.getByText("home-icon")).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("add-icon")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("marks the focused route as the selected tab", async () => {
    await render(<CustomTabBar {...makeProps({ state: { index: 1, routes: makeProps().state.routes } as never })} />);

    expect(screen.getByRole("tab", { name: "Add", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Home", selected: false })).toBeTruthy();
  });

  it("navigates to a tapped, not-yet-focused tab", async () => {
    const props = makeProps();

    await render(<CustomTabBar {...props} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Add" }));

    expect(props.navigation.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tabPress", target: "add-key" })
    );
    expect(props.navigation.navigate).toHaveBeenCalledWith("add");
  });

  it("does not navigate again when tapping the already-focused tab", async () => {
    const props = makeProps();

    await render(<CustomTabBar {...props} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Home" }));

    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it("does not navigate when the emitted tabPress event was prevented", async () => {
    const props = makeProps({
      navigation: {
        navigate: jest.fn(),
        emit: jest.fn().mockReturnValue({ defaultPrevented: true }),
      } as unknown as BottomTabBarProps["navigation"],
    });

    await render(<CustomTabBar {...props} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Add" }));

    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it("reserves at least the device's bottom safe-area inset as padding, floored at 8", async () => {
    await render(<CustomTabBar {...makeProps({ insets: { top: 0, bottom: 0, left: 0, right: 0 } })} />);
    expect(screen.getByTestId("custom-tab-bar").props.style.paddingBottom).toBe(8);

    await render(<CustomTabBar {...makeProps({ insets: { top: 0, bottom: 34, left: 0, right: 0 } })} />);
    expect(screen.getAllByTestId("custom-tab-bar").at(-1)?.props.style.paddingBottom).toBe(34);
  });
});
