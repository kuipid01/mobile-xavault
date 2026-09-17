import { api } from "./client";
import {
  ApiResponse,
  DepositInitResponse,
  DepositVerificationResponse,
  Wallet,
  WalletDeposit,
  WalletLedger,
} from "./types";

export const getWallet = async () => {
  const res = await api.get<ApiResponse<Wallet>>("/wallet");
  return res.data.data;
};

export const ensureDedicatedAccount = async () => {
  const res = await api.post<ApiResponse<Wallet>>("/wallet/dedicated-account");
  return res.data.data;
};

export const initiateDeposit = async (data: {
  amount: number;
  quote_id: string;
  idempotency_key: string;
}) => {
  const res = await api.post<ApiResponse<DepositInitResponse>>("/wallet/deposit/initiate", data);
  return res.data.data;
};

export type DepositFeeQuote = {
  quote_id: string;
  principal_amount: number;
  provider_fee: number;
  gross_charge: number;
  net_credit: number;
  pricing_version: string;
  expires_at: string;
};

export const quoteDeposit = async (amount: number) => {
  const res = await api.post<ApiResponse<DepositFeeQuote>>("/wallet/deposit/quote", { amount });
  return res.data.data;
};

export const getDeposits = async () => {
  const res = await api.get<ApiResponse<WalletDeposit[]>>("/wallet/deposits");
  return res.data.data || [];
};

export const getWalletLedger = async () => {
  const res = await api.get<ApiResponse<WalletLedger[]>>("/wallet/ledger");
  return res.data.data || [];
};

export const verifyDeposit = async (reference: string) => {
  // Bug fix: "Deposit not verified" is an EXPECTED polling outcome while the
  // payment is still propagating — the deposit card shows its own "Check
  // again / still processing" UI for it. Without this flag the axios
  // interceptor published the global "Transaction could not be completed"
  // error modal on top of an expected response.
  const res = await api.post<ApiResponse<DepositVerificationResponse>>(
    `/wallet/deposit/${reference}/verify`,
    {},
    { suppressGlobalErrorModal: true } as any
  );
  return res.data;
};

export const dismissDeposit = async (reference: string) => {
  // Expected outcome (user cancelled) — never surface the global error modal.
  const res = await api.post<ApiResponse<WalletDeposit>>(
    `/wallet/deposit/${reference}/dismiss`,
    {},
    { suppressGlobalErrorModal: true } as any
  );
  return res.data.data;
};
