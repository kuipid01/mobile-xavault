import {
  forgotWithdrawalPin,
  getWithdrawalPinStatus,
  resetWithdrawalPin,
  setWithdrawalPin,
} from "@/api/withdrawal-pin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const withdrawalPinKeys = {
  status: ["withdrawal-pin", "status"] as const,
};

export const useWithdrawalPinStatus = () => {
  return useQuery({
    queryKey: withdrawalPinKeys.status,
    queryFn: getWithdrawalPinStatus,
  });
};

export const useSetWithdrawalPin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setWithdrawalPin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: withdrawalPinKeys.status });
    },
  });
};

export const useForgotWithdrawalPin = () => {
  return useMutation({
    mutationFn: forgotWithdrawalPin,
  });
};

export const useResetWithdrawalPin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetWithdrawalPin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: withdrawalPinKeys.status });
    },
  });
};
