import { test, expect } from "./fixtures/test-account";

// Covers the Sign in / Navigate every tab / Sign out scenarios from
// specs/006-pwa-e2e-layout-fix/contracts/e2e-test-scenarios.md.

test("signs in, visits every tab, and signs out", async ({ signedInPage: page }) => {
  // Sign in already happened in the fixture — confirms the Home tab
  // rendered its distinguishing content. "heading" (not plain text)
  // disambiguates from the bottom tab bar's own "Home" label (F9).
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  await page.getByRole("tab", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();

  await page.getByRole("tab", { name: "Rules" }).click();
  await expect(page.getByRole("button", { name: "Add rule" })).toBeVisible();

  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByText(/Signed in as/)).toBeVisible();

  await page.getByRole("tab", { name: "Home" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  // No console/page error across the whole navigation pass.
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 15_000 });
  expect(pageErrors).toEqual([]);
});
