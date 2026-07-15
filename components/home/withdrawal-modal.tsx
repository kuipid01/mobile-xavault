import {
  Bank,
  BankAccount,
  CreateBankAccountPayload,
  ResolveAccountResponse,
} from "@/api/banking";
import { formatMoney, nairaToKobo } from "@/api/money";
import { Envelope, Plan } from "@/api/types";
import {
  useBankAccounts,
  useBanks,
  useBeneficiaries,
  useCreateBankAccount,
  useCreateBeneficiary,
  useResolveBankAccount,
} from "@/hooks/app/banking";
import { useEnvelopes } from "@/hooks/app/envelopes";
import { usePlans } from "@/hooks/app/plans";
import {
  useForgotWithdrawalPin,
  useResetWithdrawalPin,
  useSetWithdrawalPin,
  useWithdrawalPinStatus,
} from "@/hooks/app/withdrawal-pin";
import { useRequestWithdrawal } from "@/hooks/app/withdrawals";
import { trackEvent } from "@/lib/analytics";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

// ─── Design tokens ────────────────────────────────────────────────────────────

const COLOR = {
  forestDeep: "#063B2E",
  forestMid: "#106B4F",
  forestLight: "#EAF7F1",
  forestBorder: "#CDEDE0",
  forestMuted: "#7A8580",
  forestFaint: "#9EAAA5",
  surface: "#FFFFFF",
  bg: "#F0F4F2",
  border: "#DDE6E1",
  bgSubtle: "#F4F7F5",
  amber: "#946500",
  amberBg: "#FFFBEE",
  amberBorder: "#F2E4A8",
  textBody: "#063B2E",
  textMuted: "#7A8580",
  textFaint: "#9EAAA5",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  onCompleted?: () => void | Promise<void>;
};

type WithdrawalTarget =
  | { type: "plan"; id: string; label: string; balance: number; reason: string }
  | {
    type: "envelope";
    id: string;
    label: string;
    balance: number;
    reason: string;
    envelope: Envelope;
  };

type Step = "plan" | "source" | "amount" | "destination" | "review" | "pin";

type DestinationSelection = {
  type: "account" | "beneficiary";
  id: string;
  label: string;
  bank: string;
  accountNumber: string;
};

type WithdrawalReceipt = {
  reference: string;
  amount: number;
  status: string;
  destination: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isDateReached = (date?: string | null) => {
  if (!date) return false;
  const parsed = new Date(date);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now();
};

const isPlanMatured = (plan: Plan) =>
  plan.status === "expired" ||
  plan.status === "completed" ||
  isDateReached(plan.end_date);

const isEnvelopeMatured = (envelope: Envelope) =>
  envelope.status === "expired" ||
  envelope.status === "completed" ||
  isDateReached(envelope.end_date);

const flattenEnvelopes = (items: Envelope[] = []): Envelope[] =>
  items.flatMap((e) => [e, ...flattenEnvelopes(e.children || [])]);

const planWithdrawalTarget = (plan: Plan): WithdrawalTarget | null => {
  const matured = isPlanMatured(plan);
  const flexible = plan.unboxed_balance_policy === "flexible";
  const balance = plan.plan_unboxed_balance;
  if ((!matured && !flexible) || balance <= 0) return null;
  return {
    type: "plan",
    id: plan.id,
    label: plan.name,
    balance,
    reason: matured ? "Reached end date" : "Flexible",
  };
};

const envelopeWithdrawalTarget = (envelope: Envelope): WithdrawalTarget | null => {
  const matured = isEnvelopeMatured(envelope);
  const flexible = envelope.unboxed_balance_policy === "flexible";
  const balance = envelope.unboxed_balance;
  if ((!matured && !flexible) || balance <= 0) return null;
  return {
    type: "envelope",
    id: envelope.id,
    label: envelope.name,
    balance,
    reason: matured ? "Reached end date" : "Flexible",
    envelope,
  };
};

const maskAccountNumber = (value: string) =>
  value.length > 4 ? `••${value.slice(-4)}` : value;

const mapDestination = (
  account: BankAccount,
  type: DestinationSelection["type"]
): DestinationSelection => ({
  type,
  id: account.id,
  label: account.nickname || account.account_name,
  bank: account.bank_name,
  accountNumber: account.account_number,
});

const createWithdrawalAttemptKey = () =>
  `withdrawal:${Date.now()}:${Math.random().toString(36).slice(2)}:${Math.random()
    .toString(36)
    .slice(2)}`;

const showBottomToast = (options: Parameters<typeof Toast.show>[0]) =>
  Toast.show({ position: "bottom", ...options });

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS: Step[] = ["plan", "source", "amount", "destination", "review", "pin"];
const STEP_LABELS: Record<Step, string> = {
  plan: "Plan",
  source: "Source",
  amount: "Amount",
  destination: "To",
  review: "Review",
  pin: "PIN",
};
// ─── Progress bar ─────────────────────────────────────────────────────────────

const ProgressBar = ({ current }: { current: Step }) => {
  const currentIdx = STEPS.indexOf(current);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: (currentIdx + 1) / STEPS.length,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [currentIdx, progress]);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={progressStyles.wrap}>
      <View style={progressStyles.track}>
        <Animated.View style={[progressStyles.fill, { width: barWidth }]} />
      </View>
      <View style={progressStyles.labelRow}>
        <Text style={progressStyles.stepName}>
          {STEP_LABELS[current]}
        </Text>
        <Text style={progressStyles.stepCount}>
          {currentIdx + 1} of {STEPS.length}
        </Text>
      </View>
    </View>
  );
};

const progressStyles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
    gap: 8,
  },
  track: {
    height: 3,
    borderRadius: 99,
    backgroundColor: COLOR.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: COLOR.forestMid,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepName: {
    fontSize: 12,
    fontWeight: "800",
    color: COLOR.forestMid,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  stepCount: {
    fontSize: 11,
    fontWeight: "700",
    color: COLOR.textFaint,
  },
});

// ─── Shared list row ──────────────────────────────────────────────────────────

