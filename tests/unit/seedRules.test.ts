import { seedRules } from "@/features/rules/seedRules";
import { supabase } from "@/lib/supabase";
import { DEFAULT_RULES } from "@/features/rules/defaultRules";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

function mockSelect(existingRows: Array<{ name: string }>) {
  const eq = jest.fn().mockResolvedValue({ data: existingRows, error: null });
  const select = jest.fn().mockReturnValue({ eq });
  return { select, eq };
}

describe("seedRules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("inserts all 3 default rules when the user has none yet", async () => {
    const { select } = mockSelect([]);
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select, insert });

    await seedRules("user-1");

    expect(insert).toHaveBeenCalledTimes(1);
    const insertedRows = insert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(DEFAULT_RULES.length);
    expect(insertedRows.map((row: { name: string }) => row.name).sort()).toEqual(
      DEFAULT_RULES.map((rule) => rule.name).sort()
    );
    expect(insertedRows.every((row: { user_id: string }) => row.user_id === "user-1")).toBe(true);
    expect(insertedRows.every((row: { is_default: boolean }) => row.is_default === true)).toBe(
      true
    );
    expect(insertedRows.every((row: { enabled: boolean }) => row.enabled === true)).toBe(true);
  });

  it("backfills only the missing default when an existing user already has the two original defaults", async () => {
    // The real-world "existing user" case (research.md #2): the account was
    // seeded before "Due today" existed, so only two default names are
    // already present.
    const { select } = mockSelect([{ name: "Big expense ahead" }, { name: "Due tomorrow" }]);
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select, insert });

    await seedRules("user-1");

    expect(insert).toHaveBeenCalledTimes(1);
    const insertedRows = insert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].name).toBe("Due today");
    expect(insertedRows[0].enabled).toBe(true);
  });

  it("does not insert anything when all 3 default names already exist (steady state)", async () => {
    const { select } = mockSelect(DEFAULT_RULES.map((rule) => ({ name: rule.name })));
    const insert = jest.fn();
    (supabase.from as jest.Mock).mockReturnValue({ select, insert });

    await seedRules("user-1");

    expect(insert).not.toHaveBeenCalled();
  });

  it("does not re-insert or re-enable a default rule the user already disabled, but still backfills a genuinely missing one (FR-009)", async () => {
    // "Due tomorrow" is present but disabled; "Due today" doesn't exist yet
    // for this account. Only the select's presence-by-name is visible here
    // (mirrors what the real query returns) — enabled/disabled state lives
    // in the existing row, untouched by this function either way.
    const { select } = mockSelect([{ name: "Big expense ahead" }, { name: "Due tomorrow" }]);
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select, insert });

    await seedRules("user-1");

    expect(insert).toHaveBeenCalledTimes(1);
    const insertedRows = insert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].name).toBe("Due today");
    // Crucially: no row named "Due tomorrow" is inserted — the existing
    // (possibly disabled) row is left completely alone.
    expect(insertedRows.some((row: { name: string }) => row.name === "Due tomorrow")).toBe(false);
  });

  it("propagates a select error instead of silently seeding a partial state", async () => {
    const eq = jest.fn().mockResolvedValue({ data: null, error: new Error("network down") });
    const select = jest.fn().mockReturnValue({ eq });
    const insert = jest.fn();
    (supabase.from as jest.Mock).mockReturnValue({ select, insert });

    await expect(seedRules("user-1")).rejects.toThrow("network down");
    expect(insert).not.toHaveBeenCalled();
  });
});
