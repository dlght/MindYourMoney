import { DEFAULT_CATEGORIES } from "@/features/categories/defaultCategories";

describe("DEFAULT_CATEGORIES", () => {
  it("has exactly 11 entries", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(11);
  });

  it("gives every entry a non-empty name, icon, and color", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.name.trim().length).toBeGreaterThan(0);
      expect(category.icon.trim().length).toBeGreaterThan(0);
      expect(category.color.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes 'Other' as the fallback category, last in the list", () => {
    expect(DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1].name).toBe("Other");
  });

  it("has no duplicate category names", () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
