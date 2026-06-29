import { requestWithdrawal, WithdrawPayload } from "@/api/withdrawals";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { envelopeKeys } from "./envelopes";
import { planKeys } from "./plans";
import { walletKeys } from "./wallet";

type WithdrawalRequest = {
  planId: string;
  payload: WithdrawPayload;
};

export const useRequestWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, payload }: WithdrawalRequest) =>
      requestWithdrawal(planId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: planKeys.all });
      queryClient.invalidateQueries({
        queryKey: planKeys.detail(variables.planId),
      });
      queryClient.invalidateQueries({
        queryKey: envelopeKeys.list(variables.planId),
      });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    },
  });
};
