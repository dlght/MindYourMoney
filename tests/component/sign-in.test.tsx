import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import SignInScreen from "../../app/(auth)/sign-in";
import { useSession } from "@/features/auth/useSession";

jest.mock("@/features/auth/useSession");

const mockUseSession = useSession as jest.Mock;

describe("SignInScreen", () => {
  const signIn = jest.fn();
  const signUp = jest.fn();
  const clearAuthError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      signIn,
      signUp,
      authError: null,
      clearAuthError,
    });
  });

  it("shows a validation error for an invalid email and does not call signIn", async () => {
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText("Email address"), "not-an-email");
    await fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    await fireEvent.press(screen.getByText("Sign in"));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows a validation error for a too-short password and does not call signIn", async () => {
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText("Email address"), "user@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "abc");
    await fireEvent.press(screen.getByText("Sign in"));

    expect(await screen.findByText("Password must be at least 6 characters.")).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("calls signIn with the entered credentials", async () => {
    signIn.mockResolvedValue({ error: null });
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText("Email address"), "user@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    await fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("user@example.com", "password123")
    );
  });

  it("shows the sign-in error returned from the auth call", async () => {
    signIn.mockResolvedValue({ error: "Invalid login credentials" });
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText("Email address"), "user@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "wrongpassword");
    await fireEvent.press(screen.getByText("Sign in"));

    expect(await screen.findByText("Invalid login credentials")).toBeTruthy();
  });

  it("switches to create-account mode and calls signUp", async () => {
    signUp.mockResolvedValue({ error: null, needsEmailConfirmation: false });
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByText("Don't have an account? Create one"));
    await fireEvent.changeText(screen.getByLabelText("Email address"), "new@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    await fireEvent.press(screen.getByText("Create account"));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("new@example.com", "password123")
    );
  });

  it("shows a confirm-your-email state when the project requires email confirmation", async () => {
    signUp.mockResolvedValue({ error: null, needsEmailConfirmation: true });
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByText("Don't have an account? Create one"));
    await fireEvent.changeText(screen.getByLabelText("Email address"), "new@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    await fireEvent.press(screen.getByText("Create account"));

    expect(await screen.findByText("Confirm your email")).toBeTruthy();
  });
});
