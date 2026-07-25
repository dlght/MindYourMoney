import { test, expect } from "./fixtures/test-account";
import type { Page } from "@playwright/test";

// Covers the Add/Edit/Delete rule scenarios from
// specs/006-pwa-e2e-layout-fix/contracts/e2e-test-scenarios.md.
// Names deliberately avoid the words "Add"/"Edit"/"Delete"/"Save"/"Enable"/
// "Disable" — those collide via Playwright's substring role-name matching
// with the sheet's own button labels once embedded in a rule row's
// accessible name (see expense-flows.spec.ts for the same lesson).

async function openAddRuleSheet(page: Page) {
  await page.getByRole("tab", { name: "Rules" }).click();
  await page.getByRole("button", { name: "Add rule" }).click();
}

async function openRuleByName(page: Page, name: string) {
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
}

test.describe("rule flows", () => {
  test("adds a rule, then removes it", async ({ signedInPage: page, uniqueName }) => {
    const name = uniqueName("E2E Rule One");

    await openAddRuleSheet(page);
    await page.getByLabel("Rule name").fill(name);
    await page.getByLabel("Days before due date").fill("5");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // Cleanup (FR-007).
    await page.getByRole("button", { name: `Delete ${name}`, exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toHaveCount(0);
  });

  test("edits a rule", async ({ signedInPage: page, uniqueName }) => {
    const name = uniqueName("E2E Rule Two");

    await openAddRuleSheet(page);
    await page.getByLabel("Rule name").fill(name);
    await page.getByLabel("Days before due date").fill("3");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await openRuleByName(page, name);
    await page.getByLabel("Days before due date").fill("7");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(
      page.getByRole("button", { name: `Edit ${name}`, exact: true })
    ).toContainText("7 days before", { timeout: 10_000 });

    // Cleanup.
    await page.getByRole("button", { name: `Delete ${name}`, exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toHaveCount(0);
  });

  test("removes a rule", async ({ signedInPage: page, uniqueName }) => {
    const name = uniqueName("E2E Rule Three");

    await openAddRuleSheet(page);
    await page.getByLabel("Rule name").fill(name);
    await page.getByLabel("Days before due date").fill("2");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: `Delete ${name}`, exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toHaveCount(0);
  });
});
