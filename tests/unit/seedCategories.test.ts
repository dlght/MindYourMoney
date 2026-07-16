import { seedCategories } from "@/features/categories/seedCategories";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CATEGORIES } from "@/features/categories/defaultCategories";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

function mockSelect(existingRows: Array<{ id: string }>) {
  const limit = jest.fn().mockResolvedValue({ data: existingRows, error: null });
  const eq = jest.fn().mockReturnValue({ limit });
  const select = jest.fn().mockReturnValue({ eq });
  return { select, eq, limit };
}

describe("seedCategories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("inserts all 11 default categories when the user has none yet", async () => {
    const { select } = mockSelect([]);
    const insert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select, insert });

    await seedCategories("user-1");

    expect(insert).toHaveBeenCalledTimes(1);
    const insertedRows = insert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(insertedRows.every((row: { user_id: string }) => row.user_id === "user-1")).toBe(true);
    expect(insertedRows.every((row: { is_default: boolean }) => row.is_default === true)).toBe(
      true
    );
  });

  it("does not insert anything when the user already has categories (no duplicates on repeat login)", async () => {
    const { select } = mockSelect([{ id: "existing-category" }]);
    const insert = jest.fn();
    (supabase.from as jest.Mock).mockReturnValue({ select, insert });

    await seedCategories("user-1");

    expect(insert).not.toHaveBeenCalled();
  });

  it("propagates a select error instead of silently seeding a partial state", async () => {
    const limit = jest.fn().mockResolvedValue({ data: null, error: new Error("network down") });
    const eq = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ eq });
    const insert = jest.fn();
    (supabase.from as jest.Mock).mockReturnValue({ select, insert });

    await expect(seedCategories("user-1")).rejects.toThrow("network down");
    expect(insert).not.toHaveBeenCalled();
  });
});
