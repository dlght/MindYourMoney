import { listExpensesPage, listPlannedExpenses, markExpensePaid } from "@/features/expenses/expensesApi";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe("markExpensePaid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates to the mark_expense_paid RPC with the given expense id", async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: { id: "exp-1", status: "paid" },
      error: null,
    });

    await markExpensePaid("exp-1");

    expect(supabase.rpc).toHaveBeenCalledWith("mark_expense_paid", { expense_id: "exp-1" });
  });

  it("returns the RPC's result as-is (the atomic status flip + roll-forward happens server-side)", async () => {
    const paidExpense = { id: "exp-1", status: "paid", recurrence: "monthly" };
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: paidExpense, error: null });

    const result = await markExpensePaid("exp-1");

    expect(result).toEqual(paidExpense);
  });

  it("performs exactly one RPC call per invocation — repeated calls never trigger a second, client-side roll-forward insert", async () => {
    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: { id: "exp-1", status: "paid" }, error: null })
      // Second call simulates the RPC's own idempotency: the row is already
      // paid, so the function returns it unchanged and inserts nothing new.
      .mockResolvedValueOnce({ data: { id: "exp-1", status: "paid" }, error: null });

    await markExpensePaid("exp-1");
    await markExpensePaid("exp-1");

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "mark_expense_paid", { expense_id: "exp-1" });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "mark_expense_paid", { expense_id: "exp-1" });
  });

  it("propagates an RPC error instead of silently swallowing it", async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("not found"),
    });

    await expect(markExpensePaid("missing")).rejects.toThrow("not found");
  });
});

describe("listPlannedExpenses (F5, research.md #8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("filters to the given user's status=planned rows only, unpaginated", async () => {
    const order = jest.fn().mockResolvedValue({ data: [{ id: "exp-1" }], error: null });
    const eqStatus = jest.fn().mockReturnValue({ order });
    const eqUser = jest.fn().mockReturnValue({ eq: eqStatus });
    const select = jest.fn().mockReturnValue({ eq: eqUser });
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const result = await listPlannedExpenses("user-1");

    expect(supabase.from).toHaveBeenCalledWith("expenses");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "planned");
    expect(order).toHaveBeenCalledWith("due_date", { ascending: true });
    expect(result).toEqual([{ id: "exp-1" }]);
  });

  it("propagates an error instead of silently swallowing it", async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: new Error("query failed") });
    const eqStatus = jest.fn().mockReturnValue({ order });
    const eqUser = jest.fn().mockReturnValue({ eq: eqStatus });
    const select = jest.fn().mockReturnValue({ eq: eqUser });
    (supabase.from as jest.Mock).mockReturnValue({ select });

    await expect(listPlannedExpenses("user-1")).rejects.toThrow("query failed");
  });
});

describe("listExpensesPage (F5, FR-014)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches the given range across all statuses for the given user", async () => {
    const range = jest.fn().mockResolvedValue({ data: [{ id: "exp-1" }, { id: "exp-2" }], error: null });
    const order = jest.fn().mockReturnValue({ range });
    const eqUser = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq: eqUser });
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const result = await listExpensesPage("user-1", { from: 0, to: 49 });

    expect(supabase.from).toHaveBeenCalledWith("expenses");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("due_date", { ascending: true });
    expect(range).toHaveBeenCalledWith(0, 49);
    expect(result).toHaveLength(2);
  });

  it("propagates an error instead of silently swallowing it", async () => {
    const range = jest.fn().mockResolvedValue({ data: null, error: new Error("range failed") });
    const order = jest.fn().mockReturnValue({ range });
    const eqUser = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq: eqUser });
    (supabase.from as jest.Mock).mockReturnValue({ select });

    await expect(listExpensesPage("user-1", { from: 0, to: 49 })).rejects.toThrow("range failed");
  });
});
