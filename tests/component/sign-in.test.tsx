import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import SignInScreen from "../../app/(auth)/sign-in";
import { useSession } from "@/features/auth/useSession";

jest.mock("@/features/auth/useSession");

const mockUseSession = useSession as jest.Mock;

describe("SignInScreen", () => {
  const signInWithEmail = jest.fn();
  const clearLinkError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      signInWithEmail,
      linkError: null,
      clearLinkError,
    });
  });

  it("shows a validation error for an invalid email and does not call signInWithEmail", async () => {
    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email address"), "not-an-email");
    fireEvent.press(screen.getByText("Send sign-in link"));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it("shows the sent confirmation after successfully requesting a link", async () => {
    signInWithEmail.mockResolvedValue({ error: null });
    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email address"), "user@example.com");
    fireEvent.press(screen.getByText("Send sign-in link"));

    await waitFor(() => expect(signInWithEmail).toHaveBeenCalledWith("user@example.com"));
    expect(await screen.findByText("Check your email")).toBeTruthy();
  });

  it("shows a request-a-new-link state when the context reports an expired/invalid link", () => {
    mockUseSession.mockReturnValue({
      signInWithEmail,
      linkError: "This sign-in link has expired.",
      clearLinkError,
    });

    render(<SignInScreen />);

    expect(screen.getByText("This sign-in link is no longer valid")).toBeTruthy();
    expect(screen.getByText("This sign-in link has expired.")).toBeTruthy();

    fireEvent.press(screen.getByText("Request a new link"));
    expect(clearLinkError).toHaveBeenCalled();
  });
});
