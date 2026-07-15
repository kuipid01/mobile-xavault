import { nairaToKobo } from "@/api/money";
import { usePlans } from "@/hooks/app/plans";
import {
  useEnsureDedicatedAccount,
  useInitiateDeposit,
  useWallet,
  useWalletLedger,
} from "@/hooks/app/wallet";
import { useDepositVerificationContext } from "@/hooks/verify-deposit";
import { useSubscriptionVerificationContext } from "@/hooks/verify-sub";
import { trackEvent } from "@/lib/analytics";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import DepositModal from "../../../components/home/deposit-modal";
import HomeScreenHeader from "../../../components/home/header";
import NextActionCard from "../../../components/home/next-action-card";
import RecentMovements from "../../../components/home/recent-movements";
import SpendingPlans from "../../../components/home/spending-plans";
import VaultHealthCard from "../../../components/home/vault-health-card";
import WithdrawalModal from "../../../components/home/withdrawal-modal";

export default function Home() {
  const [depositVisible, setDepositVisible] = useState(false);
  const [withdrawalVisible, setWithdrawalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: wallet, isLoading: isWalletLoading, refetch: refetchWallet } = useWallet();
  const { data: plans, isLoading: isPlansLoading, refetch: refetchPlans } = usePlans();
  const { data: ledger, isLoading: isLedgerLoading, refetch: refetchLedger } =
    useWalletLedger();
  const {
    markDepositAbandoned,
    pendingAmount,
    pendingReference,
    pendingStatus,
    startDepositVerification,
    verifyPendingDeposit,
  } =
    useDepositVerificationContext();
  const { isVerifying: isSubscriptionVerifying } =
    useSubscriptionVerificationContext();
  const { mutateAsync: deposit, isPending: isDepositing } = useInitiateDeposit();
  const {
    mutateAsync: ensureTransferAccount,
    isPending: isCreatingTransferAccount,
  } = useEnsureDedicatedAccount();

  useEffect(() => {
    trackEvent("home_viewed", {
      has_wallet: Boolean(wallet),
      ledger_count: ledger?.length || 0,
      plan_count: plans?.items?.length || 0,
    });
  }, [ledger?.length, plans?.items?.length, wallet]);

  const refreshWallet = async () => {
    await refetchWallet();
  };

  const refreshHome = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchWallet(), refetchPlans(), refetchLedger()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeposit = async (amount: string) => {
    try {
      const response = await deposit({
        amount: nairaToKobo(amount),
        idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });

      const authorizationUrl =
        response?.authorization_url || response?.data?.authorization_url;
      const reference = response?.reference || response?.data?.reference;

      if (authorizationUrl) {
        if (reference) {
          await startDepositVerification(reference, nairaToKobo(amount));
        }

        trackEvent("deposit_checkout_opened", {
          amount: nairaToKobo(amount),
          has_reference: Boolean(reference),
          reference: reference || null,
        });
        const browserResult = await WebBrowser.openBrowserAsync(authorizationUrl);
        if (
          reference &&
          (browserResult.type === "cancel" || browserResult.type === "dismiss")
        ) {
          await markDepositAbandoned();
        }

        if (reference) {
          void verifyPendingDeposit();
        }
      }

      Toast.show({
        type: "success",
        text1: "Deposit initiated",
        text2: authorizationUrl
          ? "Complete payment in the opened checkout."
          : "Check your wallet shortly.",
      });
    } catch (error: any) {
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
  };

  const handleCreateTransferAccount = async () => {
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
  };

  const handleOpenDeposit = () => {
    trackEvent("deposit_opened", {
      has_dedicated_account: Boolean(wallet?.dedicated_account_number),
    });
    setDepositVisible(true);
  };

  const handleOpenWithdrawal = () => {
    trackEvent("withdrawal_opened", {
      available_balance: wallet?.available_balance || 0,
      locked_balance: wallet?.locked_balance || 0,
    });
    setWithdrawalVisible(true);
  };

  const handleTransferRefresh = async () => {
    trackEvent("deposit_transfer_refresh", {
      has_dedicated_account: Boolean(wallet?.dedicated_account_number),
    });
    await refreshWallet();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshHome} />
        }
      >
        <HomeScreenHeader
          onDeposit={handleOpenDeposit}
          onWithdraw={handleOpenWithdrawal}
          wallet={wallet}
          isLoading={isWalletLoading}
          refreshWallet={refreshWallet}
        />

        <NextActionCard
          wallet={wallet}
          plans={plans?.items}
          pendingDeposit={{
            reference: pendingReference,
            amount: pendingAmount,
            status: pendingStatus,
            onPress: () => void verifyPendingDeposit(),
          }}
          isSubscriptionVerifying={isSubscriptionVerifying}
          onCreatePlan={() => router.push("/(app)/(tabs)/(plan)/plans/create")}
          onDeposit={handleOpenDeposit}
          onWithdraw={handleOpenWithdrawal}
        />

        <VaultHealthCard
          wallet={wallet}
          plans={plans?.items}
          ledger={ledger}
        />

        <SpendingPlans plans={plans?.items} isLoading={isPlansLoading} />

        <RecentMovements
          items={ledger}
          isLoading={isLedgerLoading}
          onDeposit={handleOpenDeposit}
        />

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F2",
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
    paddingTop: 8,
  },
});
