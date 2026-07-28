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

export type WithdrawalPreviewPayload = Pick<
  WithdrawPayload,
  "source_type" | "envelope_id" | "amount"
>;

export type WithdrawalPreview = {
  can_withdraw: boolean;
  source_type: WithdrawPayload["source_type"];
  plan_id: string;
  envelope_id?: string;
  requested_amount: number;
  withdrawable_balance: number;
  remaining_balance: number;
  validation_errors: string[];
};

export type WithdrawalRecord = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  currency: string;
  source_type: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export type WithdrawResponse = {
  message?: string;
  note?: string;
  withdrawal?: WithdrawalRecord;
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
    payload,
    { suppressGlobalErrorModal: true } as any
  );
  return res.data.data;
};

export const previewWithdrawal = async (planId: string, payload: WithdrawalPreviewPayload) => {
  const res = await api.post<ApiResponse<WithdrawalPreview>>(
    `/withdrawals/${planId}/preview`,
    payload,
    { suppressGlobalErrorModal: true } as any
  );
  return res.data.data;
};

export const getWithdrawal = async (withdrawalId: string) => {
  const res = await api.get<ApiResponse<WithdrawalRecord>>(`/withdrawals/${withdrawalId}`);
  return res.data.data;
};

export type WithdrawalHistoryPage = {
  items: WithdrawalRecord[];
  page: number;
  limit: number;
  total: number;
};

export const getWithdrawals = async (page = 1) => {
  const res = await api.get<ApiResponse<WithdrawalHistoryPage>>(
    `/withdrawals/history?page=${page}&limit=50`
  );
  return res.data.data || { items: [], page, limit: 50, total: 0 };
};
