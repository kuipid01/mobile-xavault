import { api } from "./client";
import {
  ApiResponse,
  ListPlansResponse,
  Plan,
  PlanPreview,
  PlanStatus,
  UnboxedBalancePolicy,
} from "./types";

export type CreatePlanPayload = {
  name: string;
  amount: number;
  currency?: "NGN";
  start_date: string;
  end_date: string;
  unboxed_balance_policy: Extract<UnboxedBalancePolicy, "flexible" | "locked_until_plan_ends">;
};

export type UpdatePlanPayload = Partial<CreatePlanPayload>;

export const getPlans = async (status?: PlanStatus) => {
  const res = await api.get<ApiResponse<ListPlansResponse>>("/plans", {
    params: status ? { status } : undefined,
  });
  return res.data.data;
};

export const getPlan = async (planId: string) => {
  const res = await api.get<ApiResponse<Plan>>(`/plans/${planId}`);
  return res.data.data;
};

export const createPlan = async (payload: CreatePlanPayload) => {
  const res = await api.post<ApiResponse<Plan>>("/plans", {
    currency: "NGN",
    ...payload,
  });
  return res.data.data;
};

export const updatePlan = async (planId: string, payload: UpdatePlanPayload) => {
  const res = await api.patch<ApiResponse<Plan>>(`/plans/${planId}`, payload);
  return res.data.data;
};

export const previewPlan = async (planId: string) => {
  const res = await api.post<ApiResponse<PlanPreview>>(`/plans/${planId}/preview`);
  return res.data.data;
};

export const confirmPlan = async (planId: string) => {
  const res = await api.post<ApiResponse<Plan>>(`/plans/${planId}/confirm`, {
    accepted_preview: true,
  });
  return res.data.data;
};

export const cancelPlan = async (planId: string, reason: string) => {
  const res = await api.post<ApiResponse<unknown>>(`/plans/${planId}/cancel`, { reason });
  return res.data.data;
};
