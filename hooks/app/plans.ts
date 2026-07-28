import {
  cancelPlan,
  confirmPlan,
  createPlan,
  getPlan,
  getPlans,
  previewPlan,
  updatePlan,
} from "@/api/plans";
import { PlanStatus } from "@/api/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { walletKeys } from "./wallet";

export const planKeys = {
  all: ["plans"] as const,
  list: (status?: PlanStatus) => ["plans", status || "all"] as const,
  detail: (planId?: string) => ["plans", "detail", planId] as const,
  preview: (planId?: string) => ["plans", "preview", planId] as const,
};

export const usePlans = (status?: PlanStatus) => {
  return useQuery({
    queryKey: planKeys.list(status),
    queryFn: () => getPlans(status),
  });
};

export const usePlan = (planId?: string) => {
  return useQuery({
    queryKey: planKeys.detail(planId),
    queryFn: () => getPlan(planId || ""),
    enabled: !!planId,
  });
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.all });
    },
  });
};

export const useUpdatePlan = (planId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof updatePlan>[1]) => updatePlan(planId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.all });
      queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) });
    },
  });
};

export const usePreviewPlan = (planId?: string) => {
  return useQuery({
    queryKey: planKeys.preview(planId),
    queryFn: () => previewPlan(planId || ""),
    enabled: !!planId,
  });
};

export const useConfirmPlan = (planId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => confirmPlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.all });
      queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    },
  });
};

export const useCancelPlan = (planId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => cancelPlan(planId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.all });
      queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
    },
  });
};
