import {
  cancelWithdrawal,
  getWithdrawals,
  getPlanWithdrawals,
  previewWithdrawal,
  requestWithdrawal,
  WithdrawalPreviewPayload,
  WithdrawPayload
} from "@/api/withdrawals";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { envelopeKeys } from "./envelopes";
import { planKeys } from "./plans";
import { walletKeys } from "./wallet";

type WithdrawalRequest = {
  planId: string;
  payload: WithdrawPayload;
};

export const withdrawalKeys = {
  history: ["withdrawals", "history"] as const,
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
  return {
    ...query,
    data: query.data?.pages.flatMap((page) => page.items) || []
  };
};

export const useRequestWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, payload }: WithdrawalRequest) => requestWithdrawal(planId, payload),
    onSuccess: (_data, variables) => {
	  queryClient.invalidateQueries({ queryKey: withdrawalKeys.history });
      queryClient.invalidateQueries({ queryKey: planKeys.all });
      queryClient.invalidateQueries({
        queryKey: planKeys.detail(variables.planId)
      });
      queryClient.invalidateQueries({
        queryKey: envelopeKeys.list(variables.planId)
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: withdrawalKeys.history });
      queryClient.invalidateQueries({ queryKey: planKeys.all });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    },
  });
};
