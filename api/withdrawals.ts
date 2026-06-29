import { api } from "./client";
import { ApiResponse } from "./types";

export type WithdrawPayload = {
  source_type: "plan_unboxed" | "envelope";
  envelope_id?: string;
  amount: number;
  destination_type: "account" | "beneficiary";
  destination_id: string;
  withdrawal_pin: string;
  idempotency_key: string;
};

export type WithdrawResponse = {
  reference?: string;
  amount?: number;
  status?: string;
};

export const requestWithdrawal = async (planId: string, payload: WithdrawPayload) => {
  const res = await api.post<ApiResponse<WithdrawResponse>>(
    `/withdrawals/${planId}/request`,
    payload
  );
  return res.data.data;
};
