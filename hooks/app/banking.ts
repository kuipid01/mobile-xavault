import {
  BankAccount,
  createBankAccount,
  createBeneficiary,
  getBankAccounts,
  getBanks,
  getBeneficiaries,
  resolveBankAccount,
} from "@/api/banking";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const bankingKeys = {
  banks: ["banking", "banks"] as const,
  accounts: ["banking", "accounts"] as const,
  beneficiaries: ["banking", "beneficiaries"] as const,
};

export const useBanks = () => {
  return useQuery({
    queryKey: bankingKeys.banks,
    queryFn: getBanks,

    // Banks don't change frequently.
    staleTime: 1000 * 60 * 60, // 1 hour

    // Keep cached data around for 24 hours.
    gcTime: 1000 * 60 * 60 * 100,

    // Don't refetch every time the user returns to the screen.
    refetchOnWindowFocus: false,

    // Don't refetch just because the component mounted again.
    refetchOnMount: false,

    retry: 2,
  });
};

export const useBankAccounts = () => {
  return useQuery({
    queryKey: bankingKeys.accounts,
    queryFn: getBankAccounts,
  });
};

export const useBeneficiaries = () => {
  return useQuery({
    queryKey: bankingKeys.beneficiaries,
    queryFn: getBeneficiaries,
  });
};

export const useResolveBankAccount = () => {
  return useMutation({
    mutationFn: resolveBankAccount,
  });
};

export const useCreateBankAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBankAccount,
    onSuccess: async (account) => {
      if (account) {
        queryClient.setQueryData<BankAccount[]>(
          bankingKeys.accounts,
          (current = []) => upsertAccount(current, account)
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bankingKeys.accounts }),
        queryClient.invalidateQueries({ queryKey: bankingKeys.beneficiaries }),
      ]);
    },
  });
};

export const useCreateBeneficiary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBeneficiary,
    onSuccess: async (account) => {
      if (account) {
        queryClient.setQueryData<BankAccount[]>(
          bankingKeys.beneficiaries,
          (current = []) => upsertAccount(current, account)
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bankingKeys.accounts }),
        queryClient.invalidateQueries({ queryKey: bankingKeys.beneficiaries }),
      ]);
    },
  });
};

const upsertAccount = (items: BankAccount[], account: BankAccount) => {
  const exists = items.some((item) => item.id === account.id);
  if (exists) {
    return items.map((item) => (item.id === account.id ? account : item));
  }

  return [account, ...items];
};
