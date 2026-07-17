import { nairaToKobo } from "@/api/money";
import {
  useEnsureDedicatedAccount,
  useInitiateDeposit,
  useWallet,
} from "@/hooks/app/wallet";
import { useSubscriptionLimitModal } from "@/hooks/use-subscription-limit-modal";
import { useDepositVerificationContext } from "@/hooks/verify-deposit";
import { trackEvent } from "@/lib/analytics";
import { useCallback, useMemo, useState } from "react";
import Toast from "react-native-toast-message";
import DepositModal from "@/components/home/deposit-modal";
import WithdrawalModal from "@/components/home/withdrawal-modal";

export function useWalletActions() {
  const [depositVisible, setDepositVisible] = useState(false);
  const [withdrawalVisible, setWithdrawalVisible] = useState(false);

  const {
    data: wallet,
    isLoading: isWalletLoading,
    refetch: refetchWallet,
  } = useWallet();
  const {
    startDepositVerification,
  } = useDepositVerificationContext();
  const { showSubscriptionLimitModal } = useSubscriptionLimitModal();
  const { mutateAsync: deposit, isPending: isDepositing } = useInitiateDeposit();
  const {
    mutateAsync: ensureTransferAccount,
    isPending: isCreatingTransferAccount,
  } = useEnsureDedicatedAccount();

  const refreshWallet = useCallback(async () => {
    await refetchWallet();
  }, [refetchWallet]);

  const handleDeposit = useCallback(
    async (amount: string) => {
      const amountInKobo = nairaToKobo(amount);

      try {
        const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const response = await deposit({
          amount: amountInKobo,
          idempotency_key: idempotencyKey,
        });

        const authorizationUrl =
          response?.authorization_url || response?.data?.authorization_url;
        const reference = response?.reference || response?.data?.reference;

        if (authorizationUrl && reference) {
          await startDepositVerification(
            reference,
            amountInKobo,
            authorizationUrl,
            idempotencyKey
          );
        }

        Toast.show({
          type: "success",
          text1: "Deposit ready",
          text2: authorizationUrl
            ? "Continue payment from the secure checkout modal."
            : "Check your wallet shortly.",
        });
      } catch (error: any) {
        const requiredVaultCapacityKobo =
          (wallet?.available_balance || 0) +
          (wallet?.locked_balance || 0) +
          amountInKobo;

        if (
          showSubscriptionLimitModal("deposit", error, {
            requiredVaultCapacityKobo,
          })
        ) {
          throw error;
        }

        Toast.show({
          type: "error",
          text1: "Deposit failed",
          text2:
            error?.response?.data?.message ||
            error?.message ||
            "Please try again.",
        });
        throw error;
      }
    },
    [
      deposit,
      showSubscriptionLimitModal,
      startDepositVerification,
      wallet?.available_balance,
      wallet?.locked_balance,
    ]
  );

  const handleCreateTransferAccount = useCallback(async () => {
    try {
      await ensureTransferAccount();
      Toast.show({
        type: "success",
        text1: "Transfer account ready",
        text2: "You can now deposit by bank transfer.",
      });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Could not create transfer account",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try again.",
      });
    }
  }, [ensureTransferAccount]);

  const openDeposit = useCallback(() => {
    trackEvent("deposit_opened", {
      has_dedicated_account: Boolean(wallet?.dedicated_account_number),
    });
    setDepositVisible(true);
  }, [wallet?.dedicated_account_number]);

  const openWithdrawal = useCallback(() => {
    trackEvent("withdrawal_opened", {
      available_balance: wallet?.available_balance || 0,
      locked_balance: wallet?.locked_balance || 0,
    });
    setWithdrawalVisible(true);
  }, [wallet?.available_balance, wallet?.locked_balance]);

  const handleTransferRefresh = useCallback(async () => {
    trackEvent("deposit_transfer_refresh", {
      has_dedicated_account: Boolean(wallet?.dedicated_account_number),
    });
    await refreshWallet();
  }, [refreshWallet, wallet?.dedicated_account_number]);

  const walletActionModals = useMemo(
    () => (
      <>
        <DepositModal
          visible={depositVisible}
          onClose={() => setDepositVisible(false)}
          onDeposit={handleDeposit}
          onCreateTransferAccount={handleCreateTransferAccount}
          onTransferRefresh={handleTransferRefresh}
          wallet={wallet}
          isPending={isDepositing}
          isCreatingTransferAccount={isCreatingTransferAccount}
        />

        <WithdrawalModal
          visible={withdrawalVisible}
          onClose={() => setWithdrawalVisible(false)}
          onCompleted={refreshWallet}
        />
      </>
    ),
    [
      depositVisible,
      handleCreateTransferAccount,
      handleDeposit,
      handleTransferRefresh,
      isCreatingTransferAccount,
      isDepositing,
      refreshWallet,
      wallet,
      withdrawalVisible,
    ]
  );

  return {
    wallet,
    isWalletLoading,
    refreshWallet,
    refetchWallet,
    openDeposit,
    openWithdrawal,
    walletActionModals,
  };
}
