import { nairaToKobo } from "@/api/money";
import { usePlans } from "@/hooks/app/plans";
import {
  useInitiateDeposit,
  useWallet,
  useWalletLedger,
} from "@/hooks/app/wallet";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import DepositModal from "../../components/home/deposit-modal";
import HomeScreenHeader from "../../components/home/header";
import RecentMovements from "../../components/home/recent-movements";
import SpendingPlans from "../../components/home/spending-plans";
import WithdrawalModal from "../../components/home/withdrawal-modal";

export default function Home() {
  const [depositVisible, setDepositVisible] = useState(false);
  const [withdrawalVisible, setWithdrawalVisible] = useState(false);

  const { data: wallet, isLoading: isWalletLoading, refetch } = useWallet();
  const { data: plans, isLoading: isPlansLoading } = usePlans();
  const { data: ledger, isLoading: isLedgerLoading } = useWalletLedger();
  const { mutateAsync: deposit, isPending: isDepositing } = useInitiateDeposit();

  const refreshWallet = async () => {
    await refetch();
  };

  const handleDeposit = async (amount: string) => {
    try {
      const response = await deposit({
        amount: nairaToKobo(amount),
        idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });

      const authorizationUrl =
        response?.authorization_url || response?.data?.authorization_url;

      if (authorizationUrl) {
        await WebBrowser.openBrowserAsync(authorizationUrl);
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
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HomeScreenHeader
          onDeposit={() => setDepositVisible(true)}
          onWithdraw={() => setWithdrawalVisible(true)}
          wallet={wallet}
          isLoading={isWalletLoading}
          refreshWallet={refreshWallet}
        />

        <SpendingPlans plans={plans?.items} isLoading={isPlansLoading} />

        <RecentMovements items={ledger} isLoading={isLedgerLoading} />

        <DepositModal
          visible={depositVisible}
          onClose={() => setDepositVisible(false)}
          onDeposit={handleDeposit}
          isPending={isDepositing}
        />

        <WithdrawalModal
          visible={withdrawalVisible}
          onClose={() => setWithdrawalVisible(false)}
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
