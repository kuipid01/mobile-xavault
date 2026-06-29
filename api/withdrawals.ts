import { api } from "./client";
import { ApiResponse } from "./types";

export type WithdrawPayload = {
  amount?: number;
  withdraw_all?: boolean;
  idempotency_key: string;
};

export type WithdrawResponse = {
  reference?: string;
  amount?: number;
  status?: string;
};

export const withdrawFromPlan = async (
  planId: string,
  payload: WithdrawPayload
) => {
  const res = await api.post<ApiResponse<WithdrawResponse>>(
    `/plans/${planId}/withdraw`,
    payload
  );
  return res.data.data;
};

export const withdrawFromEnvelope = async (
  planId: string,
  envelopeId: string,
  payload: WithdrawPayload
) => {
  const res = await api.post<ApiResponse<WithdrawResponse>>(
    `/plans/${planId}/envelopes/${envelopeId}/withdraw`,
    payload
  );
  return res.data.data;
};
