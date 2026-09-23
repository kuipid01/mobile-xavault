import { Bank, BankAccount, CreateBankAccountPayload, ResolveAccountResponse } from "@/api/banking";
import { formatMoney, koboToNaira, nairaToKobo } from "@/api/money";
import { Envelope, Plan } from "@/api/types";
import { getWithdrawal, WithdrawalPreview } from "@/api/withdrawals";
import { ErrorModal } from "@/components/ui/ErrorModal";
import {
  useBankAccounts,
  useBanks,
  useBeneficiaries,
  useCreateBankAccount,
  useCreateBeneficiary,
  useResolveBankAccount
} from "@/hooks/app/banking";
import { envelopeKeys, useEnvelopes } from "@/hooks/app/envelopes";
import { planKeys, usePlans } from "@/hooks/app/plans";
import { walletKeys } from "@/hooks/app/wallet";
import {
  useForgotWithdrawalPin,
  useResetWithdrawalPin,
  useSetWithdrawalPin,
  useWithdrawalPinStatus
} from "@/hooks/app/withdrawal-pin";
import { usePreviewWithdrawal, useRequestWithdrawal, withdrawalKeys } from "@/hooks/app/withdrawals";
import { trackEvent } from "@/lib/analytics";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
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
  View
} from "react-native";
import Toast from "react-native-toast-message";

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
  textFaint: "#9EAAA5"
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onCompleted?: () => void | Promise<void>;
};

type WithdrawalTarget =
  | { type: "plan"; id: string; label: string; balance: number; reason: string }
  | { type: "envelope"; id: string; label: string; balance: number; reason: string; envelope: Envelope };

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

type WithdrawalProcessingState = "submitting" | "processing" | "completed" | "failed";

const WITHDRAWAL_POLL_INTERVAL_MS = 2000;
const WITHDRAWAL_POLL_ATTEMPTS = 30;

const normalizeWithdrawalState = (status?: string): WithdrawalProcessingState => {
  const normalized = String(status || "processing").toLowerCase();
  if (["paid", "success", "successful", "completed"].includes(normalized)) return "completed";
  if (["failed", "reversed", "cancelled", "canceled", "rejected"].includes(normalized)) {
    return "failed";
  }
  return "processing";
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isDateReached = (date?: string | null) => {
  if (!date) return false;
  const parsed = new Date(date);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now();
};

const isPlanMatured = (plan: Plan) =>
  plan.status === "expired" || plan.status === "completed" || isDateReached(plan.end_date);

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
    reason: matured ? "Reached end date" : "Flexible"
  };
};

// A plan only belongs in the withdrawal picker if it can still pay out:
// it must be live (not draft/cancelled) and have funds left anywhere in it
// (unallocated or inside envelopes). Fully withdrawn plans are excluded.
const isWithdrawablePlan = (plan: Plan): boolean => {
  if (!["active", "expired", "completed"].includes(plan.status)) return false;
  const paid = plan.withdrawn_amount ?? 0;
  const pending = plan.pending_withdrawal_amount ?? 0;
  const remaining = plan.remaining_balance ?? Math.max(plan.amount - paid - pending, 0);
  return remaining > 0;
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
    envelope
  };
};

const maskAccountNumber = (value: string) => (value.length > 4 ? `••${value.slice(-4)}` : value);

const formatQuoteExpiry = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  const minutes = Math.ceil((date.getTime() - Date.now()) / 60000);
  return minutes > 0 ? `Quote expires in ${minutes} minutes` : "Quote expired";
};

const quoteAmount = (value?: number | null) =>
  value == null ? "—" : formatMoney(value);

const mapDestination = (
  account: BankAccount,
  type: DestinationSelection["type"]
): DestinationSelection => ({
  type,
  id: account.id,
  label: account.nickname || account.account_name,
  bank: account.bank_name,
  accountNumber: account.account_number
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
  pin: "PIN"
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
      friction: 10
    }).start();
  }, [currentIdx, progress]);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  });

  return (
    <View style={progressStyles.wrap}>
      <View style={progressStyles.track}>
        <Animated.View style={[progressStyles.fill, { width: barWidth }]} />
      </View>
      <View style={progressStyles.labelRow}>
        <Text style={progressStyles.stepName}>{STEP_LABELS[current]}</Text>
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
    gap: 8
  },
  track: {
    height: 3,
    borderRadius: 99,
    backgroundColor: COLOR.border,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: COLOR.forestMid
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  stepName: {
    fontSize: 12,
    fontWeight: "800",
    color: COLOR.forestMid,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  stepCount: {
    fontSize: 11,
    fontWeight: "700",
    color: COLOR.textFaint
  }
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
  onPress
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
          <Text style={[rowStyles.tagText, selected && rowStyles.tagTextSelected]}>{tag}</Text>
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
    padding: 14
  },
  rowSelected: {
    borderColor: COLOR.forestDeep,
    backgroundColor: "#F4FAF7"
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center"
  },
  iconSelected: {
    backgroundColor: COLOR.forestDeep
  },
  body: { flex: 1, gap: 3 },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: COLOR.textBody
  },
  titleSelected: {
    color: COLOR.forestDeep
  },
  meta: {
    fontSize: 12,
    fontWeight: "600",
    color: COLOR.textFaint
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLOR.bgSubtle,
    marginTop: 2
  },
  tagSelected: {
    backgroundColor: COLOR.forestLight
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLOR.textMuted,
    textTransform: "capitalize"
  },
  tagTextSelected: {
    color: COLOR.forestMid
  },
  balance: {
    fontSize: 13,
    fontWeight: "900",
    color: COLOR.textBody,
    marginTop: 2
  },
  balanceSelected: {
    color: COLOR.forestMid
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center"
  },
  radioSelected: {
    borderColor: COLOR.forestDeep
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLOR.forestDeep
  }
});

// ─── Loading / Empty states ───────────────────────────────────────────────────

const LoadingState = ({ text }: { text: string }) => (
  <View accessibilityLabel={text} style={stateStyles.skeletonWrap}>
    {[0, 1, 2].map((item) => (
      <View key={item} style={stateStyles.skeletonRow}>
        <View style={stateStyles.skeletonIcon} />
        <View style={stateStyles.skeletonCopy}>
          <View style={stateStyles.skeletonLine} />
          <View style={stateStyles.skeletonLineSm} />
        </View>
        <View style={stateStyles.skeletonPill} />
      </View>
    ))}
  </View>
);

const EmptyState = ({
  icon,
  title,
  subtitle
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

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <View style={stateStyles.emptyCard}>
    <View style={stateStyles.emptyIcon}>
      <Ionicons name="cloud-offline-outline" size={22} color={COLOR.amber} />
    </View>
    <Text style={stateStyles.emptyTitle}>Could not load this step</Text>
    <Text style={stateStyles.emptySub}>Check your connection and try again.</Text>
    <TouchableOpacity onPress={onRetry} style={stateStyles.retryButton} activeOpacity={0.8}>
      <Text style={stateStyles.retryText}>Try again</Text>
    </TouchableOpacity>
  </View>
);

const stateStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
    justifyContent: "center"
  },
  text: {
    color: COLOR.textFaint,
    fontSize: 13,
    fontWeight: "600"
  },
  skeletonWrap: {
    gap: 10,
    paddingVertical: 8
  },
  skeletonRow: {
    alignItems: "center",
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  skeletonIcon: {
    backgroundColor: "#E5ECE8",
    borderRadius: 18,
    height: 36,
    width: 36
  },
  skeletonCopy: {
    flex: 1,
    gap: 7
  },
  skeletonLine: {
    backgroundColor: "#E5ECE8",
    borderRadius: 6,
    height: 12,
    width: "64%"
  },
  skeletonLineSm: {
    backgroundColor: "#E5ECE8",
    borderRadius: 5,
    height: 10,
    width: "42%"
  },
  skeletonPill: {
    backgroundColor: "#E5ECE8",
    borderRadius: 999,
    height: 22,
    width: 58
  },
  emptyCard: {
    backgroundColor: COLOR.bgSubtle,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 28,
    alignItems: "center",
    gap: 8
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
    marginBottom: 4
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLOR.textBody
  },
  emptySub: {
    fontSize: 12,
    fontWeight: "600",
    color: COLOR.textFaint,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 240
  },
  retryButton: {
    backgroundColor: COLOR.forestLight,
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryText: {
    color: COLOR.forestDeep,
    fontSize: 12,
    fontWeight: "800",
  }
});

// ─── Summary card (reused in PIN + Confirm steps) ─────────────────────────────

const SummaryCard = ({
  plan,
  target,
  destination,
  amountInKobo,
  withdrawAll,
  compact = false
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
      <Text style={summaryStyles.amountValue}>{formatMoney(amountInKobo, plan?.currency)}</Text>
      {withdrawAll && (
        <View style={summaryStyles.badge}>
          <Ionicons name="checkmark-circle" size={11} color={COLOR.forestMid} />
          <Text style={summaryStyles.badgeText}>Full balance</Text>
        </View>
      )}
    </View>
    <View style={summaryStyles.divider} />
    <View style={summaryStyles.rows}>
      {!compact && <SummaryRow label="Plan" value={plan?.name} icon="layers-outline" />}
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
  last
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
    marginBottom: 16
  },
  amountBlock: {
    padding: 20,
    gap: 6,
    backgroundColor: COLOR.forestLight
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLOR.forestMid,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  amountValue: {
    fontSize: 32,
    fontWeight: "900",
    color: COLOR.forestDeep,
    letterSpacing: -1
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
    marginTop: 2
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLOR.forestMid
  },
  divider: {
    height: 1,
    backgroundColor: COLOR.border
  },
  rows: {},
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F2"
  },
  detailRowLast: {
    borderBottomWidth: 0
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: COLOR.forestLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  detailContent: {
    flex: 1,
    gap: 2
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLOR.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "800",
    color: COLOR.textBody
  },
  detailSub: {
    fontSize: 11,
    fontWeight: "600",
    color: COLOR.textMuted
  }
});

