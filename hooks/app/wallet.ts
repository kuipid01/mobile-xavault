import { dismissDeposit, ensureDedicatedAccount, getDeposits, getWallet, getWalletLedger, initiateDeposit, quoteDeposit, verifyDeposit } from "@/api/wallet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const walletKeys = {
  wallet: ["wallet"] as const,
  deposits: ["wallet", "deposits"] as const,
  ledger: ["wallet", "ledger"] as const,
};

export const useWallet = () => {
  return useQuery({
    queryKey: walletKeys.wallet,
    queryFn: getWallet,
  });
};

export const useDeposits = () => {
  return useQuery({
    queryKey: walletKeys.deposits,
    queryFn: getDeposits,
  });
};

export const useWalletLedger = () => {
  return useQuery({
    queryKey: walletKeys.ledger,
    queryFn: getWalletLedger,
  });
};

export const useInitiateDeposit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: initiateDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.deposits });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
    },
  });
};

export const useQuoteDeposit = () => useMutation({ mutationFn: quoteDeposit });

export const useEnsureDedicatedAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ensureDedicatedAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
    },
  });
};

export const useVerifyDeposit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.deposits });
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger });
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet });
    },
  });
};

export const useDismissDeposit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.deposits });
    },
  });
};
