import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { DepositFeeQuote } from "../../api/wallet";
import { formatMoney } from "../../api/money";
import { Wallet } from "../../api/types";
import { COLORS } from "../../themes/colors";

const MIN_DEPOSIT_NAIRA = 500;
const MAX_DEPOSIT_NAIRA = 5_000_000;

type Props = {
  visible: boolean;
  onClose: () => void;
  onDeposit: (amount: string, quoteId: string) => Promise<void> | void;
  onQuote: (amount: string) => Promise<DepositFeeQuote | undefined>;
  onCreateTransferAccount: () => Promise<void> | void;
  onTransferRefresh: () => Promise<void> | void;
  wallet?: Wallet;
  isPending?: boolean;
  isQuoting?: boolean;
  isCreatingTransferAccount?: boolean;
};

const DepositModal = ({
  visible,
  onClose,
  onDeposit,
  onQuote,
  onCreateTransferAccount,
  onTransferRefresh,
  wallet,
  isPending,
  isQuoting,
  isCreatingTransferAccount,
}: Props) => {
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [quote, setQuote] = useState<DepositFeeQuote | undefined>();
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const formattedAmount = amount
    ? Number(amount).toLocaleString("en-NG")
    : "0";
  const hasDraftAmount = amount.length > 0;
  const numericAmount = Number(amount || 0);
  const hasDedicatedAccount = Boolean(wallet?.dedicated_account_number);

  const validateAmount = (value: number) => {
    if (!value) return "Enter an amount to continue.";
    if (value < MIN_DEPOSIT_NAIRA) {
      return `Minimum deposit is NGN ${MIN_DEPOSIT_NAIRA.toLocaleString("en-NG")}.`;
    }
    if (value > MAX_DEPOSIT_NAIRA) {
      return `Maximum deposit is NGN ${MAX_DEPOSIT_NAIRA.toLocaleString("en-NG")}.`;
    }

    return null;
  };

  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 70,
      friction: 10,
    }).start();
  }, [sheetAnim, visible]);

  useEffect(() => {
    setQuote(undefined);
    if (!amount || validateAmount(Number(amount))) return;
    const timer = setTimeout(() => {
      void onQuote(amount)
        .then(setQuote)
        .catch(() => setQuote(undefined));
    }, 450);
    return () => clearTimeout(timer);
  }, [amount, onQuote]);

  const requestClose = () => {
    if (isPending || isCreatingTransferAccount) return;

    if (!hasDraftAmount) {
      onClose();
      return;
    }

    Alert.alert(
      "Discard deposit?",
      "You have entered an amount. Closing now will clear it.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setAmount("");
            setAmountError(null);
            onClose();
          },
        },
      ]
    );
  };

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    setAmount(cleaned);
    setAmountError(cleaned ? validateAmount(Number(cleaned)) : null);
  };

  const handleSubmit = async () => {
    const error = validateAmount(numericAmount);
    if (error) {
      setAmountError(error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const currentQuote = quote || await onQuote(amount);
    if (!currentQuote) { setAmountError("Could not calculate processing fee. Try again."); return; }
    await onDeposit(amount, currentQuote.quote_id);
    setAmount("");
    setAmountError(null);
    onClose();
  };

  const handleCopyAccount = async () => {
    if (!wallet?.dedicated_account_number) return;

    await Clipboard.setStringAsync(wallet.dedicated_account_number);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({
      type: "success",
      text1: "Account number copied",
      text2: wallet.dedicated_bank_name || "Use it from your banking app.",
    });
  };

  const handleTransferRefresh = async () => {
    await onTransferRefresh();
    Toast.show({
      type: "success",
      text1: "Wallet refreshed",
      text2: "If your transfer has arrived, it will appear shortly.",
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />

        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />

        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: sheetAnim,
              transform: [
                {
                  translateY: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>Deposit Money</Text>

          <Text style={styles.subtitle}>
            Enter the amount you want to deposit into your vault.
          </Text>

          <View style={styles.transferBox}>
            <Text style={styles.transferTitle}>Bank transfer</Text>
            {wallet?.dedicated_account_number ? (
              <>
                <Text style={styles.transferBank}>
                  {wallet.dedicated_bank_name || "Paystack Bank"}
                </Text>
                <Text style={styles.transferNumber}>
                  {wallet.dedicated_account_number}
                </Text>
                <Text style={styles.transferName}>
                  {wallet.dedicated_account_name}
                </Text>
                <Text style={styles.transferHint}>
                  Bank transfers are credited after a 1% processing fee, capped at NGN 300.
                </Text>
                <View style={styles.transferActions}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.transferGhostButton}
                    onPress={handleCopyAccount}
                  >
                    <Text style={styles.transferGhostText}>Copy account</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.transferButton}
                    onPress={handleTransferRefresh}
                  >
                    <Text style={styles.transferButtonText}>
                      I have made transfer
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.transferHint}>
                  Generate a transfer account for direct bank deposits.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.transferButton}
                  onPress={onCreateTransferAccount}
                  disabled={isCreatingTransferAccount}
                >
                  <Text style={styles.transferButtonText}>
                    {isCreatingTransferAccount ? "Creating..." : "Generate Account"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.inputBox}>
            <Text style={styles.currency}>NGN</Text>

            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#A0A6A3"
              style={styles.input}
            />

            <Text style={styles.decimal}>.00</Text>
          </View>

          <Text style={styles.preview}>Amount: NGN {formattedAmount}.00</Text>
          {quote ? (
            <View style={styles.feeCard}>
              <View style={styles.feeRow}><Text style={styles.feeLabel}>Wallet credit</Text><Text style={styles.feeValue}>{formatMoney(quote.net_credit)}</Text></View>
              <View style={styles.feeRow}><Text style={styles.feeLabel}>Processing fee</Text><Text style={styles.feeValue}>{formatMoney(quote.provider_fee)}</Text></View>
              <View style={styles.feeDivider} />
              <View style={styles.feeRow}><Text style={styles.feeTotalLabel}>You will pay</Text><Text style={styles.feeTotal}>{formatMoney(quote.gross_charge)}</Text></View>
            </View>
          ) : isQuoting ? (
            <Text style={styles.limitText}>Calculating processing fee...</Text>
          ) : null}
          {amountError ? (
            <Text style={styles.errorText}>{amountError}</Text>
          ) : (
            <Text style={styles.limitText}>
              Deposit between NGN {MIN_DEPOSIT_NAIRA.toLocaleString("en-NG")} and
              NGN {MAX_DEPOSIT_NAIRA.toLocaleString("en-NG")}.
            </Text>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.button,
              (!amount || Boolean(amountError) || isPending || isQuoting || !quote) &&
                styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!amount || Boolean(amountError) || isPending || isQuoting || !quote}
          >
            <Text style={styles.buttonText}>
              {isPending ? "Processing..." : quote ? `Pay ${formatMoney(quote.gross_charge)}` : "Continue"}
            </Text>
          </TouchableOpacity>

          {hasDedicatedAccount ? (
            <Text style={styles.transferFootnote}>
              Transfers are confirmed by Paystack webhook. Use refresh if you just
              paid.
            </Text>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default DepositModal;

const styles = StyleSheet.create({
  feeCard: { marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: "#F4FAF7", gap: 7 },
  feeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  feeLabel: { color: "#66736E", fontSize: 12, fontWeight: "600" },
  feeValue: { color: "#063B2E", fontSize: 12, fontWeight: "800" },
  feeDivider: { height: 1, backgroundColor: "#DCE9E3", marginVertical: 2 },
  feeTotalLabel: { color: "#063B2E", fontSize: 13, fontWeight: "900" },
  feeTotal: { color: "#007A5A", fontSize: 14, fontWeight: "900" },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 34,
    paddingHorizontal: 24,
    paddingTop: 12,
  },

  handle: {
    alignSelf: "center",
    backgroundColor: "#D8DDDA",
    borderRadius: 999,
    height: 5,
    marginBottom: 24,
    width: 48,
  },

  title: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },

  transferBox: {
    backgroundColor: "#EFF8F4",
    borderColor: "rgba(15, 107, 79, 0.16)",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
  },

  transferTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },

  transferBank: {
    color: COLORS.border,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },

  transferNumber: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 4,
  },

  transferName: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "800",
  },

  transferActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  transferHint: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 12,
  },

  transferButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flex: 1,
    height: 44,
    justifyContent: "center",
  },

  transferButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
  },

  transferGhostButton: {
    alignItems: "center",
    borderColor: "rgba(15, 107, 79, 0.24)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    height: 44,
    justifyContent: "center",
  },

  transferGhostText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "900",
  },

  inputBox: {
    alignItems: "center",
    backgroundColor: COLORS.hash,
    borderColor: "rgba(113, 121, 117, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    height: 64,
    paddingHorizontal: 18,
  },

  currency: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "800",
    marginRight: 8,
  },

  input: {
    color: COLORS.primary,
    flex: 1,
    fontSize: 26,
    fontWeight: "800",
    paddingVertical: 0,
  },

  decimal: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: "800",
  },

  preview: {
    color: COLORS.border,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
  },

  errorText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    marginTop: 8,
  },

  limitText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 8,
  },

  button: {
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    borderRadius: 18,
    height: 56,
    justifyContent: "center",
    marginTop: 26,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  transferFootnote: {
    color: COLORS.border,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 12,
    textAlign: "center",
  },
});
