import { filterUndelivered, type NotificationLogKey } from "@/features/rules/notificationEngine";
import type { NotificationCandidate } from "@/features/rules/types";

function makeCandidate(overrides: Partial<NotificationCandidate> = {}): NotificationCandidate {
  return {
    identifier: "expense:exp-1:rule:rule-1:primary",
    ruleId: "rule-1",
    triggerKind: "primary",
    triggerDateIso: "2026-08-20",
    title: "Big expense ahead",
    body: "Rent (EUR 250.00) is due on 2026-08-25.",
    expenseIds: ["exp-1"],
    ...overrides,
  };
}

describe("filterUndelivered", () => {
  it("keeps a candidate with no matching log entry", () => {
    const candidate = makeCandidate();

    const result = filterUndelivered([candidate], []);

    expect(result).toEqual([candidate]);
  });

  it("drops a per-expense candidate already delivered via any channel", () => {
    const candidate = makeCandidate();
    const existingLog: NotificationLogKey[] = [
      { expenseId: "exp-1", ruleId: "rule-1", triggerKind: "primary" },
    ];

    const result = filterUndelivered([candidate], existingLog);

    expect(result).toEqual([]);
  });

  it("does not drop a candidate whose trigger kind differs from the logged entry", () => {
    const candidate = makeCandidate({ triggerKind: "repeat", identifier: "x" });
    const existingLog: NotificationLogKey[] = [
      { expenseId: "exp-1", ruleId: "rule-1", triggerKind: "primary" },
    ];

    const result = filterUndelivered([candidate], existingLog);

    expect(result).toEqual([candidate]);
  });

  it("does not drop a candidate for a different rule matching the same expense/trigger", () => {
    const candidate = makeCandidate({ ruleId: "rule-2" });
    const existingLog: NotificationLogKey[] = [
      { expenseId: "exp-1", ruleId: "rule-1", triggerKind: "primary" },
    ];

    const result = filterUndelivered([candidate], existingLog);

    expect(result).toEqual([candidate]);
  });

  it("keeps a grouped candidate when only some of its expenses were already delivered", () => {
    const candidate = makeCandidate({
      triggerKind: "grouped",
      expenseIds: ["exp-1", "exp-2"],
    });
    const existingLog: NotificationLogKey[] = [
      { expenseId: "exp-1", ruleId: "rule-1", triggerKind: "grouped" },
    ];

    const result = filterUndelivered([candidate], existingLog);

    expect(result).toEqual([candidate]);
  });

  it("drops a grouped candidate only once every one of its expenses was already delivered", () => {
    const candidate = makeCandidate({
      triggerKind: "grouped",
      expenseIds: ["exp-1", "exp-2"],
    });
    const existingLog: NotificationLogKey[] = [
      { expenseId: "exp-1", ruleId: "rule-1", triggerKind: "grouped" },
      { expenseId: "exp-2", ruleId: "rule-1", triggerKind: "grouped" },
    ];

    const result = filterUndelivered([candidate], existingLog);

    expect(result).toEqual([]);
  });
});