// ─── Main modal ───────────────────────────────────────────────────────────────

const WithdrawalModal = ({ visible, onClose, onCompleted }: Props) => {
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [selectedTargetId, setSelectedTargetId] = useState<string>();
  const [amount, setAmount] = useState("");
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [isCalculatingFullAmount, setIsCalculatingFullAmount] = useState(false);
  const [selectedDestinationKey, setSelectedDestinationKey] = useState<string>();
  const [withdrawalPin, setWithdrawalPin] = useState("");
  const [newWithdrawalPin, setNewWithdrawalPin] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [pinMode, setPinMode] = useState<"enter" | "reset">("enter");
  const [withdrawalAttemptKey, setWithdrawalAttemptKey] = useState(createWithdrawalAttemptKey);
  const [processingState, setProcessingState] = useState<WithdrawalProcessingState>();
  const [withdrawalReceipt, setWithdrawalReceipt] = useState<WithdrawalReceipt | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [withdrawalQuote, setWithdrawalQuote] = useState<WithdrawalPreview>();
  const [modalError, setModalError] = useState<{
    title: string;
    message: string;
    supportReference?: string;
  } | null>(null);
  const withdrawalPollSession = useRef(0);
  const confirmingRef = useRef(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const queryClient = useQueryClient();

  const refreshWithdrawalData = async (planId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: withdrawalKeys.history }),
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet }),
      queryClient.invalidateQueries({ queryKey: walletKeys.ledger }),
      queryClient.invalidateQueries({ queryKey: planKeys.list() }),
      ...(planId
        ? [
          queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) }),
          queryClient.invalidateQueries({ queryKey: envelopeKeys.list(planId), exact: true }),
          queryClient.invalidateQueries({ queryKey: withdrawalKeys.plan(planId) }),
        ]
        : []),
    ]);
  };

  const showError = (title: string, error: any, fallback: string) => {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      fallback;
    const supportReference =
      error?.response?.data?.support_reference ||
      error?.response?.headers?.["x-support-reference"];
    setModalError({
      title,
      message: String(message),
      supportReference: supportReference ? String(supportReference) : undefined,
    });
  };

  const {
    data: plansData,
    isLoading: isPlansLoading,
    error: plansError,
    refetch: refetchPlans,
  } = usePlans();
  const plans = useMemo(() => plansData?.items || [], [plansData?.items]);
  const withdrawablePlans = useMemo(() => plans.filter(isWithdrawablePlan), [plans]);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const {
    data: envelopes = [],
    isLoading: isEnvelopesLoading,
    error: envelopesError,
    refetch: refetchEnvelopes
  } = useEnvelopes(selectedPlanId);
  const { data: banks = [], isLoading: isBanksLoading, error: banksError, refetch: refetchBanks } = useBanks();
  const { data: bankAccounts = [], isLoading: isAccountsLoading, error: accountsError, refetch: refetchAccounts } = useBankAccounts();
  const { data: beneficiaries = [], isLoading: isBeneficiariesLoading, error: beneficiariesError, refetch: refetchBeneficiaries } = useBeneficiaries();
  const { mutateAsync: resolveAccount, isPending: isResolvingAccount } = useResolveBankAccount();
  const { mutateAsync: createBankAccount, isPending: isCreatingAccount } = useCreateBankAccount();
  const { mutateAsync: createBeneficiary, isPending: isCreatingBeneficiary } =
    useCreateBeneficiary();
  const { mutateAsync: requestWithdrawal, isPending: isWithdrawing } = useRequestWithdrawal();
  const { mutateAsync: previewWithdrawal, isPending: isPreviewing } = usePreviewWithdrawal();
  const { data: pinStatus, isLoading: isPinStatusLoading } = useWithdrawalPinStatus();
  const { mutateAsync: saveWithdrawalPin, isPending: isSettingPin } = useSetWithdrawalPin();
  const { mutateAsync: forgotWithdrawalPin, isPending: isSendingPinOtp } = useForgotWithdrawalPin();
  const { mutateAsync: resetWithdrawalPin, isPending: isResettingPin } = useResetWithdrawalPin();

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
      ...beneficiaries.map((account) => mapDestination(account, "beneficiary"))
    ],
    [bankAccounts, beneficiaries]
  );
  const selectedDestination = destinationOptions.find(
    (d) => `${d.type}:${d.id}` === selectedDestinationKey
  );
  const amountInKobo = nairaToKobo(amount);
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
    !isPreviewing &&
    !isConfirming &&
    !processingState;

  useEffect(() => {
    if (!visible) return;
    void refetchPlans();
    if (selectedPlanId) void refetchEnvelopes();
  }, [refetchEnvelopes, refetchPlans, selectedPlanId, visible]);

  // Auto-select first plan
  useEffect(() => {
    if (visible && !selectedPlanId && withdrawablePlans[0]) {
      setSelectedPlanId(withdrawablePlans[0].id);
    }
  }, [withdrawablePlans, selectedPlanId, visible]);

  // Auto-select first eligible target when plan changes
  useEffect(() => {
    setSelectedTargetId(targetOptions[0]?.id);
  }, [selectedPlanId, targetOptions]);

  const resetAndClose = () => {
    withdrawalPollSession.current += 1;
    setStep("plan");
    setAmount("");
    setWithdrawalQuote(undefined);
    setWithdrawAll(false);
    setSelectedPlanId(undefined);
    setSelectedTargetId(undefined);
    setSelectedDestinationKey(undefined);
    setWithdrawalPin("");
    setNewWithdrawalPin("");
    setPinError(null);
    setResetOtp("");
    setPinMode("enter");
    setWithdrawalAttemptKey(createWithdrawalAttemptKey());
    setProcessingState(undefined);
    setPollTimedOut(false);
    confirmingRef.current = false;
    setIsConfirming(false);
    setWithdrawalReceipt(null);
    setModalError(null);
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
    if (processingState === "submitting" || isWithdrawing || isSettingPin) {
      showBottomToast({
        type: "info",
        text1: "Withdrawal in progress",
        text2: "Please wait while we finish this request."
      });
      return;
    }

    if (!hasDismissibleProgress) {
      resetAndClose();
      return;
    }

    trackEvent("withdrawal_abandoned", {
      amount: amountInKobo,
      step
    });
    Alert.alert(
      "Discard withdrawal?",
      "You have started a withdrawal. Closing now will clear this request.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: resetAndClose }
      ]
    );
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
    else requestClose();
  };

  const buildPreviewPayload = () => {
    if (!selectedTarget) return null;
    return {
      source_type:
        selectedTarget.type === "plan" ? ("plan_unboxed" as const) : ("envelope" as const),
      envelope_id: selectedTarget.type === "envelope" ? selectedTarget.id : undefined,
      amount: amountInKobo
    };
  };

  const handleWithdrawAll = async () => {
    if (withdrawAll) {
      setWithdrawAll(false);
      setAmount("");
      setWithdrawalQuote(undefined);
      return;
    }
    if (!selectedPlan || !selectedTarget || selectedTarget.balance <= 0) return;

    setIsCalculatingFullAmount(true);
    setWithdrawalQuote(undefined);
    try {
      let candidate = selectedTarget.balance - (selectedTarget.balance % 100);
      let lowestWorkingAmount = 0;
      let highestPossibleAmount = candidate;
      let finalQuote: WithdrawalPreview | undefined;

      for (let attempt = 0; attempt < 12 && candidate > 0; attempt += 1) {
        const quote = await previewWithdrawal({
          planId: selectedPlan.id,
          payload: {
            source_type:
              selectedTarget.type === "plan" ? "plan_unboxed" : "envelope",
            envelope_id: selectedTarget.type === "envelope" ? selectedTarget.id : undefined,
            amount: candidate,
          },
        });
        if (!quote) throw new Error("The server did not return a withdrawal quote.");

        if (quote.can_withdraw && quote.total_deduction <= selectedTarget.balance) {
          finalQuote = quote;
          lowestWorkingAmount = candidate;
          if (candidate >= highestPossibleAmount) break;
          candidate = Math.floor((candidate + highestPossibleAmount + 100) / 200) * 100;
          continue;
        }

        highestPossibleAmount = candidate - 100;
        if (highestPossibleAmount <= lowestWorkingAmount) break;
        if (lowestWorkingAmount === 0) {
          const excess = Math.max(quote.total_deduction - selectedTarget.balance, 100);
          candidate = Math.floor((candidate - excess) / 100) * 100;
        } else {
          candidate = Math.floor((lowestWorkingAmount + highestPossibleAmount + 100) / 200) * 100;
        }
      }

      candidate = lowestWorkingAmount;
      if (!finalQuote || !finalQuote.can_withdraw || candidate <= 0) {
        throw new Error(finalQuote?.validation_errors?.[0] || "No withdrawable amount is available.");
      }

      setAmount(String(candidate / 100));
      setWithdrawalQuote(finalQuote);
      setWithdrawAll(true);
    } catch (error: any) {
      showError("Could not calculate full withdrawal", error, "Enter a smaller amount and try again.");
    } finally {
      setIsCalculatingFullAmount(false);
    }
  };

  const handleContinue = async () => {
    if (step === "plan") {
      if (!selectedPlanId) {
        showBottomToast({ type: "error", text1: "Select a plan to continue." });
        return;
      }
      setStep("source");
    } else if (step === "source") {
      if (!selectedTargetId) {
        showBottomToast({
          type: "error",
          text1: "Select a withdrawal source."
        });
        return;
      }
      trackEvent("withdrawal_source_selected", {
        source_type: selectedTarget?.type || null,
        source_id: selectedTargetId
      });
      setStep("amount");
    } else if (step === "amount") {
      if (!amountIsValid) {
        showBottomToast({
          type: "error",
          text1: "Invalid withdrawal amount",
          text2: `You can withdraw up to ${formatMoney(selectedTarget?.balance || 0)} from this plan.`
        });
        return;
      }
      const previewPayload = buildPreviewPayload();
      if (!previewPayload || !selectedPlan) return;
      try {
        const preview = await previewWithdrawal({
          planId: selectedPlan.id,
          payload: previewPayload
        });
        if (!preview?.can_withdraw) {
          setModalError({
            title: "Balance is no longer available",
            message: preview?.validation_errors?.[0] || "Refresh and choose another amount."
          });
          return;
        }
        setWithdrawalQuote(preview);
        setStep("destination");
      } catch (error: any) {
        showError("Could not verify this balance", error, "Please try again.");
      }
    } else if (step === "destination") {
      if (!selectedDestination) {
        showBottomToast({
          type: "error",
          text1: "Select a destination account."
        });
        return;
      }
      trackEvent("withdrawal_destination_selected", {
        destination_type: selectedDestination.type
      });
      setStep("review");
    } else if (step === "review") {
      trackEvent("withdrawal_reviewed", {
        amount: amountInKobo,
        source_type: selectedTarget?.type || null
      });
      setStep("pin");
    } else if (step === "pin") {
      void handleConfirm();
    }
  };

  const handleConfirm = async () => {
    if (
      confirmingRef.current ||
      !canConfirm ||
      !selectedPlan ||
      !selectedTarget ||
      !selectedDestination
    ) return;

    confirmingRef.current = true;
    setIsConfirming(true);
    setPollTimedOut(false);

    const previewPayload = buildPreviewPayload();
    if (!previewPayload) {
      confirmingRef.current = false;
      setIsConfirming(false);
      return;
    }
    let confirmedQuote = withdrawalQuote;
    try {
      const latest = await previewWithdrawal({
        planId: selectedPlan.id,
        payload: previewPayload
      });
      if (!latest?.can_withdraw) {
        setStep("amount");
        setModalError({
          title: "Balance changed",
          message: latest?.validation_errors?.[0] || "Review the available amount and try again."
        });
        confirmingRef.current = false;
        setIsConfirming(false);
        return;
      }
      setWithdrawalQuote(latest);
      confirmedQuote = latest;
    } catch (error: any) {
      showError("Could not verify this balance", error, "Please try again.");
      confirmingRef.current = false;
      setIsConfirming(false);
      return;
    }

    // If user doesn't have a PIN yet, save it first
    if (!hasWithdrawalPin) {
      try {
        await saveWithdrawalPin(newWithdrawalPin);
        setWithdrawalPin(newWithdrawalPin);
      } catch (error: any) {
        showError("Could not save PIN", error, "Please try again.");
        confirmingRef.current = false;
        setIsConfirming(false);
        return;
      }
    }

    const payload = {
      quote_id: confirmedQuote?.quote_id || "",
      source_type:
        selectedTarget.type === "plan" ? ("plan_unboxed" as const) : ("envelope" as const),
      envelope_id: selectedTarget.type === "envelope" ? selectedTarget.id : undefined,
      amount: amountInKobo,
      destination_type: selectedDestination.type,
      destination_id: selectedDestination.id,
      withdrawal_pin: pinToSubmit,
      idempotency_key: withdrawalAttemptKey
    };

    try {
      setProcessingState("submitting");
      trackEvent("withdrawal_pin_entered", {
        amount: amountInKobo,
        source_type: selectedTarget.type
      });
      const response = await requestWithdrawal({
        planId: selectedPlan.id,
        payload
      });
      const reference =
        response?.withdrawal?.reference || response?.paystack?.reference || withdrawalAttemptKey;

      setWithdrawalReceipt({
        reference,
        amount: response?.withdrawal?.amount || amountInKobo,
        status: response?.withdrawal?.status || "processing",
        destination: `${selectedDestination.bank} ${maskAccountNumber(
          selectedDestination.accountNumber
        )}`
      });
      const initialState = normalizeWithdrawalState(response?.withdrawal?.status);
      setProcessingState(initialState);

      if (initialState === "completed") {
        trackEvent("withdrawal_completed", {
          amount: response?.withdrawal?.amount || amountInKobo,
          reference,
          status: response?.withdrawal?.status || "paid"
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshWithdrawalData(selectedPlan.id);
        try {
          await onCompleted?.();
        } catch {
          // The withdrawal is complete even if a secondary UI refresh fails.
        }
        confirmingRef.current = false;
        setIsConfirming(false);
        return;
      }

      const withdrawalId = response?.withdrawal?.id;
      if (!withdrawalId || initialState === "failed") {
        await refreshWithdrawalData(selectedPlan.id);
        confirmingRef.current = false;
        setIsConfirming(false);
        return;
      }
      const pollSession = ++withdrawalPollSession.current;
      let reachedTerminal = false;

      for (let attempt = 0; attempt < WITHDRAWAL_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, WITHDRAWAL_POLL_INTERVAL_MS));
        if (withdrawalPollSession.current !== pollSession) {
          confirmingRef.current = false;
          setIsConfirming(false);
          return;
        }
        let current;
        try {
          current = await getWithdrawal(withdrawalId);
        } catch {
          // A temporary network error must not turn an accepted transfer into a failed one.
          continue;
        }
        const currentState = normalizeWithdrawalState(current?.status);
        setWithdrawalReceipt((receipt) =>
          receipt ? { ...receipt, status: current?.status || receipt.status } : receipt
        );
        setProcessingState(currentState);

        if (currentState === "completed") {
          reachedTerminal = true;
          trackEvent("withdrawal_completed", {
            amount: current?.amount || amountInKobo,
            reference: current?.reference || reference,
            status: current?.status || "paid"
          });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await refreshWithdrawalData(selectedPlan.id);
          try {
            await onCompleted?.();
          } catch {
            // The withdrawal is complete even if a secondary UI refresh fails.
          }
          confirmingRef.current = false;
          setIsConfirming(false);
          break;
        }
        if (currentState === "failed") {
          reachedTerminal = true;
          trackEvent("withdrawal_failed", {
            amount: current?.amount || amountInKobo,
            reference: current?.reference || reference,
            status: current?.status || "failed"
          });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          await refreshWithdrawalData(selectedPlan.id);
          confirmingRef.current = false;
          setIsConfirming(false);
          break;
        }
      }
      if (!reachedTerminal) {
        setPollTimedOut(true);
        await refreshWithdrawalData(selectedPlan.id);
      }
      confirmingRef.current = false;
      setIsConfirming(false);
    } catch (error: any) {
      confirmingRef.current = false;
      setIsConfirming(false);
      setProcessingState(undefined);
      setWithdrawalAttemptKey(createWithdrawalAttemptKey());
      trackEvent("withdrawal_failed", {
        amount: amountInKobo,
        error: error?.response?.data?.message || error?.message || "unknown"
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const status = error?.response?.status;
      const errorMessage = String(
        error?.response?.data?.message || error?.response?.data?.error?.message || ""
      ).toLowerCase();

      // PIN problems have dedicated statuses (422 wrong PIN, 423 locked).
      // A bare 401 here is a real auth failure — do NOT treat it as a PIN
      // error; the interceptor already retried once after token refresh.
      const isPinLocked = status === 423 || errorMessage.includes("locked after three");
      const isInvalidPin = status === 422 || errorMessage.includes("incorrect withdrawal pin");

      if (isPinLocked) {
        setWithdrawalPin("");
        setPinError("Withdrawals are locked after 3 incorrect attempts. Use “Forgot PIN?” to reset.");
      } else if (isInvalidPin) {
        setWithdrawalPin("");
        setPinError("Incorrect PIN. Enter your 4-digit withdrawal PIN and try again.");
      } else {
        setWithdrawalPin("");
        showError("Withdrawal failed", error, "Please try again.");
      }
    }
  };

  const isCTADisabled =
    (step === "plan" && !selectedPlanId) ||
    (step === "source" && !selectedTargetId) ||
    isPreviewing ||
    (step === "amount" && !amountIsValid) ||
    (step === "destination" && !selectedDestination) ||
    (step === "review" && (!selectedDestination || !amountIsValid)) ||
    (step === "pin" && (!canConfirm || isWithdrawing || isSettingPin || isConfirming));

  const isLastStep = step === "pin";

  return (
    <>
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
              <TouchableOpacity onPress={goBack} style={styles.navButton} activeOpacity={0.75}>
                <Ionicons name="arrow-back" size={18} color={COLOR.forestDeep} />
              </TouchableOpacity>

              <Text style={styles.sheetTitle}>Withdraw</Text>

              <TouchableOpacity onPress={requestClose} style={styles.navButton} activeOpacity={0.75}>
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
                  plans={withdrawablePlans}
                  isLoading={isPlansLoading}
                  error={plansError}
                  selectedPlanId={selectedPlanId}
                  onSelect={setSelectedPlanId}
                  onRetry={() => void refetchPlans()}
                />
              )}

              {step === "source" && (
                <StepSource
                  targetOptions={targetOptions}
                  isLoading={isEnvelopesLoading}
                  error={envelopesError}
                  selectedTargetId={selectedTargetId}
                  onSelect={(id) => { setSelectedTargetId(id); setWithdrawalQuote(undefined); }}
                  currency={selectedPlan?.currency}
                  onRetry={() => void refetchEnvelopes()}
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
                    setWithdrawalQuote(undefined);
                    setWithdrawAll(false);
                  }}
                  onWithdrawAll={() => {
                    void handleWithdrawAll();
                  }}
                  isCalculatingFullAmount={isCalculatingFullAmount}
                />
              )}

              {step === "destination" && (
                <StepDestination
                  banks={banks}
                  accounts={bankAccounts}
                  destinationOptions={destinationOptions}
                  selectedDestinationKey={selectedDestinationKey}
                  isLoading={isAccountsLoading || isBeneficiariesLoading}
                  isBanksLoading={isBanksLoading}
                  error={accountsError || beneficiariesError}
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
                  onRetry={() => {
                    void Promise.all([refetchBanks(), refetchAccounts(), refetchBeneficiaries()]);
                  }}
                />
              )}

              {step === "review" && (
                <StepReview
                  selectedTarget={selectedTarget}
                  selectedDestination={selectedDestination}
                  quote={withdrawalQuote}
                />
              )}

              {step === "pin" && (
                <StepPin
                  selectedPlan={selectedPlan}
                  selectedTarget={selectedTarget}
                  selectedDestination={selectedDestination}
                  amountInKobo={amountInKobo}
                  withdrawAll={withdrawAll}
                  quote={withdrawalQuote}
                  hasWithdrawalPin={hasWithdrawalPin}
                  isPinStatusLoading={isPinStatusLoading}
                  pinMode={pinMode}
                  withdrawalPin={withdrawalPin}
                  newWithdrawalPin={newWithdrawalPin}
                  pinError={pinError}
                  resetOtp={resetOtp}
                  isSendingPinOtp={isSendingPinOtp}
                  isResettingPin={isResettingPin}
                  onChangeWithdrawalPin={(value) => { setPinError(null); setWithdrawalPin(value); }}
                  onChangeNewWithdrawalPin={(value) => { setPinError(null); setNewWithdrawalPin(value); }}
                  onChangeResetOtp={setResetOtp}
                  onForgotPin={async () => {
                    try {
                      await forgotWithdrawalPin();
                      setPinMode("reset");
                      showBottomToast({
                        type: "success",
                        text1: "OTP sent",
                        text2: "Check your email for the reset code."
                      });
                    } catch (error: any) {
                      showError("Could not send OTP", error, "Please try again.");
                    }
                  }}
                  onResetPin={async () => {
                    try {
                      await resetWithdrawalPin({
                        otp: resetOtp,
                        pin: newWithdrawalPin
                      });
                      setWithdrawalPin(newWithdrawalPin);
                      setNewWithdrawalPin("");
                      setResetOtp("");
                      setPinMode("enter");
                      showBottomToast({
                        type: "success",
                        text1: "PIN reset",
                        text2: "You can now confirm this withdrawal."
                      });
                    } catch (error: any) {
                      showError("Could not reset PIN", error, "Please check the OTP and try again.");
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
              testID="withdraw-cta"
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
              timedOut={pollTimedOut}
              onDone={resetAndClose}
            />
          )}
        </KeyboardAvoidingView>
      </Modal>
      <ErrorModal
        visible={modalError !== null}
        title={modalError?.title}
        message={modalError?.message || "Something went wrong."}
        supportReference={modalError?.supportReference}
        onClose={() => setModalError(null)}
      />
    </>
  );
};

// ─── Step 1: Plan picker ──────────────────────────────────────────────────────

const StepPlan = ({
  plans,
  isLoading,
  error,
  selectedPlanId,
  onSelect,
  onRetry,
}: {
  plans: Plan[];
  isLoading: boolean;
  error: unknown;
  selectedPlanId?: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) => (
  <View style={stepStyles.wrap}>
    <StepHeading title="Which plan?" sub="Choose the plan you want to withdraw from." />
    {isLoading ? (
      <LoadingState text="Loading plans…" />
    ) : error ? (
      <ErrorState onRetry={onRetry} />
    ) : plans.length === 0 ? (
      <EmptyState
        icon="checkmark-done-outline"
        title="Nothing left to withdraw"
        subtitle="Plans you can withdraw from appear here once they hold funds."
      />
    ) : (
      <View style={stepStyles.list}>
        {plans.map((plan) => (
          <SelectRow
            key={plan.id}
            selected={plan.id === selectedPlanId}
            icon="layers-outline"
            title={plan.name}
            meta={formatMoney(
              plan.remaining_balance ?? plan.plan_unboxed_balance ?? plan.amount,
              plan.currency
            )}
            tag="Remaining"
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
  error,
  selectedTargetId,
  onSelect,
  currency,
  onRetry,
}: {
  targetOptions: WithdrawalTarget[];
  isLoading: boolean;
  error: unknown;
  selectedTargetId?: string;
  onSelect: (id: string) => void;
  currency?: string;
  onRetry: () => void;
}) => (
  <View style={stepStyles.wrap}>
    <StepHeading title="Which balance?" sub="Only unlocked or matured balances can be withdrawn." />
    {isLoading ? (
      <LoadingState text="Checking sources…" />
    ) : error ? (
      <ErrorState onRetry={onRetry} />
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
  isCalculatingFullAmount
}: {
  selectedTarget?: WithdrawalTarget;
  currency?: string;
  amount: string;
  withdrawAll: boolean;
  amountInKobo: number;
  onChangeAmount: (v: string) => void;
  onWithdrawAll: () => void;
  isCalculatingFullAmount: boolean;
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
        value={
          withdrawAll
            ? koboToNaira(amountInKobo).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
            : amount
        }
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
      disabled={isCalculatingFullAmount}
      style={[amountStyles.allRow, withdrawAll && amountStyles.allRowActive]}
    >
      <View style={[amountStyles.checkbox, withdrawAll && amountStyles.checkboxActive]}>
        {withdrawAll && <Ionicons name="checkmark" size={12} color="#FFF" />}
      </View>
      <Text style={[amountStyles.allLabel, withdrawAll && amountStyles.allLabelActive]}>
        {isCalculatingFullAmount
          ? "Calculating maximum..."
          : withdrawAll
            ? "Maximum amount selected"
            : "Withdraw full amount"}
      </Text>
      <Text style={amountStyles.allAmount}>
        {withdrawAll ? formatMoney(amountInKobo, currency) : formatMoney(selectedTarget?.balance || 0, currency)}
      </Text>
    </TouchableOpacity>

    {/* Live preview */}
    {amountInKobo > 0 && !withdrawAll && (
      <View style={amountStyles.preview}>
        <Ionicons name="arrow-forward-circle-outline" size={15} color={COLOR.forestMid} />
        <Text style={amountStyles.previewText}>
          Sending <Text style={{ fontWeight: "900" }}>{formatMoney(amountInKobo, currency)}</Text>{" "}
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
  isBanksLoading,
  error,
  isResolving,
  isSaving,
  onSelect,
  onResolve,
  onCreateAccount,
  onCreateBeneficiary,
  onRetry,
}: {
  banks: Bank[];
  accounts: BankAccount[];
  destinationOptions: DestinationSelection[];
  selectedDestinationKey?: string;
  isLoading: boolean;
  isBanksLoading: boolean;
  error: unknown;
  isResolving: boolean;
  isSaving: boolean;
  onSelect: (key: string) => void;
  onResolve: (payload: {
    bank_code: string;
    account_number: string;
  }) => Promise<ResolveAccountResponse | undefined>;
  onCreateAccount: (payload: CreateBankAccountPayload) => Promise<void>;
  onCreateBeneficiary: (payload: CreateBankAccountPayload) => Promise<void>;
  onRetry: () => void;
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  const [saveAs] = useState<"account" | "beneficiary">("account");

  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolved, setResolved] =
    useState<ResolveAccountResponse>();

  const [bankSearch, setBankSearch] = useState("");

  const selectedBank = banks.find(
    (bank) => bank.code === selectedBankCode
  );

  const filteredBanks = banks.filter((bank) => {
    const q = bankSearch.trim().toLowerCase();

    if (!q) return true;

    return [bank.name, bank.code, bank.slug]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(q));
  });

  const shouldShowDestinationSearch =
    destinationOptions.length >= 5;

  /**
   * Resolve the account.
   *
   * This is intentionally kept as the same backend operation as before.
   * The only UX difference is that we can trigger it automatically once
   * the account number is complete.
   */
  const resolveAccount = async (
    bankCode: string,
    number: string
  ) => {
    if (!bankCode || number.length !== 10) {
      return;
    }

    try {
      const result = await onResolve({
        bank_code: bankCode,
        account_number: number,
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

  const handleAccountNumberChange = (value: string) => {
    const number = value.replace(/[^0-9]/g, "").slice(0, 10);

    setAccountNumber(number);
    setResolved(undefined);

    // Automatically verify once the number is complete.
    if (selectedBankCode && number.length === 10) {
      void resolveAccount(selectedBankCode, number);
    }
  };

  const handleSelectBank = (bank: Bank) => {
    setSelectedBankCode(bank.code);
    setResolved(undefined);
    setShowBankPicker(false);
    setBankSearch("");

    // If the account number was already entered,
    // verify against the newly selected bank.
    if (accountNumber.length === 10) {
      void resolveAccount(bank.code, accountNumber);
    }
  };

  const handleSave = async () => {
    if (!selectedBank || !resolved) {
      return;
    }

    const payload = {
      bank_name: selectedBank.name,
      bank_code: selectedBank.code,
      account_number: resolved.account_number,

      // Preserve the existing backend contract.
      nickname: "",
      is_default:
        saveAs === "account" && accounts.length === 0,
    };

    try {
      if (saveAs === "account") {
        await onCreateAccount(payload);
      } else {
        await onCreateBeneficiary(payload);
      }

      showBottomToast({
        type: "success",
        text1: "Account saved",
      });

      // Return to the simple destination view.
      setShowAdd(false);
      setShowBankPicker(false);
      setSelectedBankCode("");
      setAccountNumber("");
      setResolved(undefined);
      setBankSearch("");
    } catch (error: any) {
      showBottomToast({
        type: "error",
        text1: "Could not save account",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try again.",
      });
    }
  };

  const resetAddForm = () => {
    setShowAdd(false);
    setShowBankPicker(false);
    setSelectedBankCode("");
    setAccountNumber("");
    setResolved(undefined);
    setBankSearch("");
  };

  return (
    <View style={stepStyles.wrap}>
      <StepHeading
        title="Send to where?"
        sub="Choose where the money should go."
      />

      {/* ─────────────────────────────────────────────────────────────
          LOADING
      ───────────────────────────────────────────────────────────── */}

      {isLoading && (
        <LoadingState text="Loading accounts…" />
      )}

      {/* ─────────────────────────────────────────────────────────────
          ERROR
      ───────────────────────────────────────────────────────────── */}

      {!isLoading && Boolean(error) && (
        <ErrorState onRetry={onRetry} />
      )}

      {!isLoading && !error && (
        <>
          {/* ─────────────────────────────────────────────────────────
              SAVED DESTINATIONS
          ───────────────────────────────────────────────────────── */}

          {destinationOptions.length > 0 && !showAdd && (
            <View style={stepStyles.list}>
              {shouldShowDestinationSearch && (
                <View style={destStyles.searchRow}>
                  <Ionicons
                    name="search-outline"
                    size={15}
                    color={COLOR.textFaint}
                  />

                  <TextInput
                    placeholder="Search accounts"
                    placeholderTextColor={COLOR.textFaint}
                    style={destStyles.searchInput}
                  />
                </View>
              )}

              {destinationOptions.map((dest) => {
                const key = `${dest.type}:${dest.id}`;

                const selected =
                  key === selectedDestinationKey;

                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.75}
                    onPress={() => onSelect(key)}
                    style={[
                      destStyles.destinationRow,
                      selected &&
                      destStyles.destinationRowSelected,
                    ]}
                  >
                    <View
                      style={[
                        destStyles.destinationIcon,
                        selected &&
                        destStyles.destinationIconSelected,
                      ]}
                    >
                      <Ionicons
                        name={
                          dest.type === "account"
                            ? "card-outline"
                            : "person-outline"
                        }
                        size={18}
                        color={
                          selected
                            ? COLOR.forestDeep
                            : COLOR.textMuted
                        }
                      />
                    </View>

                    <View
                      style={
                        destStyles.destinationContent
                      }
                    >
                      <Text
                        style={destStyles.destinationTitle}
                        numberOfLines={1}
                      >
                        {dest.label}
                      </Text>

                      <Text
                        style={destStyles.destinationMeta}
                        numberOfLines={1}
                      >
                        {dest.bank} ·{" "}
                        {maskAccountNumber(
                          dest.accountNumber
                        )}
                      </Text>
                    </View>

                    <View
                      style={[
                        destStyles.radio,
                        selected &&
                        destStyles.radioSelected,
                      ]}
                    >
                      {selected && (
                        <View
                          style={
                            destStyles.radioInner
                          }
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────
              NO ACCOUNTS
          ───────────────────────────────────────────────────────── */}

          {destinationOptions.length === 0 &&
            !showAdd && (
              <View style={destStyles.emptyMinimal}>
                <View style={destStyles.emptyIcon}>
                  <Ionicons
                    name="card-outline"
                    size={20}
                    color={COLOR.textMuted}
                  />
                </View>

                <Text
                  style={destStyles.emptyTitle}
                >
                  No saved accounts
                </Text>

                <Text
                  style={destStyles.emptySubtitle}
                >
                  Add a bank account to continue.
                </Text>
              </View>
            )}

          {/* ─────────────────────────────────────────────────────────
              ADD ACCOUNT
          ───────────────────────────────────────────────────────── */}

          {!showAdd ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowAdd(true)}
              style={destStyles.addAccountRow}
            >
              <View
                style={destStyles.addAccountIcon}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={COLOR.forestDeep}
                />
              </View>

              <Text
                style={destStyles.addAccountText}
              >
                Add bank account
              </Text>

              <Ionicons
                name="chevron-forward"
                size={17}
                color={COLOR.textFaint}
              />
            </TouchableOpacity>
          ) : (
            <View style={destStyles.addFlow}>
              {/* Header */}
              <View
                style={destStyles.addFlowHeader}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={resetAddForm}
                  hitSlop={10}
                >
                  <Ionicons
                    name="arrow-back"
                    size={20}
                    color={COLOR.textMuted}
                  />
                </TouchableOpacity>

                <View
                  style={
                    destStyles.addFlowHeaderText
                  }
                >
                  <Text
                    style={
                      destStyles.addFlowTitle
                    }
                  >
                    Add bank account
                  </Text>

                  <Text
                    style={
                      destStyles.addFlowSubtitle
                    }
                  >
                    Enter the account details below.
                  </Text>
                </View>
              </View>

              {/* Bank */}
              <View
                style={destStyles.fieldGroup}
              >
                <Text
                  style={destStyles.fieldLabel}
                >
                  Bank
                </Text>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    setShowBankPicker(true)
                  }
                  style={[
                    destStyles.selectField,
                    selectedBank &&
                    destStyles.selectFieldActive,
                  ]}
                >
                  <View
                    style={
                      destStyles.selectFieldContent
                    }
                  >
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color={
                        selectedBank
                          ? COLOR.forestDeep
                          : COLOR.textFaint
                      }
                    />

                    <Text
                      style={[
                        destStyles.selectFieldText,
                        !selectedBank &&
                        destStyles.selectFieldPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedBank?.name ||
                        "Select bank"}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-down"
                    size={17}
                    color={COLOR.textFaint}
                  />
                </TouchableOpacity>
              </View>

              {/* Account number */}
              <View
                style={destStyles.fieldGroup}
              >
                <Text
                  style={destStyles.fieldLabel}
                >
                  Account number
                </Text>

                <View
                  style={[
                    destStyles.accountInputRow,
                    resolved &&
                    destStyles.accountInputResolved,
                  ]}
                >
                  <TextInput
                    value={accountNumber}
                    onChangeText={
                      handleAccountNumberChange
                    }
                    keyboardType="number-pad"
                    placeholder="10-digit account number"
                    placeholderTextColor={
                      COLOR.textFaint
                    }
                    style={
                      destStyles.accountInput
                    }
                    maxLength={10}
                  />

                  {isResolving && (
                    <ActivityIndicator
                      size="small"
                      color={COLOR.forestDeep}
                    />
                  )}

                  {!isResolving && resolved && (
                    <Ionicons
                      name="checkmark-circle"
                      size={19}
                      color={COLOR.forestMid}
                    />
                  )}
                </View>
              </View>

              {/* Resolved identity */}
              {resolved && (
                <View
                  style={
                    destStyles.resolvedMinimal
                  }
                >
                  <View
                    style={
                      destStyles.resolvedIcon
                    }
                  >
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={COLOR.forestDeep}
                    />
                  </View>

                  <View
                    style={
                      destStyles.resolvedContent
                    }
                  >
                    <Text
                      style={
                        destStyles.resolvedLabel
                      }
                    >
                      Account verified
                    </Text>

                    <Text
                      style={
                        destStyles.resolvedName
                      }
                    >
                      {resolved.account_name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Save */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSave}
                disabled={
                  !resolved || isSaving
                }
                style={[
                  destStyles.saveButton,
                  (!resolved || isSaving) &&
                  destStyles.saveButtonDisabled,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFF"
                  />
                ) : (
                  <Text
                    style={
                      destStyles.saveButtonText
                    }
                  >
                    Save account
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────
              BANK PICKER
          ───────────────────────────────────────────────────────── */}

          <Modal
            visible={showBankPicker}
            transparent
            animationType="slide"
            onRequestClose={() =>
              setShowBankPicker(false)
            }
          >
            <View
              style={destStyles.bankModalBackdrop}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={destStyles.bankModalDismiss}
                onPress={() =>
                  setShowBankPicker(false)
                }
              />

              <View
                style={destStyles.bankModal}
              >
                <View
                  style={destStyles.bankModalHeader}
                >
                  <View>
                    <Text
                      style={
                        destStyles.bankModalTitle
                      }
                    >
                      Select bank
                    </Text>

                    <Text
                      style={
                        destStyles.bankModalSubtitle
                      }
                    >
                      Search and choose your bank.
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      setShowBankPicker(false)
                    }
                    hitSlop={10}
                  >
                    <Ionicons
                      name="close"
                      size={22}
                      color={COLOR.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  style={destStyles.searchRow}
                >
                  <Ionicons
                    name="search-outline"
                    size={15}
                    color={COLOR.textFaint}
                  />

                  <TextInput
                    value={bankSearch}
                    onChangeText={setBankSearch}
                    placeholder="Search banks"
                    placeholderTextColor={
                      COLOR.textFaint
                    }
                    style={
                      destStyles.searchInput
                    }
                    autoFocus
                  />

                  {bankSearch.length > 0 && (
                    <TouchableOpacity
                      onPress={() =>
                        setBankSearch("")
                      }
                      hitSlop={8}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={COLOR.textFaint}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={
                    destStyles.bankList
                  }
                >
                  {isBanksLoading && (
                    <ActivityIndicator
                      size="small"
                      color={COLOR.forestDeep}
                      style={{ marginTop: 24 }}
                    />
                  )}

                  {!isBanksLoading && filteredBanks.map((bank) => {
                    const selected =
                      bank.code ===
                      selectedBankCode;

                    return (
                      <TouchableOpacity
                        key={
                          bank.code + bank.name
                        }
                        activeOpacity={0.7}
                        onPress={() =>
                          handleSelectBank(
                            bank
                          )
                        }
                        style={[
                          destStyles.bankRow,
                          selected &&
                          destStyles.bankRowSelected,
                        ]}
                      >
                        <View
                          style={
                            destStyles.bankRowIcon
                          }
                        >
                          <Ionicons
                            name="business-outline"
                            size={17}
                            color={
                              selected
                                ? COLOR.forestDeep
                                : COLOR.textMuted
                            }
                          />
                        </View>

                        <Text
                          style={
                            destStyles.bankRowText
                          }
                          numberOfLines={1}
                        >
                          {bank.name}
                        </Text>

                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={19}
                            color={
                              COLOR.forestDeep
                            }
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {!isBanksLoading && filteredBanks.length === 0 && (
                    <Text
                      style={
                        destStyles.noBank
                      }
                    >
                      No matching bank.
                    </Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
};

// ─── Step 5: PIN + confirm (merged) ──────────────────────────────────────────

const StepReview = ({
  selectedTarget,
  selectedDestination,
  quote,
}: {
  selectedTarget?: WithdrawalTarget;
  selectedDestination?: DestinationSelection;
  quote?: WithdrawalPreview;
}) => (
  <View style={stepStyles.wrap}>
    <StepHeading title="Review withdrawal" sub="Check every detail before you approve this transfer." />
    <View style={reviewStyles.hero}>
      <Text style={reviewStyles.heroLabel}>You&apos;ll receive</Text>
      <Text style={reviewStyles.heroAmount}>{quoteAmount(quote?.recipient_amount)}</Text>
      <Text style={reviewStyles.heroMeta}>{quoteAmount(quote?.requested_amount)} withdrawal · {quote ? formatMoney(quote.provider_transfer_fee + quote.government_levy) : "—"} fee</Text>
    </View>
    <View style={reviewStyles.contextGroup}>
      <ReviewContextRow label="FROM" value={selectedTarget?.label || "Selected source"} sub={`${quoteAmount(selectedTarget?.balance)} available${quote ? ` · ${quoteAmount(quote.remaining_balance)} remaining` : ""}`} icon="wallet-outline" />
      <ReviewContextRow label="TO" value={selectedDestination?.bank || "Selected destination"} sub={selectedDestination ? maskAccountNumber(selectedDestination.accountNumber) : undefined} icon="paper-plane-outline" last />
    </View>
    <View style={reviewStyles.breakdown}>
      <ReviewBreakdownRow label="Withdrawal amount" value={quoteAmount(quote?.requested_amount)} />
      <ReviewBreakdownRow label="Fee" value={quote ? formatMoney(quote.provider_transfer_fee + quote.government_levy) : "—"} sub={quote?.allowance_applied && quote.xavault_subsidy > 0 ? "Covered by XAVAULT" : undefined} />
      <View style={reviewStyles.breakdownDivider} />
      <ReviewBreakdownRow label="You&apos;ll receive" value={quoteAmount(quote?.recipient_amount)} strong />
    </View>
    <View style={reviewStyles.explanation}>
      <Ionicons name="information-circle-outline" size={15} color={COLOR.forestMid} />
      <Text style={reviewStyles.explanationText}>Fee is deducted from your withdrawal amount.</Text>
    </View>
    {quote?.expires_at ? <Text style={reviewStyles.expiryNotice}>{formatQuoteExpiry(quote.expires_at)}</Text> : null}
  </View>
);

const ReviewContextRow = ({ label, value, sub, icon, last }: { label: string; value: string; sub?: string; icon: keyof typeof Ionicons.glyphMap; last?: boolean }) => (
  <View style={[reviewStyles.contextRow, last && reviewStyles.contextRowLast]}>
    <View style={reviewStyles.contextIcon}><Ionicons name={icon} size={15} color={COLOR.forestMid} /></View>
    <View style={reviewStyles.contextCopy}>
      <Text style={reviewStyles.contextLabel}>{label}</Text>
      <Text style={reviewStyles.contextValue} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={reviewStyles.contextSub}>{sub}</Text> : null}
    </View>
  </View>
);

const ReviewBreakdownRow = ({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) => (
  <View style={reviewStyles.breakdownRow}>
    <View style={reviewStyles.breakdownCopy}>
      <Text style={[reviewStyles.breakdownLabel, strong && reviewStyles.breakdownLabelStrong]}>{label}</Text>
      {sub ? <Text style={reviewStyles.breakdownSub}>{sub}</Text> : null}
    </View>
    <Text style={[reviewStyles.breakdownValue, strong && reviewStyles.breakdownValueStrong]}>{value}</Text>
  </View>
);

const ReviewRow = ({
  label,
  value,
  sub,
  last
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
  hero: {
    paddingBottom: 22,
    paddingTop: 4,
  },
  heroLabel: {
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  heroAmount: {
    color: COLOR.forestDeep,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 3,
  },
  heroMeta: {
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  contextGroup: {
    borderBottomColor: COLOR.border,
    borderBottomWidth: 1,
    borderTopColor: COLOR.border,
    borderTopWidth: 1,
    marginBottom: 16,
  },
  contextRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 13,
    borderBottomColor: "#F0F4F2",
    borderBottomWidth: 1,
  },
  contextRowLast: {
    borderBottomWidth: 0,
  },
  contextIcon: {
    alignItems: "center",
    backgroundColor: COLOR.forestLight,
    borderRadius: 10,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  contextCopy: {
    flex: 1,
    gap: 2,
  },
  contextLabel: {
    color: COLOR.textFaint,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  contextValue: {
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "900",
  },
  contextSub: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  breakdown: {
    gap: 13,
    marginBottom: 14,
  },
  breakdownRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  breakdownCopy: {
    flex: 1,
    gap: 2,
  },
  breakdownLabel: {
    color: COLOR.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  breakdownLabelStrong: {
    color: COLOR.forestDeep,
    fontWeight: "900",
  },
  breakdownSub: {
    color: COLOR.forestMid,
    fontSize: 11,
    fontWeight: "800",
  },
  breakdownValue: {
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "900",
  },
  breakdownValueStrong: {
    color: COLOR.forestDeep,
    fontSize: 18,
  },
  breakdownDivider: {
    borderTopColor: COLOR.border,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  explanation: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  explanationText: {
    color: COLOR.textMuted,
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
  },

  card: {
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 14,
    overflow: "hidden"
  },
  row: {
    borderBottomColor: "#F0F4F2",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  rowLast: {
    borderBottomWidth: 0
  },
  label: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    width: 76
  },
  copy: {
    flex: 1,
    gap: 2
  },
  value: {
    color: COLOR.textBody,
    fontSize: 13,
    fontWeight: "900"
  },
  sub: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16
  },
  subsidyBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLOR.forestLight,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  subsidyText: {
    color: COLOR.forestMid,
    fontSize: 11,
    fontWeight: "800",
  },
  expiryNotice: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 10,
  }
});


//Step Pin
const StepPin = ({
  hasWithdrawalPin,
  pinMode,
  withdrawalPin,
  resetOtp,
  isSendingPinOtp,
  isResettingPin,
  onChangeWithdrawalPin,
  onChangeNewWithdrawalPin,
  onChangeResetOtp,
  onForgotPin,
  onResetPin,
  onCancelReset,
  pinError,
  isPinStatusLoading,
  newWithdrawalPin,
}: {
  selectedPlan?: Plan;
  selectedTarget?: WithdrawalTarget;
  selectedDestination?: DestinationSelection;
  amountInKobo: number;
  withdrawAll: boolean;
  quote?: WithdrawalPreview;

  hasWithdrawalPin: boolean;
  isPinStatusLoading: boolean;
  pinMode: "enter" | "reset";

  withdrawalPin: string;
  newWithdrawalPin: string;
  pinError: string | null;
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
  const cleanPin = (v: string) =>
    v.replace(/[^0-9]/g, "").slice(0, 4);

  const cleanOtp = (v: string) =>
    v.replace(/[^0-9]/g, "").slice(0, 6);

  const resetReady =
    resetOtp.length === 6 &&
    newWithdrawalPin.length === 4;

  const activePin = hasWithdrawalPin
    ? withdrawalPin
    : newWithdrawalPin;

  const handlePinChange = (value: string) => {
    const cleaned = cleanPin(value);

    if (hasWithdrawalPin) {
      onChangeWithdrawalPin(cleaned);
    } else {
      onChangeNewWithdrawalPin(cleaned);
    }
  };

  return (
    <View style={stepStyles.wrap}>
      {pinMode === "reset" ? (
        /* ─────────────────────────────────────────────
           RESET PIN
        ───────────────────────────────────────────── */
        <View style={minimalPinStyles.resetContainer}>
          <View style={minimalPinStyles.header}>
            <Text style={minimalPinStyles.title}>
              Reset your PIN
            </Text>

            <Text style={minimalPinStyles.subtitle}>
              Enter the code sent to your email and create
              a new 4-digit withdrawal PIN.
            </Text>
          </View>

          <View style={minimalPinStyles.field}>
            <Text style={minimalPinStyles.label}>
              Email code
            </Text>

            <TextInput
              value={resetOtp}
              onChangeText={(value) =>
                onChangeResetOtp(cleanOtp(value))
              }
              keyboardType="number-pad"
              placeholder="6-digit code"
              placeholderTextColor={COLOR.textFaint}
              style={minimalPinStyles.otpInput}
              maxLength={6}
            />
          </View>

          <View style={minimalPinStyles.pinSection}>
            <Text style={minimalPinStyles.label}>
              New PIN
            </Text>

            <PinDots value={newWithdrawalPin} />

            <PinKeypad
              value={newWithdrawalPin}
              onChange={(value) =>
                onChangeNewWithdrawalPin(cleanPin(value))
              }
            />
          </View>

          <View style={minimalPinStyles.resetActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onCancelReset}
              style={minimalPinStyles.cancelButton}
            >
              <Text style={minimalPinStyles.cancelButtonText}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onResetPin}
              disabled={!resetReady || isResettingPin}
              style={[
                minimalPinStyles.resetButton,
                (!resetReady || isResettingPin) &&
                minimalPinStyles.buttonDisabled,
              ]}
            >
              {isResettingPin ? (
                <ActivityIndicator
                  size="small"
                  color="#FFF"
                />
              ) : (
                <Text style={minimalPinStyles.resetButtonText}>
                  Reset PIN
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ─────────────────────────────────────────────
           ENTER / CREATE PIN
        ───────────────────────────────────────────── */
        <View style={minimalPinStyles.container}>
          <View style={minimalPinStyles.header}>
            <Text style={minimalPinStyles.title}>
              {isPinStatusLoading
                ? "Checking PIN"
                : hasWithdrawalPin
                  ? "Approve withdrawal"
                  : "Create withdrawal PIN"}
            </Text>

            {!isPinStatusLoading && (
              <Text style={minimalPinStyles.subtitle}>
                {hasWithdrawalPin
                  ? "Enter your 4-digit PIN to authorize this withdrawal."
                  : "Create a 4-digit PIN to secure your withdrawals."}
              </Text>
            )}
          </View>

          {isPinStatusLoading ? (
            <View style={minimalPinStyles.loading}>
              <ActivityIndicator
                size="small"
                color={COLOR.forestMid}
              />

              <Text style={minimalPinStyles.loadingText}>
                Checking security settings…
              </Text>
            </View>
          ) : (
            <>
              <View style={minimalPinStyles.pinSection}>
                <PinDots value={activePin} />

                <PinKeypad
                  value={activePin}
                  onChange={handlePinChange}
                />
              </View>

              {pinError ? (
                <View style={minimalPinStyles.error}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={15}
                    color="#B42318"
                  />

                  <Text style={minimalPinStyles.errorText}>
                    {pinError}
                  </Text>
                </View>
              ) : null}

              {hasWithdrawalPin && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onForgotPin}
                  disabled={isSendingPinOtp}
                  style={minimalPinStyles.forgotButton}
                >
                  <Text style={minimalPinStyles.forgotText}>
                    {isSendingPinOtp
                      ? "Sending code…"
                      : "Forgot PIN?"}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};



// ─── PIN sub-components ───────────────────────────────────────────────────────

// Standard phone keypad order: 1 2 3 / 4 5 6 / 7 8 9 / _ 0 ⌫
const PIN_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"]
];

const PinDots = ({ value }: { value: string }) => (
  <View style={pinStyles.dots}>
    {[0, 1, 2, 3].map((i) => (
      <View key={i} style={[pinStyles.dot, value.length > i && pinStyles.dotFilled]} />
    ))}
  </View>
);

const PinKeypad = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
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
  timedOut,
  onDone
}: {
  state: WithdrawalProcessingState;
  amount: string;
  receipt: WithdrawalReceipt | null;
  timedOut: boolean;
  onDone: () => void;
}) => {
  const isSubmitting = state === "submitting";
  const isCompleted = state === "completed";
  const isFailed = state === "failed";
  const toneStyle = isCompleted
    ? overlayStyles.cardCompleted
    : isFailed
      ? overlayStyles.cardFailed
      : overlayStyles.cardProcessing;

  return (
    <View style={overlayStyles.wrap}>
      <View style={[overlayStyles.card, toneStyle]}>
        {isSubmitting ? (
          <View style={overlayStyles.spinnerWrap}>
            <ActivityIndicator color={COLOR.forestDeep} size="large" />
          </View>
        ) : (
          <View
            style={[
              overlayStyles.statusIcon,
              isCompleted
                ? overlayStyles.statusIconCompleted
                : isFailed
                  ? overlayStyles.statusIconFailed
                  : overlayStyles.statusIconProcessing
            ]}
          >
            <Ionicons
              name={isCompleted ? "checkmark" : isFailed ? "close" : "time-outline"}
              size={30}
              color="#FFF"
            />
          </View>
        )}
        <Text style={overlayStyles.title}>
          {isSubmitting
            ? "Sending withdrawal..."
            : isCompleted
              ? "Withdrawal completed"
              : isFailed
                ? "Withdrawal failed"
                : timedOut
                  ? "Still processing"
                  : "Transfer processing"}
        </Text>
        <Text style={overlayStyles.sub}>
          {isSubmitting
            ? "Keep this screen open while Paystack accepts your request."
            : isCompleted
              ? `${amount} was successfully transferred.`
              : isFailed
                ? "The transfer was not completed. The funds remain in your plan or envelope."
                : timedOut
                  ? `${amount} was accepted and is still awaiting confirmation. You can close this screen and check Transactions later.`
                  : `${amount} was accepted and is awaiting confirmation from Paystack.`}
        </Text>
        {!isSubmitting && receipt ? (
          <View style={overlayStyles.receiptBox}>
            <View style={overlayStyles.receiptRow}>
              <Text style={overlayStyles.receiptLabel}>Reference</Text>
              <Text style={overlayStyles.receiptValue} numberOfLines={1}>
                {receipt.reference}
              </Text>
            </View>
            <View style={overlayStyles.receiptRow}>
              <Text style={overlayStyles.receiptLabel}>Status</Text>
              <Text style={overlayStyles.receiptValue}>{receipt.status}</Text>
            </View>
            <View style={overlayStyles.receiptRow}>
              <Text style={overlayStyles.receiptLabel}>To</Text>
              <Text style={overlayStyles.receiptValue} numberOfLines={1}>
                {receipt.destination}
              </Text>
            </View>
          </View>
        ) : null}
        {!isSubmitting && (
          <TouchableOpacity activeOpacity={0.85} onPress={onDone} style={overlayStyles.doneBtn}>
            <Text style={overlayStyles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

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
    marginBottom: 6
  },
  sub: {
    fontSize: 13,
    fontWeight: "600",
    color: COLOR.textMuted,
    lineHeight: 19
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: COLOR.amberBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.amberBorder,
    padding: 12
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: COLOR.amber,
    lineHeight: 18
  }
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
    marginBottom: 16
  },
  availableLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLOR.forestMuted
  },
  availableValue: {
    fontSize: 12,
    fontWeight: "900",
    color: COLOR.forestDeep
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
    marginBottom: 12
  },
  inputWrapMuted: {
    backgroundColor: COLOR.forestLight,
    borderColor: COLOR.forestBorder
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: "900",
    color: `${COLOR.forestDeep}33`,
    marginRight: 6
  },
  input: {
    flex: 1,
    fontSize: 38,
    fontWeight: "900",
    color: COLOR.forestDeep,
    letterSpacing: -1.2,
    paddingVertical: 0
  },
  inputMuted: {
    color: COLOR.forestMid
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
    marginBottom: 14
  },
  allRowActive: {
    borderColor: COLOR.forestDeep,
    backgroundColor: "#F4FAF7"
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxActive: {
    backgroundColor: COLOR.forestDeep,
    borderColor: COLOR.forestDeep
  },
  allLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: COLOR.textMuted
  },
  allLabelActive: {
    color: COLOR.forestDeep,
    fontWeight: "800"
  },
  allAmount: {
    fontSize: 13,
    fontWeight: "900",
    color: COLOR.forestMid
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLOR.forestLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.forestBorder,
    padding: 12
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLOR.forestMid,
    lineHeight: 19
  }
});

const destStyles = StyleSheet.create({
  // ─────────────────────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────────────────────

  searchRow: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
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
    fontWeight: "500",
    paddingVertical: 0,
  },

  // ─────────────────────────────────────────────────────────────
  // SAVED DESTINATIONS
  // ─────────────────────────────────────────────────────────────

  destinationRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },

  destinationRowSelected: {
    backgroundColor: COLOR.forestLight,
    borderRadius: 12,
    borderBottomWidth: 0,
    paddingHorizontal: 10,
  },

  destinationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },

  destinationIconSelected: {
    backgroundColor: COLOR.forestLight,
  },

  destinationContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },

  destinationTitle: {
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "700",
  },

  destinationMeta: {
    marginTop: 4,
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLOR.textFaint,
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: COLOR.forestDeep,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLOR.forestDeep,
  },

  // ─────────────────────────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────────────────────────

  emptyMinimal: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },

  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  emptyTitle: {
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "700",
  },

  emptySubtitle: {
    marginTop: 4,
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },

  // ─────────────────────────────────────────────────────────────
  // ADD ACCOUNT ENTRY
  // ─────────────────────────────────────────────────────────────

  addAccountRow: {
    minHeight: 54,
    marginTop: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.border,
  },

  addAccountIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLOR.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },

  addAccountText: {
    flex: 1,
    marginLeft: 10,
    color: COLOR.forestDeep,
    fontSize: 14,
    fontWeight: "600",
  },

  // Keep these aliases if another part of the component
  // still references the old names during the transition.

  addToggle: {
    marginTop: 8,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.border,
    backgroundColor: "transparent",
  },

  addToggleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLOR.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },

  addToggleText: {
    color: COLOR.forestDeep,
    fontSize: 14,
    fontWeight: "600",
  },

  // ─────────────────────────────────────────────────────────────
  // ADD ACCOUNT FLOW
  // ─────────────────────────────────────────────────────────────

  addFlow: {
    marginTop: 8,
    paddingTop: 8,
  },

  addFlowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  addFlowHeaderText: {
    flex: 1,
    marginLeft: 12,
  },

  addFlowTitle: {
    color: COLOR.textBody,
    fontSize: 17,
    fontWeight: "700",
  },

  addFlowSubtitle: {
    marginTop: 4,
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },

  fieldGroup: {
    marginBottom: 18,
  },

  fieldLabel: {
    marginBottom: 7,
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },

  // ─────────────────────────────────────────────────────────────
  // BANK SELECT
  // ─────────────────────────────────────────────────────────────

  selectField: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectFieldActive: {
    borderColor: COLOR.forestMid,
    backgroundColor: COLOR.forestLight,
  },

  selectFieldContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  selectFieldText: {
    flex: 1,
    marginLeft: 10,
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "600",
  },

  selectFieldPlaceholder: {
    color: COLOR.textFaint,
    fontWeight: "500",
  },

  // ─────────────────────────────────────────────────────────────
  // ACCOUNT NUMBER
  // ─────────────────────────────────────────────────────────────

  accountInputRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    flexDirection: "row",
    alignItems: "center",
  },

  accountInputResolved: {
    borderColor: COLOR.forestMid,
    backgroundColor: COLOR.forestLight,
  },

  accountInput: {
    flex: 1,
    color: COLOR.textBody,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 0,
  },

  // Keep fieldInput for any existing references.
  fieldInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    color: COLOR.textBody,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 14,
  },

  // ─────────────────────────────────────────────────────────────
  // VERIFIED ACCOUNT
  // ─────────────────────────────────────────────────────────────

  resolvedMinimal: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 18,
  },

  resolvedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLOR.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },

  resolvedContent: {
    flex: 1,
    marginLeft: 10,
  },

  resolvedLabel: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },

  resolvedName: {
    marginTop: 2,
    color: COLOR.forestDeep,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },

  // Keep the old name working if needed.
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

  // ─────────────────────────────────────────────────────────────
  // SAVE
  // ─────────────────────────────────────────────────────────────

  saveButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: COLOR.forestDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonDisabled: {
    opacity: 0.4,
  },

  saveButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Keep old action styles available so the component
  // doesn't break if an old reference remains.
  formActions: {
    flexDirection: "row",
    gap: 10,
  },

  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLOR.bgSubtle,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryBtnText: {
    color: COLOR.forestDeep,
    fontSize: 13,
    fontWeight: "700",
  },

  primaryBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLOR.forestMid,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // ─────────────────────────────────────────────────────────────
  // BANK PICKER
  // ─────────────────────────────────────────────────────────────

  bankModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },

  bankModalDismiss: {
    flex: 1,
  },

  bankModal: {
    maxHeight: "75%",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLOR.surface,
  },

  bankModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  bankModalTitle: {
    color: COLOR.textBody,
    fontSize: 17,
    fontWeight: "700",
  },

  bankModalSubtitle: {
    marginTop: 4,
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },

  bankList: {
    paddingTop: 8,
    paddingBottom: 16,
  },

  bankRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },

  bankRowSelected: {
    backgroundColor: COLOR.forestLight,
  },

  bankRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },

  bankRowText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "500",
  },

  // ─────────────────────────────────────────────────────────────
  // LEGACY BANK STYLES
  // ─────────────────────────────────────────────────────────────

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
    flex: 1,
    color: COLOR.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },

  bankChipTextActive: {
    color: COLOR.forestDeep,
    fontWeight: "700",
  },

  noBank: {
    color: COLOR.textFaint,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 16,
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
    marginBottom: 14
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLOR.forestLight,
    alignItems: "center",
    justifyContent: "center"
  },
  cardTitle: {
    color: COLOR.textBody,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 3
  },
  cardSub: {
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  form: {
    gap: 12
  },
  inlineError: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  inlineErrorText: {
    color: "#B42318",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 6
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface
  },
  dotFilled: {
    backgroundColor: COLOR.forestDeep,
    borderColor: COLOR.forestDeep
  },
  keypad: {
    gap: 10
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10
  },
  key: {
    width: 90,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center"
  },
  keyGhost: {
    width: 90,
    height: 56
  },
  keyText: {
    color: COLOR.forestDeep,
    fontSize: 22,
    fontWeight: "900"
  },
  otpWrap: {
    gap: 6
  },
  otpLabel: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6
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
    letterSpacing: 4
  },
  newPinLabel: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center"
  },
  retryButton: {
    backgroundColor: COLOR.forestLight,
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryText: {
    color: COLOR.forestDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLOR.bgSubtle,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryBtnText: {
    color: COLOR.forestDeep,
    fontSize: 13,
    fontWeight: "900"
  },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLOR.forestMid,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "900"
  },
  forgotBtn: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  forgotBtnText: {
    color: COLOR.forestMid,
    fontSize: 13,
    fontWeight: "900"
  }
});




const minimalPinStyles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 24,
  },

  header: {
    alignItems: "center",
    marginBottom: 28,
    paddingHorizontal: 12,
  },

  title: {
    color: COLOR.textBody,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },

  subtitle: {
    color: COLOR.textMuted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 300,
    textAlign: "center",
  },

  pinSection: {
    alignItems: "center",
    gap: 18,
  },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },

  dot: {
    width: 15,
    height: 15,
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
    marginTop: 4,
  },

  keyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },

  key: {
    width: 86,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLOR.bgSubtle,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },

  keyGhost: {
    width: 86,
    height: 54,
  },

  keyText: {
    color: COLOR.forestDeep,
    fontSize: 21,
    fontWeight: "700",
  },

  error: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 16,
  },

  errorText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },

  forgotButton: {
    alignSelf: "center",
    marginTop: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  forgotText: {
    color: COLOR.forestMid,
    fontSize: 13,
    fontWeight: "700",
  },

  loading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },

  loadingText: {
    color: COLOR.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  /* ─────────────────────────────────────────────
     RESET PIN
  ───────────────────────────────────────────── */

  resetContainer: {
    paddingTop: 8,
    paddingBottom: 24,
  },

  field: {
    marginBottom: 24,
  },

  label: {
    color: COLOR.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },

  otpInput: {
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSubtle,
    color: COLOR.textBody,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 14,
    letterSpacing: 3,
    textAlign: "center",
  },

  resetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },

  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    backgroundColor: COLOR.bgSubtle,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    color: COLOR.forestDeep,
    fontSize: 13,
    fontWeight: "700",
  },

  resetButton: {
    flex: 1.5,
    height: 48,
    borderRadius: 13,
    backgroundColor: COLOR.forestDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  resetButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },

  buttonDisabled: {
    opacity: 0.4,
  },
});



const overlayStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,20,16,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: COLOR.surface,
    padding: 28,
    alignItems: "center",
    gap: 14,
    borderTopWidth: 6
  },
  cardProcessing: {
    borderTopColor: "#E59A18"
  },
  cardCompleted: {
    borderTopColor: COLOR.forestMid
  },
  cardFailed: {
    borderTopColor: "#C93C37"
  },
  spinnerWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSubtle,
    alignItems: "center",
    justifyContent: "center"
  },
  statusIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  statusIconProcessing: {
    backgroundColor: "#E59A18"
  },
  statusIconCompleted: {
    backgroundColor: COLOR.forestMid
  },
  statusIconFailed: {
    backgroundColor: "#C93C37"
  },
  title: {
    color: COLOR.textBody,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3
  },
  sub: {
    color: COLOR.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center"
  },
  receiptBox: {
    alignSelf: "stretch",
    backgroundColor: COLOR.bgSubtle,
    borderColor: COLOR.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden"
  },
  receiptRow: {
    borderBottomColor: COLOR.border,
    borderBottomWidth: 1,
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  receiptLabel: {
    color: COLOR.textFaint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  receiptValue: {
    color: COLOR.textBody,
    fontSize: 12,
    fontWeight: "900"
  },
  doneBtn: {
    alignSelf: "stretch",
    height: 50,
    borderRadius: 16,
    backgroundColor: COLOR.forestDeep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  doneBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900"
  }
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    maxHeight: "94%",
    backgroundColor: COLOR.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLOR.border,
    alignSelf: "center",
    marginBottom: 18
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLOR.surface,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center"
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: COLOR.textBody,
    letterSpacing: -0.2
  },
  content: {
    paddingBottom: 16,
    gap: 0
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
    elevation: 6
  },
  ctaDisabled: {
    opacity: 0.38
  },
  ctaText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900"
  }
});

export default WithdrawalModal;
