import { api } from "./client";
import { ApiResponse } from "./types";

export type WithdrawPayload = {
  quote_id: string;
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
  quote_id: string;
  provider_transfer_fee: number;
  government_levy: number;
  xavault_subsidy: number;
  user_fee: number;
  total_deduction: number;
  recipient_amount: number;
  allowance_applied: boolean;
  pricing_version: string;
  expires_at: string;
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
  plan_id?: string;
  envelope_id?: string;
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

// User-action writes: failure must ALWAYS surface in the global modal — the
// person pressed a button and needs feedback on every attempt.
export const requestWithdrawal = async (planId: string, payload: WithdrawPayload) => {
  const res = await api.post<ApiResponse<WithdrawResponse>>(
    `/withdrawals/${planId}/request`,
    payload
  );
  return res.data.data;
};

export const previewWithdrawal = async (planId: string, payload: WithdrawalPreviewPayload) => {
  const res = await api.post<ApiResponse<WithdrawalPreview>>(
    `/withdrawals/${planId}/preview`,
    payload
  );
  return res.data.data;
};

// Status check inside the withdrawal modal's own verify UI: "still
// processing" is an expected outcome, so the modal owns the error display.
export const getWithdrawal = async (withdrawalId: string) => {
  const res = await api.get<ApiResponse<WithdrawalRecord>>(
    `/withdrawals/${withdrawalId}`,
    { suppressGlobalErrorModal: true } as any
  );
  return res.data.data;
};

export const cancelWithdrawal = async (withdrawalId: string, reason?: string) => {
  const res = await api.post<ApiResponse<WithdrawalRecord>>(
    `/withdrawals/${withdrawalId}/cancel`,
    { reason: reason || "" }
  );
  return res.data.data;
};

export type WithdrawalHistoryPage = {
  items: WithdrawalRecord[];
  page: number;
  limit: number;
  total: number;
};

// Query-backed GET feeding the 5s history poller: screens render their own
// empty/error states, so an interceptor modal here is the "incessant modal"
// source we set out to kill.
export const getWithdrawals = async (page = 1) => {
  const res = await api.get<ApiResponse<WithdrawalHistoryPage>>(
    `/withdrawals/history?page=${page}&limit=50`,
    { suppressGlobalErrorModal: true } as any
  );
  return res.data.data || { items: [], page, limit: 50, total: 0 };
};

export const getPlanWithdrawals = async (planId: string) => {
  const res = await api.get<ApiResponse<WithdrawalHistoryPage>>(
    `/withdrawals/${planId}/withdrawals`,
    { suppressGlobalErrorModal: true } as any
  );
  return res.data.data?.items || [];
};
