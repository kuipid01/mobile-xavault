import { usePlans } from "@/hooks/app/plans";
import { useWalletLedger } from "@/hooks/app/wallet";
import { useWalletActions } from "@/hooks/app/use-wallet-actions";
import { useDepositVerificationContext } from "@/hooks/verify-deposit";
import { useSubscriptionVerificationContext } from "@/hooks/verify-sub";
import { trackEvent } from "@/lib/analytics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppHeaderActions from "../../../components/home/AppHeaderActions";
import HomeScreenHeader from "../../../components/home/header";
import NextActionCard from "../../../components/home/next-action-card";
import RecentMovements from "../../../components/home/recent-movements";
import VaultHealthCard from "../../../components/home/vault-health-card";

export default function Home() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: plans, refetch: refetchPlans } = usePlans();
  const { data: ledger, isLoading: isLedgerLoading, refetch: refetchLedger } =
    useWalletLedger();
  const {
    wallet,
    isWalletLoading,
    refetchWallet,
    refreshWallet,
    openDeposit,
    openWithdrawal,
    walletActionModals,
  } = useWalletActions();
  const {
    pendingAmount,
    pendingReference,
    pendingStatus,
    verifyPendingDeposit,
  } =
    useDepositVerificationContext();
  const { isVerifying: isSubscriptionVerifying } =
    useSubscriptionVerificationContext();

  useEffect(() => {
    trackEvent("home_viewed", {
      has_wallet: Boolean(wallet),
      ledger_count: ledger?.length || 0,
      plan_count: plans?.items?.length || 0,
    });
  }, [ledger?.length, plans?.items?.length, wallet]);

  const refreshHome = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchWallet(), refetchPlans(), refetchLedger()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fixedHeader}>
        <AppHeaderActions onDeposit={openDeposit} onWithdraw={openWithdrawal} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshHome} />
        }
      >
        <HomeScreenHeader
          onDeposit={openDeposit}
          onWithdraw={openWithdrawal}
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
          onDeposit={openDeposit}
          onWithdraw={openWithdrawal}
        />

        <VaultHealthCard
          wallet={wallet}
          plans={plans?.items}
          ledger={ledger}
        />

        <RecentMovements
          items={ledger}
          isLoading={isLedgerLoading}
          onDeposit={openDeposit}
        />
      </ScrollView>

      {walletActionModals}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F2",
  },

  fixedHeader: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
});
