import { test as base, expect, type Page } from "@playwright/test";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name} — copy .env.e2e.example to .env.e2e and fill in ` +
        "real dedicated test-account credentials before running the E2E suite."
    );
  }
  return value;
}

interface TestAccountFixtures {
  // A page already signed in with the dedicated E2E test account
  // (specs/006-pwa-e2e-layout-fix/data-model.md — "Test Account").
  signedInPage: Page;
  // Generates a name unique to this run so scenarios never collide with
  // leftover data from a prior (possibly interrupted) run, and can find
  // "their own" rows without assuming a pristine account
  // (research.md #3 / FR-007).
  uniqueName: (label: string) => string;
}

export const test = base.extend<TestAccountFixtures>({
  signedInPage: async ({ page }, use) => {
    const email = requireEnv("E2E_TEST_EMAIL");
    const password = requireEnv("E2E_TEST_PASSWORD");

    await page.goto("/");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // The Home tab renders this once the session lands and the dashboard's
    // first query resolves — a reliable "signed in" signal that doesn't
    // depend on any particular expense data existing yet.
    await expect(page.getByText("Upcoming total (next 30 days)")).toBeVisible({
      timeout: 15_000,
    });

    await use(page);
  },

  uniqueName: async ({}, use) => {
    const runId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    await use((label: string) => `${label} ${runId}`);
  },
});

export { expect };