const SelectRow = ({
  selected,
  icon,
  title,
  meta,
  tag,
  balance,
  currency,
  onPress,
}: {
  selected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta?: string;
  tag?: string;
  balance?: number;
  currency?: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    style={[rowStyles.row, selected && rowStyles.rowSelected]}
  >
    <View style={[rowStyles.icon, selected && rowStyles.iconSelected]}>
      <Ionicons name={icon} size={18} color={selected ? "#FFF" : COLOR.forestMuted} />
    </View>
    <View style={rowStyles.body}>
      <Text style={[rowStyles.title, selected && rowStyles.titleSelected]} numberOfLines={1}>
        {title}
      </Text>
      {meta ? (
        <Text style={rowStyles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      {tag ? (
        <View style={[rowStyles.tag, selected && rowStyles.tagSelected]}>
          <Text style={[rowStyles.tagText, selected && rowStyles.tagTextSelected]}>
            {tag}
          </Text>
        </View>
      ) : null}
      {balance != null ? (
        <Text style={[rowStyles.balance, selected && rowStyles.balanceSelected]}>
          {formatMoney(balance, currency)} available
        </Text>
      ) : null}
    </View>
    <View style={[rowStyles.radio, selected && rowStyles.radioSelected]}>
      {selected && <View style={rowStyles.radioDot} />}
    </View>
  </TouchableOpacity>
);

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    padding: 14,
  },
  rowSelected: {
    borderColor: COLOR.forestDeep,
    backgroundColor: "#F4FAF7",
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSelected: {
    backgroundColor: COLOR.forestDeep,
  },
  body: { flex: 1, gap: 3 },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: COLOR.textBody,
  },
  titleSelected: {
    color: COLOR.forestDeep,
  },
  meta: {
    fontSize: 12,
    fontWeight: "600",
    color: COLOR.textFaint,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLOR.bgSubtle,
    marginTop: 2,
  },
  tagSelected: {
    backgroundColor: COLOR.forestLight,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLOR.textMuted,
    textTransform: "capitalize",
  },
  tagTextSelected: {
    color: COLOR.forestMid,
  },
  balance: {
    fontSize: 13,
    fontWeight: "900",
    color: COLOR.textBody,
    marginTop: 2,
  },
  balanceSelected: {
    color: COLOR.forestMid,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: COLOR.forestDeep,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLOR.forestDeep,
  },
});

// ─── Loading / Empty states ───────────────────────────────────────────────────

const LoadingState = ({ text }: { text: string }) => (
  <View style={stateStyles.row}>
    <ActivityIndicator color={COLOR.forestDeep} size="small" />
    <Text style={stateStyles.text}>{text}</Text>
  </View>
);

const EmptyState = ({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) => (
  <View style={stateStyles.emptyCard}>
    <View style={stateStyles.emptyIcon}>
      <Ionicons name={icon} size={22} color={COLOR.textFaint} />
    </View>
    <Text style={stateStyles.emptyTitle}>{title}</Text>
    {subtitle ? <Text style={stateStyles.emptySub}>{subtitle}</Text> : null}
  </View>
);

const stateStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
    justifyContent: "center",
  },
  text: {
    color: COLOR.textFaint,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: COLOR.bgSubtle,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLOR.textBody,
  },
  emptySub: {
    fontSize: 12,
    fontWeight: "600",
    color: COLOR.textFaint,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 240,
  },
});

// ─── Summary card (reused in PIN + Confirm steps) ─────────────────────────────

const SummaryCard = ({
  plan,
  target,
  destination,
  amountInKobo,
  withdrawAll,
  compact = false,
}: {
  plan?: Plan;
  target?: WithdrawalTarget;
  destination?: DestinationSelection;
  amountInKobo: number;
  withdrawAll: boolean;
  compact?: boolean;
}) => (
  <View style={summaryStyles.card}>
    <View style={summaryStyles.amountBlock}>
      <Text style={summaryStyles.amountLabel}>You&apos;re withdrawing</Text>
      <Text style={summaryStyles.amountValue}>
        {formatMoney(amountInKobo, plan?.currency)}
      </Text>
      {withdrawAll && (
        <View style={summaryStyles.badge}>
          <Ionicons name="checkmark-circle" size={11} color={COLOR.forestMid} />
          <Text style={summaryStyles.badgeText}>Full balance</Text>
        </View>
      )}
    </View>
    <View style={summaryStyles.divider} />
    <View style={summaryStyles.rows}>
      {!compact && (
        <SummaryRow
          label="Plan"
          value={plan?.name}
          icon="layers-outline"
        />
      )}
      <SummaryRow
        label="From"
        value={target?.label}
        icon={target?.type === "plan" ? "layers-outline" : "file-tray-outline"}
        sub={target?.type === "envelope" ? "Envelope" : "Plan balance"}
      />
      <SummaryRow
        label="To"
        value={destination?.label}
        icon="paper-plane-outline"
        sub={
          destination
            ? `${destination.bank} · ${maskAccountNumber(destination.accountNumber)}`
            : undefined
        }
        last
      />
    </View>
  </View>
);

const SummaryRow = ({
  label,
  value,
  icon,
  sub,
  last,
}: {
  label: string;
  value?: string;
  icon: keyof typeof Ionicons.glyphMap;
  sub?: string;
  last?: boolean;
}) => (
  <View style={[summaryStyles.detailRow, last && summaryStyles.detailRowLast]}>
    <View style={summaryStyles.detailIconWrap}>
      <Ionicons name={icon} size={13} color={COLOR.forestMid} />
    </View>
    <View style={summaryStyles.detailContent}>
      <Text style={summaryStyles.detailLabel}>{label}</Text>
      <Text style={summaryStyles.detailValue} numberOfLines={1}>
        {value ?? "—"}
      </Text>
      {sub ? <Text style={summaryStyles.detailSub}>{sub}</Text> : null}
    </View>
  </View>
);

const summaryStyles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  amountBlock: {
    padding: 20,
    gap: 6,
    backgroundColor: COLOR.forestLight,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLOR.forestMid,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: "900",
    color: COLOR.forestDeep,
    letterSpacing: -1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.forestBorder,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLOR.forestMid,
  },
  divider: {
    height: 1,
    backgroundColor: COLOR.border,
  },
  rows: {},
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F2",
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: COLOR.forestLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLOR.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "800",
    color: COLOR.textBody,
  },
  detailSub: {
    fontSize: 11,
    fontWeight: "600",
    color: COLOR.textMuted,
  },
});

// ─── Main modal ───────────────────────────────────────────────────────────────

