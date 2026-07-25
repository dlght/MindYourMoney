import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useCategoryOptions } from "@/features/expenses/useExpenses";
import { useRules } from "@/features/rules/useRules";
import { useCreateRule, useDeleteRule, useUpdateRule } from "@/features/rules/useRuleMutations";
import { hasNotificationPermission } from "@/features/rules/notificationScheduler";
import { isIosNotInstalled, isWebPushSupported } from "@/features/rules/webPushSupport";
import { useEnableWebPush } from "@/features/push/usePushRegistration";
import { useSession } from "@/features/auth/useSession";
import { RulesScreen } from "@/features/rules/RulesScreen";

// F8, contracts/web-permission-ux-contract.md rule 2 — native always
// renders the existing static banner ("none"); web picks between the
// actionable "enable" state, iOS's "ios-install" guidance, or "none" for a
// genuinely unsupported browser.
function computeWebPushBannerAction(): "none" | "enable" | "ios-install" {
  if (Platform.OS !== "web") {
    return "none";
  }
  if (isIosNotInstalled()) {
    return "ios-install";
  }
  return isWebPushSupported() ? "enable" : "none";
}

export default function RulesTabScreen() {
  const { data: rules, isError, refetch } = useRules();
  const { data: categories = [] } = useCategoryOptions();
  const { user } = useSession();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const enableWebPush = useEnableWebPush();
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    hasNotificationPermission().then(setPermission);
  }, []);

  const handleEnableWebPush = async () => {
    if (!user) {
      return;
    }
    const result = await enableWebPush(user.id);
    if (result.status === "subscribed") {
      setPermission(true);
    }
  };

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
      webPushBannerAction={computeWebPushBannerAction()}
      onEnableWebPush={handleEnableWebPush}
    />
  );
}
