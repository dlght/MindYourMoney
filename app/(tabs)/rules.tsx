import { useEffect, useState } from "react";
import { useCategoryOptions } from "@/features/expenses/useExpenses";
import { useRules } from "@/features/rules/useRules";
import { useCreateRule, useDeleteRule, useUpdateRule } from "@/features/rules/useRuleMutations";
import { hasNotificationPermission } from "@/features/rules/notificationScheduler";
import { RulesScreen } from "@/features/rules/RulesScreen";

export default function RulesTabScreen() {
  const { data: rules, isError, refetch } = useRules();
  const { data: categories = [] } = useCategoryOptions();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    hasNotificationPermission().then(setPermission);
  }, []);

  return (
    <RulesScreen
      rules={rules}
      categories={categories}
      isError={isError}
      onRetry={() => refetch()}
      onCreate={(input) => createRule.mutateAsync(input)}
      onUpdate={(input) => updateRule.mutateAsync(input)}
      onDelete={(rule) => deleteRule.mutateAsync(rule)}
      hasNotificationPermission={permission}
    />
  );
}
