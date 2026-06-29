import {
  withdrawFromEnvelope,
  withdrawFromPlan,
  WithdrawPayload,
} from "@/api/withdrawals";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { envelopeKeys } from "./envelopes";
import { planKeys } from "./plans";
import { walletKeys } from "./wallet";

type PlanWithdrawal = {
  planId: string;
  payload: WithdrawPayload;
};

type EnvelopeWithdrawal = PlanWithdrawal & {
  envelopeId: string;
};

export const useWithdrawFromPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, payload }: PlanWithdrawal) =>
      withdrawFromPlan(planId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: planKeys.all });
      queryClient.invalidateQueries({
        queryKey: planKeys.detail(variables.planId),
      });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    },
  });
};

export const useWithdrawFromEnvelope = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, envelopeId, payload }: EnvelopeWithdrawal) =>
      withdrawFromEnvelope(planId, envelopeId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: planKeys.all });
      queryClient.invalidateQueries({
        queryKey: planKeys.detail(variables.planId),
      });
      queryClient.invalidateQueries({
        queryKey: envelopeKeys.list(variables.planId),
      });
      queryClient.invalidateQueries({
        queryKey: envelopeKeys.detail(variables.planId, variables.envelopeId),
      });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    },
  });
};
