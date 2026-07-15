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
  message?: string;
  note?: string;
  withdrawal?: {
    id: string;
    reference: string;
    amount: number;
    status: string;
    currency: string;
    source_type: string;
    description?: string;
    created_at?: string;
  };
  wallet?: {
    wallet_id: string;
    available_balance: number;
    locked_balance: number;
    ledger_balance: number;
    currency: string;
  };
  paystack?: {
    reference?: string;
    transfer_code?: string;
    status?: string;
  };
};

export const requestWithdrawal = async (planId: string, payload: WithdrawPayload) => {
  const res = await api.post<ApiResponse<WithdrawResponse>>(
    `/withdrawals/${planId}/request`,
    payload
  );
  return res.data.data;
};
