import {
  cancelWithdrawal,
  getPlanWithdrawals,
  getWithdrawals,
  previewWithdrawal,
  requestWithdrawal,
  WithdrawalPreviewPayload,
  WithdrawPayload
} from "@/api/withdrawals";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { envelopeKeys } from "./envelopes";
import { planKeys } from "./plans";
import { walletKeys } from "./wallet";

type WithdrawalRequest = {
  planId: string;
  payload: WithdrawPayload;
};

export const withdrawalKeys = {
  history: ["withdrawals", "history"] as const,
  plans: ["withdrawals", "plan"] as const,
  plan: (planId: string) => ["withdrawals", "plan", planId] as const
};

export const useEnvelopeWithdrawals = (planId: string, envelopeId: string) =>
  useQuery({
    queryKey: [...withdrawalKeys.plan(planId), "envelope", envelopeId],
    queryFn: async () => {
      const items = await getPlanWithdrawals(planId);
      return items.filter((item) => item.envelope_id === envelopeId);
    },
    enabled: !!planId && !!envelopeId,
  });

const isTerminalWithdrawal = (status?: string) =>
  ["paid", "success", "successful", "completed", "failed", "reversed", "cancelled", "canceled", "rejected"].includes(
    String(status || "").toLowerCase()
  );

export const useWithdrawalHistory = () => {
  const queryClient = useQueryClient();
  // Withdrawals already seen in a terminal state; prevents re-invalidating on
  // every refetch of the history list.
  const seenTerminal = useRef<Set<string>>(new Set());

  const query = useInfiniteQuery({
    queryKey: withdrawalKeys.history,
    queryFn: ({ pageParam }) => getWithdrawals(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const pages = query.state.data?.pages;
      return pages?.some((page) =>
        page.items.some((item) => !isTerminalWithdrawal(item.status))
      )
        ? 5000
        : false;
    }
  });

  const items = query.data?.pages.flatMap((page) => page.items) || [];

  // When a withdrawal resolves (paid/failed/reversed), refresh the plan,
  // envelope and wallet balances it affects so the UI shows the new state
  // even if the withdrawal modal is not open.
  useEffect(() => {
    const newlyResolved = items.filter(
      (item) =>
        isTerminalWithdrawal(item.status) &&
        item.id &&
        !seenTerminal.current.has(item.id)
    );
    if (!newlyResolved.length) return;

    for (const item of newlyResolved) {
      seenTerminal.current.add(item.id);
    }

    queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
    queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    queryClient.invalidateQueries({ queryKey: planKeys.list() });
    const planIds = new Set(
      newlyResolved.map((item) => item.plan_id).filter((id): id is string => !!id)
    );
    for (const planId of planIds) {
      queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) });
      queryClient.invalidateQueries({ queryKey: envelopeKeys.list(planId), exact: true });
      queryClient.invalidateQueries({ queryKey: withdrawalKeys.plan(planId) });
    }
  }, [items, queryClient]);

  return {
    ...query,
    data: items
  };
};

export const useRequestWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, payload }: WithdrawalRequest) => requestWithdrawal(planId, payload),
    onSuccess: (_data, variables) => {
	  queryClient.invalidateQueries({ queryKey: withdrawalKeys.history });
    queryClient.invalidateQueries({ queryKey: withdrawalKeys.plan(variables.planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.list() });
      queryClient.invalidateQueries({
        queryKey: planKeys.detail(variables.planId)
      });
      queryClient.invalidateQueries({
        queryKey: envelopeKeys.list(variables.planId),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    }
  });
};

export const usePreviewWithdrawal = () =>
  useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: WithdrawalPreviewPayload }) =>
      previewWithdrawal(planId, payload)
  });

export const useCancelWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (withdrawalId: string) => cancelWithdrawal(withdrawalId),
     onSuccess: (withdrawal) => {
      queryClient.invalidateQueries({ queryKey: withdrawalKeys.history });
      queryClient.invalidateQueries({ queryKey: withdrawalKeys.plans });
      queryClient.invalidateQueries({ queryKey: planKeys.list() });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
      if (withdrawal?.plan_id) {
        queryClient.invalidateQueries({ queryKey: withdrawalKeys.plan(withdrawal.plan_id) });
        queryClient.invalidateQueries({
          queryKey: envelopeKeys.list(withdrawal.plan_id),
          exact: true,
        });
        queryClient.invalidateQueries({ queryKey: planKeys.detail(withdrawal.plan_id) });
      }
    },
  });
};
