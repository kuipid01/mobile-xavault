import { api } from "./client";
import { ApiResponse, DepositInitResponse, Wallet, WalletDeposit, WalletLedger } from "./types";

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
  idempotency_key: string;
}) => {
  const res = await api.post<ApiResponse<DepositInitResponse>>("/wallet/deposit/initiate", data);
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
  const res = await api.post<ApiResponse<unknown>>(`/wallet/deposit/${reference}/verify`);
  return res.data;
};
