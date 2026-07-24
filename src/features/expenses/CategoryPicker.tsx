import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ExpenseCategoryOption } from "@/features/expenses/types";

interface CategoryPickerProps {
  categories: ExpenseCategoryOption[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

// A single compact row showing only the selected category; tapping it
// expands an inline list to choose from, collapsing again once picked.
// Deliberately NOT a native <Modal> here: nesting a Modal inside
// BottomSheetModal's (portaled) content is a known-broken combination on
// both platforms — the two native overlay layers fight over touch/gesture
// routing. An inline expand/collapse avoids a second overlay entirely, and
// with only 11 default categories there's no need for a virtualized list —
// the sheet's own BottomSheetScrollView handles scrolling the whole form.
export function CategoryPicker({ categories, selectedId, onSelect }: CategoryPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const selected = categories.find((category) => category.id === selectedId);

  return (
    <View className="gap-2">
      <Text className="text-slate-600 dark:text-slate-400">Category</Text>
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel="Select category"
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
      >
        <Text className="text-slate-900 dark:text-white">{selected?.name ?? "Select a category"}</Text>
        <Text className="text-slate-500 dark:text-slate-400">{expanded ? "︿" : "⌄"}</Text>
      </Pressable>

      {expanded ? (
        <View className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          {categories.map((category, index) => (
            <Pressable
              key={category.id}
              onPress={() => {
                onSelect(category.id);
                setExpanded(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: category.id === selectedId }}
              className={`px-4 py-3 ${index > 0 ? "border-t border-slate-200 dark:border-slate-700" : ""} ${
                category.id === selectedId ? "bg-indigo-50 dark:bg-indigo-950" : "bg-white dark:bg-slate-800"
              }`}
            >
              <Text
                className={
                  category.id === selectedId
                    ? "font-medium text-indigo-600 dark:text-indigo-400"
                    : "text-slate-900 dark:text-white"
                }
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
