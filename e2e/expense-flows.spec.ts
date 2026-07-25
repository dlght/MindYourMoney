import { test, expect } from "./fixtures/test-account";
import type { Page } from "@playwright/test";

const SAVE_ERROR_TEXT = "Something went wrong saving this expense. Please try again.";

// Covers the Add/Edit/Delete expense scenarios from
// specs/006-pwa-e2e-layout-fix/contracts/e2e-test-scenarios.md, including
// the "no error message on successful save" assertion from
// contracts/expense-save-error-contract.md (US1's fix — the whole reason
// this scenario is meaningful as a regression guard).

async function openAddSheet(page: Page) {
  await page.getByRole("tab", { name: "Add" }).click();
  await page.getByRole("button", { name: "Add" }).click();
}

async function fillExpenseForm(
  page: Page,
  fields: { name: string; amount: string; dueDate: string }
) {
  await page.getByLabel("Expense name").fill(fields.name);
  await page.getByLabel("Amount").fill(fields.amount);
  await page.getByLabel("Due date").fill(fields.dueDate);
}

async function openExpenseByName(page: Page, name: string) {
  await page.getByRole("button", { name: `Expense: ${name}` }).click();
}

test.describe("expense flows", () => {
  test("adds an expense with no spurious error, then removes it", async ({
    signedInPage: page,
    uniqueName,
  }) => {
    // Names avoid the words "Add"/"Edit"/"Delete"/"Save"/"Mark" — those
    // collide (via Playwright's substring role-name matching) with the
    // sheet's own button labels once embedded in an expense row's
    // accessible name ("Expense: <name>", "Delete <name>", etc.).
    const name = uniqueName("E2E Expense Alpha");

    await openAddSheet(page);
    await fillExpenseForm(page, { name, amount: "12.34", dueDate: "2026-08-15" });
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // The sheet closes and the expense appears — and critically, no error
    // banner renders (this is what used to falsely appear per US1).
    await expect(page.getByRole("button", { name: `Expense: ${name}` })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(SAVE_ERROR_TEXT)).toHaveCount(0);

    // Cleanup (FR-007): remove what this scenario created.
    await openExpenseByName(page, name);
    await page.getByRole("button", { name: "Delete expense", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: `Expense: ${name}` })).toHaveCount(0);
  });

  test("edits an expense", async ({ signedInPage: page, uniqueName }) => {
    const name = uniqueName("E2E Expense Beta");

    await openAddSheet(page);
    await fillExpenseForm(page, { name, amount: "10.00", dueDate: "2026-08-16" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: `Expense: ${name}` })).toBeVisible({
      timeout: 10_000,
    });

    await openExpenseByName(page, name);
    await page.getByLabel("Amount").fill("99.99");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Scoped to this specific row (rather than a page-wide text search) so
    // it can't collide with any other row that happens to share an amount.
    await expect(page.getByRole("button", { name: `Expense: ${name}` })).toContainText("99.99", {
      timeout: 10_000,
    });
    await expect(page.getByText(SAVE_ERROR_TEXT)).toHaveCount(0);

    // Cleanup.
    await openExpenseByName(page, name);
    await page.getByRole("button", { name: "Delete expense", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: `Expense: ${name}` })).toHaveCount(0);
  });

  test("deletes an expense", async ({ signedInPage: page, uniqueName }) => {
    const name = uniqueName("E2E Expense Gamma");

    await openAddSheet(page);
    await fillExpenseForm(page, { name, amount: "7.50", dueDate: "2026-08-17" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: `Expense: ${name}` })).toBeVisible({
      timeout: 10_000,
    });

    await openExpenseByName(page, name);
    await page.getByRole("button", { name: "Delete expense", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("button", { name: `Expense: ${name}` })).toHaveCount(0);
  });
});
