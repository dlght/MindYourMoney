import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/useSession";
import { listRules } from "@/features/rules/rulesApi";

export function rulesQueryKey(userId: string | undefined) {
  return ["rules", userId] as const;
}

export function useRules() {
  const { user } = useSession();

  return useQuery({
    queryKey: rulesQueryKey(user?.id),
    queryFn: () => listRules(user!.id),
    enabled: !!user,
  });
}