const WithdrawalModal = ({ visible, onClose, onCompleted }: Props) => {
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [selectedTargetId, setSelectedTargetId] = useState<string>();
  const [amount, setAmount] = useState("");
  const [withdrawAll, setWithdrawAll] = useState(true);
  const [selectedDestinationKey, setSelectedDestinationKey] = useState<string>();
  const [withdrawalPin, setWithdrawalPin] = useState("");
  const [newWithdrawalPin, setNewWithdrawalPin] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [pinMode, setPinMode] = useState<"enter" | "reset">("enter");
  const [withdrawalAttemptKey, setWithdrawalAttemptKey] = useState(
    createWithdrawalAttemptKey
  );
  const [processingState, setProcessingState] = useState<
    "processing" | "success" | undefined
  >();
  const [withdrawalReceipt, setWithdrawalReceipt] =
    useState<WithdrawalReceipt | null>(null);

  const { data: plansData, isLoading: isPlansLoading } = usePlans();
  const plans = useMemo(() => plansData?.items || [], [plansData?.items]);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const { data: envelopes = [], isLoading: isEnvelopesLoading } =
    useEnvelopes(selectedPlanId);
  const { data: banks = [], isLoading: isBanksLoading } = useBanks();
  const { data: bankAccounts = [], isLoading: isAccountsLoading } =
    useBankAccounts();
  const { data: beneficiaries = [], isLoading: isBeneficiariesLoading } =
    useBeneficiaries();
  const { mutateAsync: resolveAccount, isPending: isResolvingAccount } =
    useResolveBankAccount();
  const { mutateAsync: createBankAccount, isPending: isCreatingAccount } =
    useCreateBankAccount();
  const { mutateAsync: createBeneficiary, isPending: isCreatingBeneficiary } =
    useCreateBeneficiary();
  const { mutateAsync: requestWithdrawal, isPending: isWithdrawing } =
    useRequestWithdrawal();
  const { data: pinStatus, isLoading: isPinStatusLoading } =
    useWithdrawalPinStatus();
  const { mutateAsync: saveWithdrawalPin, isPending: isSettingPin } =
    useSetWithdrawalPin();
  const { mutateAsync: forgotWithdrawalPin, isPending: isSendingPinOtp } =
    useForgotWithdrawalPin();
  const { mutateAsync: resetWithdrawalPin, isPending: isResettingPin } =
    useResetWithdrawalPin();

  const targetOptions = useMemo(() => {
    if (!selectedPlan) return [];
    const planTarget = planWithdrawalTarget(selectedPlan);
    const envTargets = flattenEnvelopes(envelopes)
      .map(envelopeWithdrawalTarget)
      .filter((t): t is WithdrawalTarget => !!t);
    return [planTarget, ...envTargets].filter((t): t is WithdrawalTarget => !!t);
  }, [envelopes, selectedPlan]);

  const selectedTarget = targetOptions.find((t) => t.id === selectedTargetId);
  const destinationOptions: DestinationSelection[] = useMemo(
    () => [
      ...bankAccounts.map((account) => mapDestination(account, "account")),
      ...beneficiaries.map((account) => mapDestination(account, "beneficiary")),
    ],
    [bankAccounts, beneficiaries]
  );
  const selectedDestination = destinationOptions.find(
    (d) => `${d.type}:${d.id}` === selectedDestinationKey
  );
  const amountInKobo = withdrawAll
    ? selectedTarget?.balance || 0
    : nairaToKobo(amount);
  const amountIsValid =
    !!selectedTarget && amountInKobo > 0 && amountInKobo <= selectedTarget.balance;
  const hasWithdrawalPin = !!pinStatus?.has_pin;
  const pinToSubmit = hasWithdrawalPin ? withdrawalPin : newWithdrawalPin;
  const pinIsValid = /^\d{4}$/.test(pinToSubmit);
  const canConfirm =
    !!selectedPlan &&
    !!selectedTarget &&
    !!selectedDestination &&
    amountIsValid &&
    !isPinStatusLoading &&
    pinMode === "enter" &&
    pinIsValid &&
    !processingState;

  // Auto-select first plan
  useEffect(() => {
    if (visible && !selectedPlanId && plans[0]) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId, visible]);

  // Auto-select first eligible target when plan changes
  useEffect(() => {
    setSelectedTargetId(targetOptions[0]?.id);
  }, [selectedPlanId, targetOptions]);

  const resetAndClose = () => {
    setStep("plan");
    setAmount("");
    setWithdrawAll(true);
    setSelectedPlanId(undefined);
    setSelectedTargetId(undefined);
    setSelectedDestinationKey(undefined);
    setWithdrawalPin("");
    setNewWithdrawalPin("");
    setResetOtp("");
    setPinMode("enter");
    setWithdrawalAttemptKey(createWithdrawalAttemptKey());
    setProcessingState(undefined);
    setWithdrawalReceipt(null);
    onClose();
  };

  const hasDismissibleProgress =
    step !== "plan" ||
    amount.length > 0 ||
    !!selectedDestinationKey ||
    withdrawalPin.length > 0 ||
    newWithdrawalPin.length > 0 ||
    resetOtp.length > 0;

  const requestClose = () => {
    if (processingState === "processing" || isWithdrawing || isSettingPin) {
      showBottomToast({
        type: "info",
        text1: "Withdrawal in progress",
        text2: "Please wait while we finish this request.",
      });
      return;
    }

    if (!hasDismissibleProgress) {
      resetAndClose();
      return;
    }

    trackEvent("withdrawal_abandoned", {
      amount: amountInKobo,
      step,
    });
    Alert.alert(
      "Discard withdrawal?",
      "You have started a withdrawal. Closing now will clear this request.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: resetAndClose },
      ]
    );
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
    else requestClose();
  };

  const handleContinue = () => {
    if (step === "plan") {
      if (!selectedPlanId) {
        showBottomToast({ type: "error", text1: "Select a plan to continue." });
        return;
      }
      setStep("source");
    } else if (step === "source") {
      if (!selectedTargetId) {
        showBottomToast({ type: "error", text1: "Select a withdrawal source." });
        return;
      }
      trackEvent("withdrawal_source_selected", {
        source_type: selectedTarget?.type || null,
        source_id: selectedTargetId,
      });
      setStep("amount");
    } else if (step === "amount") {
      if (!amountIsValid) {
        showBottomToast({
          type: "error",
          text1: "Invalid amount",
          text2: `Max: ${formatMoney(selectedTarget?.balance || 0)}`,
        });
        return;
      }
      setStep("destination");
    } else if (step === "destination") {
      if (!selectedDestination) {
        showBottomToast({ type: "error", text1: "Select a destination account." });
        return;
      }
      trackEvent("withdrawal_destination_selected", {
        destination_type: selectedDestination.type,
      });
      setStep("review");
    } else if (step === "review") {
      trackEvent("withdrawal_reviewed", {
        amount: amountInKobo,
        source_type: selectedTarget?.type || null,
      });
      setStep("pin");
    } else if (step === "pin") {
      void handleConfirm();
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm || !selectedPlan || !selectedTarget || !selectedDestination)
      return;

    // If user doesn't have a PIN yet, save it first
    if (!hasWithdrawalPin) {
      try {
        await saveWithdrawalPin(newWithdrawalPin);
        setWithdrawalPin(newWithdrawalPin);
      } catch (error: any) {
        showBottomToast({
          type: "error",
          text1: "Could not save PIN",
          text2:
            error?.response?.data?.message ||
            error?.message ||
            "Please try again.",
        });
        return;
      }
    }

    const payload = {
      source_type:
        selectedTarget.type === "plan"
          ? ("plan_unboxed" as const)
          : ("envelope" as const),
      envelope_id:
        selectedTarget.type === "envelope" ? selectedTarget.id : undefined,
      amount: amountInKobo,
      destination_type: selectedDestination.type,
      destination_id: selectedDestination.id,
      withdrawal_pin: pinToSubmit,
      idempotency_key: withdrawalAttemptKey,
    };

    try {
      setProcessingState("processing");
      trackEvent("withdrawal_pin_entered", {
        amount: amountInKobo,
        source_type: selectedTarget.type,
      });
      const response = await requestWithdrawal({ planId: selectedPlan.id, payload });
      const reference =
        response?.withdrawal?.reference ||
        response?.paystack?.reference ||
        withdrawalAttemptKey;

      setWithdrawalReceipt({
        reference,
        amount: response?.withdrawal?.amount || amountInKobo,
        status: response?.withdrawal?.status || "processing",
        destination: `${selectedDestination.bank} ${maskAccountNumber(
          selectedDestination.accountNumber
        )}`,
      });
      trackEvent("withdrawal_completed", {
        amount: response?.withdrawal?.amount || amountInKobo,
        reference,
        status: response?.withdrawal?.status || "processing",
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onCompleted?.();
      setProcessingState("success");
    } catch (error: any) {
      setProcessingState(undefined);
      setWithdrawalAttemptKey(createWithdrawalAttemptKey());
      trackEvent("withdrawal_failed", {
        amount: amountInKobo,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "unknown",
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showBottomToast({
        type: "error",
        text1: "Withdrawal failed",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try again.",
      });
    }
  };

  const isCTADisabled =
    (step === "plan" && !selectedPlanId) ||
    (step === "source" && !selectedTargetId) ||
    (step === "amount" && !amountIsValid) ||
    (step === "destination" && !selectedDestination) ||
    (step === "review" && (!selectedDestination || !amountIsValid)) ||
    (step === "pin" && (!canConfirm || isWithdrawing || isSettingPin));

  const isLastStep = step === "pin";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={requestClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* ── Sheet header ── */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={goBack}
              style={styles.navButton}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={18} color={COLOR.forestDeep} />
            </TouchableOpacity>

            <Text style={styles.sheetTitle}>Withdraw</Text>

            <TouchableOpacity
              onPress={requestClose}
              style={styles.navButton}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={16} color={COLOR.forestDeep} />
            </TouchableOpacity>
          </View>

          {/* ── Progress ── */}
          <ProgressBar current={step} />

          {/* ── Step content ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {step === "plan" && (
              <StepPlan
                plans={plans}
                isLoading={isPlansLoading}
                selectedPlanId={selectedPlanId}
                onSelect={setSelectedPlanId}
              />
            )}

            {step === "source" && (
              <StepSource
                targetOptions={targetOptions}
                isLoading={isEnvelopesLoading}
                selectedTargetId={selectedTargetId}
                onSelect={setSelectedTargetId}
                currency={selectedPlan?.currency}
              />
            )}

            {step === "amount" && (
              <StepAmount
                selectedTarget={selectedTarget}
                currency={selectedPlan?.currency}
                amount={amount}
                withdrawAll={withdrawAll}
                amountInKobo={amountInKobo}
                onChangeAmount={(v) => {
                  setAmount(v.replace(/[^0-9]/g, ""));
                  setWithdrawAll(false);
                }}
                onWithdrawAll={() => {
                  setWithdrawAll(!withdrawAll);
                  setAmount("");
                }}
              />
            )}

            {step === "destination" && (
              <StepDestination
                banks={banks}
                accounts={bankAccounts}
                destinationOptions={destinationOptions}
                selectedDestinationKey={selectedDestinationKey}
                isLoading={
                  isBanksLoading || isAccountsLoading || isBeneficiariesLoading
                }
                isResolving={isResolvingAccount}
                isSaving={isCreatingAccount || isCreatingBeneficiary}
                onSelect={setSelectedDestinationKey}
                onResolve={resolveAccount}
                onCreateAccount={async (payload) => {
                  const account = await createBankAccount(payload);
                  if (account) {
                    setSelectedDestinationKey(`account:${account.id}`);
                  }
                }}
                onCreateBeneficiary={async (payload) => {
                  const account = await createBeneficiary(payload);
                  if (account) {
                    setSelectedDestinationKey(`beneficiary:${account.id}`);
                  }
                }}
              />
            )}

            {step === "review" && (
              <StepReview
                selectedPlan={selectedPlan}
                selectedTarget={selectedTarget}
                selectedDestination={selectedDestination}
                amountInKobo={amountInKobo}
                withdrawAll={withdrawAll}
              />
            )}

            {step === "pin" && (
              <StepPin
                selectedPlan={selectedPlan}
                selectedTarget={selectedTarget}
                selectedDestination={selectedDestination}
                amountInKobo={amountInKobo}
                withdrawAll={withdrawAll}
                hasWithdrawalPin={hasWithdrawalPin}
                isPinStatusLoading={isPinStatusLoading}
                pinMode={pinMode}
                withdrawalPin={withdrawalPin}
                newWithdrawalPin={newWithdrawalPin}
                resetOtp={resetOtp}
                isSendingPinOtp={isSendingPinOtp}
                isResettingPin={isResettingPin}
                onChangeWithdrawalPin={setWithdrawalPin}
                onChangeNewWithdrawalPin={setNewWithdrawalPin}
                onChangeResetOtp={setResetOtp}
                onForgotPin={async () => {
                  try {
                    await forgotWithdrawalPin();
                    setPinMode("reset");
                    showBottomToast({
                      type: "success",
                      text1: "OTP sent",
                      text2: "Check your email for the reset code.",
                    });
                  } catch (error: any) {
                    showBottomToast({
                      type: "error",
                      text1: "Could not send OTP",
                      text2:
                        error?.response?.data?.message ||
                        error?.message ||
                        "Please try again.",
                    });
                  }
                }}
                onResetPin={async () => {
                  try {
                    await resetWithdrawalPin({
                      otp: resetOtp,
                      pin: newWithdrawalPin,
                    });
                    setWithdrawalPin(newWithdrawalPin);
                    setNewWithdrawalPin("");
                    setResetOtp("");
                    setPinMode("enter");
                    showBottomToast({
                      type: "success",
                      text1: "PIN reset",
                      text2: "You can now confirm this withdrawal.",
                    });
                  } catch (error: any) {
                    showBottomToast({
                      type: "error",
                      text1: "Could not reset PIN",
                      text2:
                        error?.response?.data?.message ||
                        error?.message ||
                        "Please check the OTP and try again.",
                    });
                  }
                }}
                onCancelReset={() => {
                  setPinMode("enter");
                  setResetOtp("");
                  setNewWithdrawalPin("");
                }}
              />
            )}
          </ScrollView>

          {/* ── Footer CTA ── */}
          <TouchableOpacity
            style={[styles.cta, isCTADisabled && styles.ctaDisabled]}
            onPress={handleContinue}
            disabled={isCTADisabled}
            activeOpacity={0.85}
          >
            {(isWithdrawing || isSettingPin) && isLastStep ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {step === "review"
                    ? "Approve with PIN"
                    : isLastStep
                      ? "Submit withdrawal"
                      : "Continue"}
                </Text>
                <Ionicons
                  name={isLastStep ? "checkmark" : "arrow-forward"}
                  size={16}
                  color="#FFFFFF"
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Processing overlay (inline in same modal, not nested modal) ── */}
        {processingState && (
          <ProcessingOverlay
            state={processingState}
            amount={formatMoney(amountInKobo, selectedPlan?.currency)}
            receipt={withdrawalReceipt}
            onDone={resetAndClose}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Step 1: Plan picker ──────────────────────────────────────────────────────

const StepPlan = ({
  plans,
  isLoading,
  selectedPlanId,
  onSelect,
}: {
  plans: Plan[];
  isLoading: boolean;
  selectedPlanId?: string;
  onSelect: (id: string) => void;
}) => (
  <View style={stepStyles.wrap}>
    <StepHeading
      title="Which plan?"
      sub="Choose the plan you want to withdraw from."
    />
    {isLoading ? (
      <LoadingState text="Loading plans…" />
    ) : plans.length === 0 ? (
      <EmptyState icon="folder-open-outline" title="No plans found" />
    ) : (
      <View style={stepStyles.list}>
        {plans.map((plan) => (
          <SelectRow
            key={plan.id}
            selected={plan.id === selectedPlanId}
            icon="layers-outline"
            title={plan.name}
            meta={formatMoney(plan.amount, plan.currency)}
            onPress={() => onSelect(plan.id)}
          />
        ))}
      </View>
    )}
  </View>
);

// ─── Step 2: Source picker ────────────────────────────────────────────────────

const StepSource = ({
  targetOptions,
  isLoading,
  selectedTargetId,
  onSelect,
  currency,
}: {
  targetOptions: WithdrawalTarget[];
  isLoading: boolean;
  selectedTargetId?: string;
  onSelect: (id: string) => void;
  currency?: string;
}) => (
  <View style={stepStyles.wrap}>
    <StepHeading
      title="Which balance?"
      sub="Only unlocked or matured balances can be withdrawn."
    />
    {isLoading ? (
      <LoadingState text="Checking sources…" />
    ) : targetOptions.length === 0 ? (
      <EmptyState
        icon="lock-closed-outline"
        title="Everything is locked"
        subtitle="Balances unlock when a plan or envelope is flexible or reaches its end date."
      />
    ) : (
      <View style={stepStyles.list}>
        {targetOptions.map((target) => (
          <SelectRow
            key={`${target.type}-${target.id}`}
            selected={target.id === selectedTargetId}
            icon={target.type === "plan" ? "layers-outline" : "file-tray-outline"}
            title={target.label}
            tag={target.reason}
            balance={target.balance}
            currency={currency}
            onPress={() => onSelect(target.id)}
          />
        ))}
      </View>
    )}
  </View>
);

// ─── Step 3: Amount ───────────────────────────────────────────────────────────

const StepAmount = ({
  selectedTarget,
  currency,
  amount,
  withdrawAll,
  amountInKobo,
  onChangeAmount,
  onWithdrawAll,
}: {
  selectedTarget?: WithdrawalTarget;
  currency?: string;
  amount: string;
  withdrawAll: boolean;
  amountInKobo: number;
  onChangeAmount: (v: string) => void;
  onWithdrawAll: () => void;
}) => (
  <View style={stepStyles.wrap}>
    <StepHeading
      title="How much?"
      sub={`Withdrawing from ${selectedTarget?.label ?? "this balance"}.`}
    />

    {/* Available balance chip */}
    <View style={amountStyles.availableChip}>
      <Ionicons name="wallet-outline" size={13} color={COLOR.forestMid} />
      <Text style={amountStyles.availableLabel}>Available</Text>
      <Text style={amountStyles.availableValue}>
        {formatMoney(selectedTarget?.balance || 0, currency)}
      </Text>
    </View>

    {/* Large amount input */}
    <View style={[amountStyles.inputWrap, withdrawAll && amountStyles.inputWrapMuted]}>
      <Text style={amountStyles.currencySymbol}>₦</Text>
      <TextInput
        value={withdrawAll ? formatMoney(selectedTarget?.balance || 0, currency).replace(/[^0-9]/g, "") : amount}
        onChangeText={(v) => {
          if (withdrawAll) return;
          onChangeAmount(v);
        }}
        onFocus={() => {
          if (withdrawAll) onWithdrawAll();
        }}
        editable={!!selectedTarget && !withdrawAll}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={`${COLOR.forestDeep}22`}
        style={[amountStyles.input, withdrawAll && amountStyles.inputMuted]}
        autoFocus={!withdrawAll}
      />
    </View>

    {/* Withdraw all toggle */}
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onWithdrawAll}
      style={[amountStyles.allRow, withdrawAll && amountStyles.allRowActive]}
    >
      <View style={[amountStyles.checkbox, withdrawAll && amountStyles.checkboxActive]}>
        {withdrawAll && <Ionicons name="checkmark" size={12} color="#FFF" />}
      </View>
      <Text style={[amountStyles.allLabel, withdrawAll && amountStyles.allLabelActive]}>
        Withdraw full amount
      </Text>
      <Text style={amountStyles.allAmount}>
        {formatMoney(selectedTarget?.balance || 0, currency)}
      </Text>
    </TouchableOpacity>

    {/* Live preview */}
    {amountInKobo > 0 && !withdrawAll && (
      <View style={amountStyles.preview}>
        <Ionicons name="arrow-forward-circle-outline" size={15} color={COLOR.forestMid} />
        <Text style={amountStyles.previewText}>
          Sending{" "}
          <Text style={{ fontWeight: "900" }}>
            {formatMoney(amountInKobo, currency)}
          </Text>{" "}
          to your account.
        </Text>
      </View>
    )}
  </View>
);

// ─── Step 4: Destination ──────────────────────────────────────────────────────

const StepDestination = ({
  banks,
  accounts,
  destinationOptions,
  selectedDestinationKey,
  isLoading,
  isResolving,
  isSaving,
  onSelect,
  onResolve,
  onCreateAccount,
  onCreateBeneficiary,
}: {
  banks: Bank[];
  accounts: BankAccount[];
  destinationOptions: DestinationSelection[];
  selectedDestinationKey?: string;
  isLoading: boolean;
  isResolving: boolean;
  isSaving: boolean;
  onSelect: (key: string) => void;
  onResolve: (payload: {
    bank_code: string;
    account_number: string;
  }) => Promise<ResolveAccountResponse | undefined>;
  onCreateAccount: (payload: CreateBankAccountPayload) => Promise<void>;
  onCreateBeneficiary: (payload: CreateBankAccountPayload) => Promise<void>;
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [saveAs, setSaveAs] = useState<"account" | "beneficiary">("account");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [resolved, setResolved] = useState<ResolveAccountResponse>();
  const [destinationSearch, setDestinationSearch] = useState("");
  const [bankSearch, setBankSearch] = useState("");

  const selectedBank = banks.find((b) => b.code === selectedBankCode);
  const filteredDestinations = destinationOptions.filter((d) => {
    const q = destinationSearch.trim().toLowerCase();
    if (!q) return true;
    return [d.label, d.bank, d.accountNumber].some((v) =>
      v.toLowerCase().includes(q)
    );
  });
  const filteredBanks = banks.filter((b) => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return true;
    return [b.name, b.code, b.slug]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  const handleResolve = async () => {
    if (!selectedBankCode || accountNumber.length < 10) {
      showBottomToast({ type: "error", text1: "Enter bank and 10-digit account number" });
      return;
    }
    try {
      const result = await onResolve({
        bank_code: selectedBankCode,
        account_number: accountNumber,
      });
      setResolved(result);
    } catch (error: any) {
      setResolved(undefined);
      showBottomToast({
        type: "error",
        text1: "Could not verify account",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please check the bank details.",
      });
    }
  };

  const handleSave = async () => {
    if (!selectedBank || !resolved) return;
    const payload = {
      bank_name: selectedBank.name,
      bank_code: selectedBank.code,
      account_number: resolved.account_number,
      nickname,
      is_default: saveAs === "account" && accounts.length === 0,
    };
    try {
      if (saveAs === "account") await onCreateAccount(payload);
      else await onCreateBeneficiary(payload);
      showBottomToast({ type: "success", text1: "Account saved" });
      setShowAdd(false);
      setAccountNumber("");
      setNickname("");
      setResolved(undefined);
    } catch (error: any) {
      showBottomToast({
        type: "error",
        text1: "Could not save account",
        text2:
          error?.response?.data?.message || error?.message || "Please try again.",
      });
    }
  };

  return (
    <View style={stepStyles.wrap}>
      <StepHeading
        title="Send to where?"
        sub="Pick a saved account or add a new one."
      />

      {isLoading && <LoadingState text="Loading accounts…" />}

      {!isLoading && destinationOptions.length === 0 && !showAdd && (
        <EmptyState
          icon="card-outline"
          title="No saved accounts"
          subtitle="Add a bank account below to continue."
        />
      )}

      {destinationOptions.length > 0 && (
        <View style={stepStyles.list}>
          {/* Search */}
          <View style={destStyles.searchRow}>
            <Ionicons name="search-outline" size={15} color={COLOR.textFaint} />
            <TextInput
              value={destinationSearch}
              onChangeText={setDestinationSearch}
              placeholder="Search saved accounts"
              placeholderTextColor={COLOR.textFaint}
              style={destStyles.searchInput}
            />
            {destinationSearch.length > 0 && (
              <TouchableOpacity onPress={() => setDestinationSearch("")}>
                <Ionicons name="close-circle" size={16} color={COLOR.textFaint} />
              </TouchableOpacity>
            )}
          </View>

          {filteredDestinations.length === 0 ? (
            <EmptyState icon="search-outline" title="No matching accounts" />
          ) : (
            filteredDestinations.map((dest) => {
              const key = `${dest.type}:${dest.id}`;
              return (
                <SelectRow
                  key={key}
                  selected={key === selectedDestinationKey}
                  icon={dest.type === "account" ? "card-outline" : "person-outline"}
                  title={dest.label}
                  meta={`${dest.bank} · ${maskAccountNumber(dest.accountNumber)}`}
                  onPress={() => onSelect(key)}
                />
              );
            })
          )}
        </View>
      )}

      {/* Add account toggle */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={destStyles.addToggle}
        onPress={() => setShowAdd((p) => !p)}
      >
        <View style={destStyles.addToggleIcon}>
          <Ionicons name={showAdd ? "remove" : "add"} size={16} color={COLOR.forestDeep} />
        </View>
        <Text style={destStyles.addToggleText}>
          {showAdd ? "Cancel" : "Add a new account"}
        </Text>
      </TouchableOpacity>

      {showAdd && (
        <View style={destStyles.form}>
          {/* Account type segment */}
          <View style={destStyles.segment}>
            {(["account", "beneficiary"] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.8}
                onPress={() => setSaveAs(opt)}
                style={[destStyles.segItem, saveAs === opt && destStyles.segItemActive]}
              >
                <Ionicons
                  name={opt === "account" ? "person-outline" : "people-outline"}
                  size={13}
                  color={saveAs === opt ? "#FFF" : COLOR.textMuted}
                />
                <Text
                  style={[destStyles.segText, saveAs === opt && destStyles.segTextActive]}
                >
                  {opt === "account" ? "My account" : "Beneficiary"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bank selection */}
          <Text style={destStyles.fieldLabel}>Bank</Text>
          <View style={destStyles.searchRow}>
            <Ionicons name="search-outline" size={15} color={COLOR.textFaint} />
            <TextInput
              value={bankSearch}
              onChangeText={setBankSearch}
              placeholder="Search banks"
              placeholderTextColor={COLOR.textFaint}
              style={destStyles.searchInput}
            />
          </View>
          <ScrollView
            style={destStyles.bankScroll}
            contentContainerStyle={{ gap: 6 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {filteredBanks.slice(0, 30).map((bank) => {
              const sel = bank.code === selectedBankCode;
              return (
                <TouchableOpacity
                  key={bank.code + bank.name}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedBankCode(bank.code);
                    setResolved(undefined);
                  }}
                  style={[destStyles.bankChip, sel && destStyles.bankChipActive]}
                >
                  {sel && (
                    <Ionicons name="checkmark-circle" size={13} color={COLOR.forestMid} />
                  )}
                  <Text
                    style={[destStyles.bankChipText, sel && destStyles.bankChipTextActive]}
                    numberOfLines={1}
                  >
                    {bank.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {filteredBanks.length === 0 && (
              <Text style={destStyles.noBank}>No matching bank.</Text>
            )}
          </ScrollView>

          {/* Account number */}
          <Text style={destStyles.fieldLabel}>Account number</Text>
          <TextInput
            value={accountNumber}
            onChangeText={(v) => {
              setAccountNumber(v.replace(/[^0-9]/g, "").slice(0, 10));
              setResolved(undefined);
            }}
            keyboardType="number-pad"
            placeholder="10-digit account number"
            placeholderTextColor={COLOR.textFaint}
            style={destStyles.fieldInput}
            maxLength={10}
          />

          {/* Nickname */}
          <Text style={destStyles.fieldLabel}>Nickname (optional)</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g. Salary account"
            placeholderTextColor={COLOR.textFaint}
            style={destStyles.fieldInput}
          />

          {/* Resolved name */}
          {resolved && (
            <View style={destStyles.resolvedBox}>
              <Ionicons name="checkmark-circle" size={16} color={COLOR.forestMid} />
              <Text style={destStyles.resolvedName}>{resolved.account_name}</Text>
            </View>
          )}

          <View style={destStyles.formActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleResolve}
              disabled={isResolving}
              style={destStyles.secondaryBtn}
            >
              {isResolving ? (
                <ActivityIndicator size="small" color={COLOR.forestDeep} />
              ) : (
                <Text style={destStyles.secondaryBtnText}>Verify</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={!resolved || isSaving}
              style={[destStyles.primaryBtn, (!resolved || isSaving) && { opacity: 0.4 }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={destStyles.primaryBtnText}>Save account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Step 5: PIN + confirm (merged) ──────────────────────────────────────────

const StepReview = ({
  selectedPlan,
  selectedTarget,
  selectedDestination,
  amountInKobo,
  withdrawAll,
}: {
  selectedPlan?: Plan;
  selectedTarget?: WithdrawalTarget;
  selectedDestination?: DestinationSelection;
  amountInKobo: number;
  withdrawAll: boolean;
}) => (
  <View style={stepStyles.wrap}>
    <StepHeading
      title="Review withdrawal"
      sub="Check every detail before you approve this transfer."
    />

    <SummaryCard
      plan={selectedPlan}
      target={selectedTarget}
      destination={selectedDestination}
      amountInKobo={amountInKobo}
      withdrawAll={withdrawAll}
    />

    <View style={reviewStyles.card}>
      <ReviewRow
        label="From"
        value={selectedTarget?.label || "Selected source"}
        sub={
          selectedTarget?.type === "envelope"
            ? "Envelope unboxed balance"
            : "Plan unboxed balance"
        }
      />
      <ReviewRow
        label="To"
        value={selectedDestination?.label || "Selected destination"}
        sub={
          selectedDestination
            ? `${selectedDestination.bank} | ${maskAccountNumber(
              selectedDestination.accountNumber
            )}`
            : undefined
        }
      />
      <ReviewRow
        label="Timing"
        value="Processing starts immediately"
        sub="Final status is confirmed by Paystack."
      />
      <ReviewRow
        label="Reference"
        value="Generated after submission"
        sub="Use the reference for support if needed."
        last
      />
    </View>

    <View style={stepStyles.notice}>
      <Ionicons name="alert-circle-outline" size={14} color={COLOR.amber} />
      <Text style={stepStyles.noticeText}>
        Once submitted, this withdrawal cannot be reversed from the app.
      </Text>
    </View>
  </View>
);

const ReviewRow = ({
  label,
  value,
  sub,
  last,
}: {
  label: string;
  value: string;
  sub?: string;
  last?: boolean;
}) => (
  <View style={[reviewStyles.row, last && reviewStyles.rowLast]}>
    <Text style={reviewStyles.label}>{label}</Text>
    <View style={reviewStyles.copy}>
      <Text style={reviewStyles.value}>{value}</Text>
      {sub ? <Text style={reviewStyles.sub}>{sub}</Text> : null}
    </View>
  </View>
);

const reviewStyles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 14,
    overflow: "hidden",
  },
  row: {
    borderBottomColor: "#F0F4F2",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    width: 76,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  value: {
    color: COLOR.textBody,
    fontSize: 13,
    fontWeight: "900",
  },
  sub: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
});

const StepPin = ({
  selectedPlan,
  selectedTarget,
  selectedDestination,
  amountInKobo,
  withdrawAll,
  hasWithdrawalPin,
  isPinStatusLoading,
  pinMode,
  withdrawalPin,
  newWithdrawalPin,
  resetOtp,
  isSendingPinOtp,
  isResettingPin,
  onChangeWithdrawalPin,
  onChangeNewWithdrawalPin,
  onChangeResetOtp,
  onForgotPin,
  onResetPin,
  onCancelReset,
}: {
  selectedPlan?: Plan;
  selectedTarget?: WithdrawalTarget;
  selectedDestination?: DestinationSelection;
  amountInKobo: number;
  withdrawAll: boolean;
  hasWithdrawalPin: boolean;
  isPinStatusLoading: boolean;
  pinMode: "enter" | "reset";
  withdrawalPin: string;
  newWithdrawalPin: string;
  resetOtp: string;
  isSendingPinOtp: boolean;
  isResettingPin: boolean;
  onChangeWithdrawalPin: (v: string) => void;
  onChangeNewWithdrawalPin: (v: string) => void;
  onChangeResetOtp: (v: string) => void;
  onForgotPin: () => void;
  onResetPin: () => void;
  onCancelReset: () => void;
}) => {
  const cleanPin = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 4);
  const cleanOtp = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 6);
  const resetReady = resetOtp.length === 6 && newWithdrawalPin.length === 4;
  const activePin = hasWithdrawalPin ? withdrawalPin : newWithdrawalPin;

  return (
    <View style={stepStyles.wrap}>
      <StepHeading
        title="Review & approve"
        sub="Confirm the details, then enter your PIN to send."
      />

      {/* Summary */}
      <SummaryCard
        plan={selectedPlan}
        target={selectedTarget}
        destination={selectedDestination}
        amountInKobo={amountInKobo}
        withdrawAll={withdrawAll}
      />

      {/* PIN card */}
      <View style={pinStyles.card}>
        <View style={pinStyles.cardHeader}>
          <View style={pinStyles.cardIcon}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLOR.forestDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pinStyles.cardTitle}>
              {isPinStatusLoading
                ? "Checking security settings…"
                : hasWithdrawalPin
                  ? "Enter your PIN"
                  : "Create a withdrawal PIN"}
            </Text>
            <Text style={pinStyles.cardSub}>
              {!isPinStatusLoading && !hasWithdrawalPin
                ? "You'll use this 4-digit PIN for all future withdrawals."
                : "This PIN secures all your withdrawals."}
            </Text>
          </View>
        </View>

        {isPinStatusLoading ? (
          <LoadingState text="Checking PIN status…" />
        ) : pinMode === "reset" ? (
          <View style={pinStyles.form}>
            <View style={pinStyles.otpWrap}>
              <Text style={pinStyles.otpLabel}>Email OTP</Text>
              <TextInput
                value={resetOtp}
                onChangeText={(v) => onChangeResetOtp(cleanOtp(v))}
                keyboardType="number-pad"
                placeholder="6-digit code"
                placeholderTextColor={COLOR.textFaint}
                style={pinStyles.otpInput}
                maxLength={6}
              />
            </View>
            <Text style={pinStyles.newPinLabel}>New PIN</Text>
            <PinDots value={newWithdrawalPin} />
            <PinKeypad
              value={newWithdrawalPin}
              onChange={(v) => onChangeNewWithdrawalPin(cleanPin(v))}
            />
            <View style={pinStyles.actions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onCancelReset}
                style={pinStyles.secondaryBtn}
              >
                <Text style={pinStyles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onResetPin}
                disabled={!resetReady || isResettingPin}
                style={[pinStyles.primaryBtn, (!resetReady || isResettingPin) && { opacity: 0.4 }]}
              >
                {isResettingPin ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={pinStyles.primaryBtnText}>Reset PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={pinStyles.form}>
            <PinDots value={activePin} />
            <PinKeypad
              value={activePin}
              onChange={(v) =>
                hasWithdrawalPin
                  ? onChangeWithdrawalPin(cleanPin(v))
                  : onChangeNewWithdrawalPin(cleanPin(v))
              }
            />
            {hasWithdrawalPin && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onForgotPin}
                disabled={isSendingPinOtp}
                style={pinStyles.forgotBtn}
              >
                <Text style={pinStyles.forgotBtnText}>
                  {isSendingPinOtp ? "Sending OTP…" : "Forgot PIN?"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Warning notice */}
      <View style={stepStyles.notice}>
        <Ionicons name="alert-circle-outline" size={14} color={COLOR.amber} />
        <Text style={stepStyles.noticeText}>
          Withdrawals are processed immediately and cannot be reversed.
        </Text>
      </View>
    </View>
  );
};

// ─── PIN sub-components ───────────────────────────────────────────────────────

// Standard phone keypad order: 1 2 3 / 4 5 6 / 7 8 9 / _ 0 ⌫
const PIN_ROWS = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]];

const PinDots = ({ value }: { value: string }) => (
  <View style={pinStyles.dots}>
    {[0, 1, 2, 3].map((i) => (
      <View key={i} style={[pinStyles.dot, value.length > i && pinStyles.dotFilled]} />
    ))}
  </View>
);

const PinKeypad = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <View style={pinStyles.keypad}>
    {PIN_ROWS.map((row, ri) => (
      <View key={ri} style={pinStyles.keyRow}>
        {row.map((key) => (
          <TouchableOpacity
            key={key}
            activeOpacity={0.75}
            onPress={() => {
              if (value.length < 4) onChange(`${value}${key}`);
            }}
            style={pinStyles.key}
          >
            <Text style={pinStyles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ))}
    {/* Bottom row: empty / 0 / backspace */}
    <View style={pinStyles.keyRow}>
      <View style={pinStyles.keyGhost} />
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          if (value.length < 4) onChange(`${value}0`);
        }}
        style={pinStyles.key}
      >
        <Text style={pinStyles.keyText}>0</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onChange(value.slice(0, -1))}
        style={pinStyles.key}
      >
        <Ionicons name="backspace-outline" size={22} color={COLOR.forestDeep} />
      </TouchableOpacity>
    </View>
  </View>
);

// ─── Processing overlay (inline, not nested modal) ────────────────────────────

const ProcessingOverlay = ({
  state,
  amount,
  receipt,
  onDone,
}: {
  state: "processing" | "success";
  amount: string;
  receipt: WithdrawalReceipt | null;
  onDone: () => void;
}) => (
  <View style={overlayStyles.wrap}>
    <View style={overlayStyles.card}>
      {state === "success" ? (
        <View style={overlayStyles.successIcon}>
          <Ionicons name="checkmark" size={30} color="#FFF" />
        </View>
      ) : (
        <View style={overlayStyles.spinnerWrap}>
          <ActivityIndicator color={COLOR.forestDeep} size="large" />
        </View>
      )}
      <Text style={overlayStyles.title}>
        {state === "success" ? "Withdrawal sent!" : "Sending withdrawal…"}
      </Text>
      <Text style={overlayStyles.sub}>
        {state === "success"
          ? `${amount} is now being processed by Paystack.`
          : "Keep this screen open while we process your request."}
      </Text>
      {state === "success" && receipt ? (
        <View style={overlayStyles.receiptBox}>
          <View style={overlayStyles.receiptRow}>
            <Text style={overlayStyles.receiptLabel}>Reference</Text>
            <Text style={overlayStyles.receiptValue} numberOfLines={1}>
              {receipt.reference}
            </Text>
          </View>
          <View style={overlayStyles.receiptRow}>
            <Text style={overlayStyles.receiptLabel}>Status</Text>
            <Text style={overlayStyles.receiptValue}>
              {receipt.status}
            </Text>
          </View>
          <View style={overlayStyles.receiptRow}>
            <Text style={overlayStyles.receiptLabel}>To</Text>
            <Text style={overlayStyles.receiptValue} numberOfLines={1}>
              {receipt.destination}
            </Text>
          </View>
        </View>
      ) : null}
      {state === "success" && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onDone}
          style={overlayStyles.doneBtn}
        >
          <Text style={overlayStyles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// ─── Step heading helper ──────────────────────────────────────────────────────

const StepHeading = ({ title, sub }: { title: string; sub: string }) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={stepStyles.heading}>{title}</Text>
    <Text style={stepStyles.sub}>{sub}</Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const stepStyles = StyleSheet.create({
  wrap: { gap: 0 },
  list: { gap: 10 },
  heading: {
    fontSize: 24,
    fontWeight: "900",
    color: COLOR.forestDeep,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    fontWeight: "600",
    color: COLOR.textMuted,
    lineHeight: 19,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: COLOR.amberBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.amberBorder,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: COLOR.amber,
    lineHeight: 18,
  },
});

const amountStyles = StyleSheet.create({
  availableChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: COLOR.forestLight,
    borderWidth: 1,
    borderColor: COLOR.forestBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  availableLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLOR.forestMuted,
  },
  availableValue: {
    fontSize: 12,
    fontWeight: "900",
    color: COLOR.forestDeep,
  },
  inputWrap: {
    height: 84,
    borderRadius: 20,
    backgroundColor: COLOR.bgSubtle,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  inputWrapMuted: {
    backgroundColor: COLOR.forestLight,
    borderColor: COLOR.forestBorder,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: "900",
    color: `${COLOR.forestDeep}33`,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 38,
    fontWeight: "900",
    color: COLOR.forestDeep,
    letterSpacing: -1.2,
    paddingVertical: 0,
  },
  inputMuted: {
    color: COLOR.forestMid,
  },
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  allRowActive: {
    borderColor: COLOR.forestDeep,
    backgroundColor: "#F4FAF7",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: COLOR.forestDeep,
    borderColor: COLOR.forestDeep,
  },
  allLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: COLOR.textMuted,
  },
  allLabelActive: {
    color: COLOR.forestDeep,
    fontWeight: "800",
  },
  allAmount: {
    fontSize: 13,
    fontWeight: "900",
    color: COLOR.forestMid,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLOR.forestLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.forestBorder,
    padding: 12,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLOR.forestMid,
    lineHeight: 19,
  },
});

const destStyles = StyleSheet.create({
  searchRow: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 0,
  },
  addToggle: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    borderStyle: "dashed",
    backgroundColor: COLOR.surface,
    paddingVertical: 13,
  },
  addToggleIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: COLOR.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },
  addToggleText: {
    color: COLOR.forestDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  form: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    padding: 16,
    gap: 12,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: COLOR.bgSubtle,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segItemActive: {
    backgroundColor: COLOR.forestDeep,
  },
  segText: {
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  segTextActive: {
    color: "#FFF",
  },
  fieldLabel: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: -6,
  },
  bankScroll: {
    maxHeight: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSubtle,
    padding: 8,
  },
  bankChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bankChipActive: {
    borderColor: COLOR.forestMid,
    backgroundColor: COLOR.forestLight,
  },
  bankChipText: {
    color: COLOR.textMuted,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  bankChipTextActive: {
    color: COLOR.forestDeep,
    fontWeight: "800",
  },
  noBank: {
    color: COLOR.textFaint,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 12,
  },
  fieldInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSubtle,
    color: COLOR.textBody,
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 14,
  },
  resolvedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.forestBorder,
    backgroundColor: COLOR.forestLight,
    padding: 12,
  },
  resolvedName: {
    color: COLOR.forestMid,
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLOR.bgSubtle,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: COLOR.forestDeep,
    fontSize: 13,
    fontWeight: "900",
  },
  primaryBtn: {
    flex: 2,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLOR.forestMid,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "900",
  },
});

const pinStyles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    padding: 16,
    gap: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLOR.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 3,
  },
  cardSub: {
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  form: {
    gap: 12,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 6,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
  },
  dotFilled: {
    backgroundColor: COLOR.forestDeep,
    borderColor: COLOR.forestDeep,
  },
  keypad: {
    gap: 10,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  key: {
    width: 90,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  keyGhost: {
    width: 90,
    height: 56,
  },
  keyText: {
    color: COLOR.forestDeep,
    fontSize: 22,
    fontWeight: "900",
  },
  otpWrap: {
    gap: 6,
  },
  otpLabel: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  otpInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSubtle,
    color: COLOR.textBody,
    fontSize: 16,
    fontWeight: "900",
    paddingHorizontal: 14,
    letterSpacing: 4,
  },
  newPinLabel: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLOR.bgSubtle,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: COLOR.forestDeep,
    fontSize: 13,
    fontWeight: "900",
  },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLOR.forestMid,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "900",
  },
  forgotBtn: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  forgotBtnText: {
    color: COLOR.forestMid,
    fontSize: 13,
    fontWeight: "900",
  },
});

const overlayStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,20,16,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: COLOR.surface,
    padding: 28,
    alignItems: "center",
    gap: 14,
  },
  spinnerWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLOR.forestMid,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLOR.textBody,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  sub: {
    color: COLOR.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },
  receiptBox: {
    alignSelf: "stretch",
    backgroundColor: COLOR.bgSubtle,
    borderColor: COLOR.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  receiptRow: {
    borderBottomColor: COLOR.border,
    borderBottomWidth: 1,
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  receiptLabel: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  receiptValue: {
    color: COLOR.textBody,
    fontSize: 12,
    fontWeight: "900",
  },
  doneBtn: {
    alignSelf: "stretch",
    height: 50,
    borderRadius: 16,
    backgroundColor: COLOR.forestDeep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  doneBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900",
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "94%",
    backgroundColor: COLOR.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLOR.border,
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLOR.surface,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: COLOR.textBody,
    letterSpacing: -0.2,
  },
  content: {
    paddingBottom: 16,
    gap: 0,
  },
  cta: {
    height: 56,
    borderRadius: 18,
    backgroundColor: COLOR.forestDeep,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    shadowColor: COLOR.forestDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaDisabled: {
    opacity: 0.38,
  },
  ctaText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900",
  },
});

export default WithdrawalModal;
