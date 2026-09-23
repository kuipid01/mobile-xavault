import { api } from "./client";
import { ApiResponse } from "./types";

export type Bank = {
  name: string;
  slug: string;
  code: string;
  longcode?: string;
  country?: string;
  currency?: string;
  type?: string;
};

export type BankAccount = {
  id: string;
  owner_type: "self" | "beneficiary";
  nickname?: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ResolveAccountPayload = {
  bank_code: string;
  account_number: string;
};

export type ResolveAccountResponse = ResolveAccountPayload & {
  account_name: string;
};

export type CreateBankAccountPayload = ResolveAccountPayload & {
  bank_name: string;
  nickname?: string;
  is_default?: boolean;
};

type ListAccountsResponse = {
  items: BankAccount[];
};

let banksInFlight: Promise<Bank[]> | null = null;

export const getBanks = async (): Promise<Bank[]> => {
  // If a request is already running, reuse it.
  if (banksInFlight) {
    console.log("[getBanks] Reusing in-flight banks request");
    return banksInFlight;
  }

  console.log("[getBanks] Fetching banks from API");

  banksInFlight = api
    .get<ApiResponse<Bank[]>>("/banking/banks")
    .then((res) => {
      const banks = res.data.data || [];

      console.log("[getBanks] Banks fetched", {
        count: banks.length,
      });

      return banks;
    })
    .catch((error) => {
      console.error("[getBanks] Failed to fetch banks", error);
      throw error;
    })
    .finally(() => {
      // Important: allow a future request after this one finishes.
      banksInFlight = null;
    });

  return banksInFlight;
};
export const resolveBankAccount = async (payload: ResolveAccountPayload) => {
  const res = await api.post<ApiResponse<ResolveAccountResponse>>(
    "/banking/resolve-account",
    payload
  );
  return res.data.data;
};

export const getBankAccounts = async () => {
  const res = await api.get<ApiResponse<ListAccountsResponse>>("/banking/accounts");
  return res.data.data?.items || [];
};

export const createBankAccount = async (payload: CreateBankAccountPayload) => {
  const res = await api.post<ApiResponse<BankAccount>>("/banking/accounts", payload);
  return res.data.data;
};

export const getBeneficiaries = async () => {
  const res = await api.get<ApiResponse<ListAccountsResponse>>(
    "/banking/beneficiaries"
  );
  return res.data.data?.items || [];
};

export const createBeneficiary = async (payload: CreateBankAccountPayload) => {
  const res = await api.post<ApiResponse<BankAccount>>(
    "/banking/beneficiaries",
    payload
  );
  return res.data.data;
};
