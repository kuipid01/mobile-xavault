
import { formatMoney, nairaToKobo } from "@/api/money";
import { Envelope, Plan } from "@/api/types";
import { useEnvelopes } from "@/hooks/app/envelopes";
import { usePlans } from "@/hooks/app/plans";
import {
  useWithdrawFromEnvelope,
  useWithdrawFromPlan,
} from "@/hooks/app/withdrawals";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { visible: boolean; onClose: () => void };

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

type Step = "plan" | "source" | "amount" | "confirm";

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
  const balance = matured ? plan.amount : plan.plan_unboxed_balance;
  if ((!matured && !flexible) || balance <= 0) return null;
  return {
    type: "plan",
    id: plan.id,
    label: plan.name,
    balance,
    reason: matured ? "Reached end date" : "Flexible balance",
  };
};

const envelopeWithdrawalTarget = (envelope: Envelope): WithdrawalTarget | null => {
  const matured = isEnvelopeMatured(envelope);
  const flexible = envelope.unboxed_balance_policy === "flexible";
  const balance = matured ? envelope.amount : envelope.unboxed_balance;
  if ((!matured && !flexible) || balance <= 0) return null;
  return {
    type: "envelope",
    id: envelope.id,
    label: envelope.name,
    balance,
    reason: matured ? "Reached end date" : "Flexible balance",
    envelope,
  };
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: Step[] = ["plan", "source", "amount", "confirm"];
const STEP_LABELS: Record<Step, string> = {
  plan: "Plan",
  source: "Source",
  amount: "Amount",
  confirm: "Review",
};

const StepBar = ({ current }: { current: Step }) => {
  const currentIdx = STEPS.indexOf(current);
  return (
    <View style={stepStyles.row}>
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <View key={step} style={stepStyles.stepWrap}>
            <View
              style={[
                stepStyles.dot,
                done && stepStyles.dotDone,
                active && stepStyles.dotActive,
              ]}
            >
              {done ? (
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              ) : (
                <Text style={[stepStyles.dotNum, active && stepStyles.dotNumActive]}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                stepStyles.label,
                active && stepStyles.labelActive,
                done && stepStyles.labelDone,
              ]}
            >
              {STEP_LABELS[step]}
            </Text>
            {i < STEPS.length - 1 && (
              <View style={[stepStyles.line, done && stepStyles.lineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
};

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },
  stepWrap: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EDF1EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: "#DDE6E1",
  },
  dotActive: {
    backgroundColor: "#063B2E",
    borderColor: "#063B2E",
  },
  dotDone: {
    backgroundColor: "#106B4F",
    borderColor: "#106B4F",
  },
  dotNum: {
    fontSize: 10,
    fontWeight: "900",
    color: "#9EAAA5",
  },
  dotNumActive: {
    color: "#FFFFFF",
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: "#9EAAA5",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  labelActive: {
    color: "#063B2E",
    fontWeight: "900",
  },
  labelDone: {
    color: "#106B4F",
  },
  line: {
    position: "absolute",
    top: 12,
    left: "50%",
    right: "-50%",
    height: 1.5,
    backgroundColor: "#DDE6E1",
    zIndex: -1,
  },
  lineDone: {
    backgroundColor: "#106B4F",
  },
});

// ─── Main modal ───────────────────────────────────────────────────────────────

const WithdrawalModal = ({ visible, onClose }: Props) => {
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [selectedTargetId, setSelectedTargetId] = useState<string>();
  const [amount, setAmount] = useState("");
  const [withdrawAll, setWithdrawAll] = useState(true);

  const { data: plansData, isLoading: isPlansLoading } = usePlans();
  const plans = useMemo(() => plansData?.items || [], [plansData?.items]);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const { data: envelopes = [], isLoading: isEnvelopesLoading } =
    useEnvelopes(selectedPlanId);
  const { mutateAsync: withdrawPlan, isPending: isWithdrawingPlan } =
    useWithdrawFromPlan();
  const { mutateAsync: withdrawEnvelope, isPending: isWithdrawingEnvelope } =
    useWithdrawFromEnvelope();
  const isWithdrawing = isWithdrawingPlan || isWithdrawingEnvelope;

  const targetOptions = useMemo(() => {
    if (!selectedPlan) return [];
    const planTarget = planWithdrawalTarget(selectedPlan);
    const envTargets = flattenEnvelopes(envelopes)
      .map(envelopeWithdrawalTarget)
      .filter((t): t is WithdrawalTarget => !!t);
    return [planTarget, ...envTargets].filter((t): t is WithdrawalTarget => !!t);
  }, [envelopes, selectedPlan]);

  const selectedTarget = targetOptions.find((t) => t.id === selectedTargetId);
  const amountInKobo = withdrawAll
    ? selectedTarget?.balance || 0
    : nairaToKobo(amount);
  const amountIsValid =
    !!selectedTarget &&
    amountInKobo > 0 &&
    amountInKobo <= selectedTarget.balance;

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
    onClose();
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
    else resetAndClose();
  };

  const handleContinue = () => {
    if (step === "plan") {
      if (!selectedPlanId) {
        Toast.show({ type: "error", text1: "Select a plan to continue." });
        return;
      }
      setStep("source");
    } else if (step === "source") {
      if (!selectedTargetId) {
        Toast.show({ type: "error", text1: "Select a withdrawal source." });
        return;
      }
      setStep("amount");
    } else if (step === "amount") {
      if (!amountIsValid) {
        Toast.show({
          type: "error",
          text1: "Invalid amount",
          text2: `Max: ${formatMoney(selectedTarget?.balance || 0)}`,
        });
        return;
      }
      setStep("confirm");
    }
  };

  const handleConfirm = async () => {
    if (!selectedPlan || !selectedTarget || !amountIsValid) return;
    const payload = {
      amount: withdrawAll ? undefined : amountInKobo,
      withdraw_all: withdrawAll,
      idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    try {
      if (selectedTarget.type === "plan") {
        await withdrawPlan({ planId: selectedPlan.id, payload });
      } else {
        await withdrawEnvelope({
          planId: selectedPlan.id,
          envelopeId: selectedTarget.id,
          payload,
        });
      }
      Toast.show({
        type: "success",
        text1: "Withdrawal requested",
        text2: `${formatMoney(amountInKobo, selectedPlan.currency)} will be released.`,
      });
      resetAndClose();
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Withdrawal failed",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try again.",
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={resetAndClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* ── Sheet header ── */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={goBack}
              style={styles.backButton}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-back" size={18} color="#063B2E" />
            </TouchableOpacity>

            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>Withdraw Money</Text>
            </View>

            <TouchableOpacity
              onPress={resetAndClose}
              style={styles.closeButton}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={16} color="#063B2E" />
            </TouchableOpacity>
          </View>

          {/* ── Step bar ── */}
          <StepBar current={step} />

          {/* ── Step content ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* STEP 1 — Pick plan */}
            {step === "plan" && (
              <StepPlan
                plans={plans}
                isLoading={isPlansLoading}
                selectedPlanId={selectedPlanId}
                onSelect={setSelectedPlanId}
              />
            )}

            {/* STEP 2 — Pick source */}
            {step === "source" && (
              <StepSource
                targetOptions={targetOptions}
                isLoading={isEnvelopesLoading}
                selectedTargetId={selectedTargetId}
                onSelect={setSelectedTargetId}
                currency={selectedPlan?.currency}
              />
            )}

            {/* STEP 3 — Enter amount */}
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
                  setWithdrawAll(true);
                  setAmount("");
                }}
              />
            )}

            {/* STEP 4 — Review */}
            {step === "confirm" && (
              <StepConfirm
                selectedPlan={selectedPlan}
                selectedTarget={selectedTarget}
                amountInKobo={amountInKobo}
                withdrawAll={withdrawAll}
              />
            )}
          </ScrollView>

          {/* ── Footer CTA ── */}
          {step !== "confirm" ? (
            <TouchableOpacity
              style={[
                styles.cta,
                ((step === "plan" && !selectedPlanId) ||
                  (step === "source" && !selectedTargetId) ||
                  (step === "amount" && !amountIsValid)) &&
                styles.ctaDisabled,
              ]}
              onPress={handleContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cta, isWithdrawing && styles.ctaDisabled]}
              onPress={handleConfirm}
              disabled={isWithdrawing}
              activeOpacity={0.85}
            >
              {isWithdrawing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Confirm Withdrawal</Text>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
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
  <View style={stepContentStyles.wrap}>
    <Text style={stepContentStyles.heading}>Which plan?</Text>
    <Text style={stepContentStyles.sub}>
      Choose the spending plan you want to withdraw from.
    </Text>

    {isLoading ? (
      <View style={stepContentStyles.loadingRow}>
        <ActivityIndicator color="#063B2E" size="small" />
        <Text style={stepContentStyles.loadingText}>Loading plans…</Text>
      </View>
    ) : plans.length === 0 ? (
      <View style={stepContentStyles.emptyCard}>
        <Ionicons name="folder-open-outline" size={24} color="#9EAAA5" />
        <Text style={stepContentStyles.emptyText}>No plans found.</Text>
      </View>
    ) : (
      <View style={stepContentStyles.list}>
        {plans.map((plan) => {
          const selected = plan.id === selectedPlanId;
          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={0.8}
              onPress={() => onSelect(plan.id)}
              style={[stepContentStyles.row, selected && stepContentStyles.rowActive]}
            >
              <View
                style={[
                  stepContentStyles.rowIcon,
                  selected && stepContentStyles.rowIconActive,
                ]}
              >
                <Ionicons
                  name="layers-outline"
                  size={18}
                  color={selected ? "#FFFFFF" : "#7A8580"}
                />
              </View>

              <View style={stepContentStyles.rowBody}>
                <Text
                  style={[
                    stepContentStyles.rowTitle,
                    selected && stepContentStyles.rowTitleActive,
                  ]}
                  numberOfLines={1}
                >
                  {plan.name}
                </Text>
                <Text
                  style={[
                    stepContentStyles.rowMeta,
                    selected && stepContentStyles.rowMetaActive,
                  ]}
                >
                  {formatMoney(plan.amount, plan.currency)}
                </Text>
              </View>

              <View
                style={[
                  stepContentStyles.radio,
                  selected && stepContentStyles.radioActive,
                ]}
              >
                {selected && (
                  <View style={stepContentStyles.radioDot} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
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
  <View style={stepContentStyles.wrap}>
    <Text style={stepContentStyles.heading}>Which source?</Text>
    <Text style={stepContentStyles.sub}>
      Only unlocked or matured balances are available to withdraw.
    </Text>

    {isLoading ? (
      <View style={stepContentStyles.loadingRow}>
        <ActivityIndicator color="#063B2E" size="small" />
        <Text style={stepContentStyles.loadingText}>Checking sources…</Text>
      </View>
    ) : targetOptions.length === 0 ? (
      <View style={stepContentStyles.lockedCard}>
        <View style={stepContentStyles.lockedIcon}>
          <Ionicons name="lock-closed-outline" size={22} color="#9EAAA5" />
        </View>
        <Text style={stepContentStyles.lockedTitle}>Everything is locked</Text>
        <Text style={stepContentStyles.lockedText}>
          Balances can only be withdrawn when a plan or envelope is flexible or
          has reached its end date.
        </Text>
      </View>
    ) : (
      <View style={stepContentStyles.list}>
        {targetOptions.map((target) => {
          const selected = target.id === selectedTargetId;
          return (
            <TouchableOpacity
              key={`${target.type}-${target.id}`}
              activeOpacity={0.8}
              onPress={() => onSelect(target.id)}
              style={[stepContentStyles.row, selected && stepContentStyles.rowActive]}
            >
              <View
                style={[
                  stepContentStyles.rowIcon,
                  selected && stepContentStyles.rowIconActive,
                ]}
              >
                <Ionicons
                  name={
                    target.type === "plan"
                      ? "layers-outline"
                      : "file-tray-outline"
                  }
                  size={18}
                  color={selected ? "#FFFFFF" : "#7A8580"}
                />
              </View>

              <View style={stepContentStyles.rowBody}>
                <Text
                  style={[
                    stepContentStyles.rowTitle,
                    selected && stepContentStyles.rowTitleActive,
                  ]}
                  numberOfLines={1}
                >
                  {target.label}
                </Text>
                <View style={stepContentStyles.rowTagRow}>
                  <View
                    style={[
                      stepContentStyles.tag,
                      selected && stepContentStyles.tagActive,
                    ]}
                  >
                    <Text
                      style={[
                        stepContentStyles.tagText,
                        selected && stepContentStyles.tagTextActive,
                      ]}
                    >
                      {target.reason}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    stepContentStyles.rowBalance,
                    selected && stepContentStyles.rowBalanceActive,
                  ]}
                >
                  {formatMoney(target.balance, currency)} available
                </Text>
              </View>

              <View
                style={[
                  stepContentStyles.radio,
                  selected && stepContentStyles.radioActive,
                ]}
              >
                {selected && <View style={stepContentStyles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
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
  <View style={stepContentStyles.wrap}>
    <Text style={stepContentStyles.heading}>How much?</Text>
    <Text style={stepContentStyles.sub}>
      Enter the amount you want to withdraw from{" "}
      <Text style={{ fontWeight: "900", color: "#063B2E" }}>
        {selectedTarget?.label ?? "this source"}
      </Text>
      .
    </Text>

    {/* Max available */}
    <View style={amountStyles.maxCard}>
      <Text style={amountStyles.maxLabel}>Available to withdraw</Text>
      <Text style={amountStyles.maxValue}>
        {formatMoney(selectedTarget?.balance || 0, currency)}
      </Text>
    </View>

    {/* Input */}
    <View style={amountStyles.inputWrap}>
      <Text style={amountStyles.currencySymbol}>₦</Text>
      <TextInput
        value={withdrawAll ? "" : amount}
        onChangeText={onChangeAmount}
        onFocus={() => !withdrawAll && undefined}
        editable={!!selectedTarget && !withdrawAll}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="rgba(6,59,46,0.2)"
        style={amountStyles.input}
        autoFocus={!withdrawAll}
      />
    </View>

    {/* Withdraw all toggle */}
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onWithdrawAll}
      style={[amountStyles.allButton, withdrawAll && amountStyles.allButtonActive]}
    >
      <View
        style={[
          amountStyles.allCheck,
          withdrawAll && amountStyles.allCheckActive,
        ]}
      >
        {withdrawAll && (
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        )}
      </View>
      <Text
        style={[
          amountStyles.allText,
          withdrawAll && amountStyles.allTextActive,
        ]}
      >
        Withdraw full amount ({formatMoney(selectedTarget?.balance || 0, currency)})
      </Text>
    </TouchableOpacity>

    {/* Live preview */}
    {amountInKobo > 0 && (
      <View style={amountStyles.preview}>
        <Ionicons name="information-circle-outline" size={15} color="#106B4F" />
        <Text style={amountStyles.previewText}>
          You will withdraw{" "}
          <Text style={{ fontWeight: "900" }}>
            {formatMoney(amountInKobo, currency)}
          </Text>{" "}
          to your vault balance.
        </Text>
      </View>
    )}
  </View>
);

// ─── Step 4: Review ───────────────────────────────────────────────────────────

const StepConfirm = ({
  selectedPlan,
  selectedTarget,
  amountInKobo,
  withdrawAll,
}: {
  selectedPlan?: Plan;
  selectedTarget?: WithdrawalTarget;
  amountInKobo: number;
  withdrawAll: boolean;
}) => (
  <View style={stepContentStyles.wrap}>
    <Text style={stepContentStyles.heading}>Review &amp; confirm</Text>
    <Text style={stepContentStyles.sub}>
      Double-check the details before releasing your funds.
    </Text>

    {/* Summary card */}
    <View style={confirmStyles.summaryCard}>
      <View style={confirmStyles.amountRow}>
        <Text style={confirmStyles.amountLabel}>Withdrawal amount</Text>
        <Text style={confirmStyles.amountValue}>
          {formatMoney(amountInKobo, selectedPlan?.currency)}
        </Text>
        {withdrawAll && (
          <View style={confirmStyles.allBadge}>
            <Text style={confirmStyles.allBadgeText}>Full balance</Text>
          </View>
        )}
      </View>

      <View style={confirmStyles.divider} />

      <View style={confirmStyles.detailRow}>
        <Text style={confirmStyles.detailLabel}>From</Text>
        <Text style={confirmStyles.detailValue} numberOfLines={1}>
          {selectedTarget?.label}
        </Text>
      </View>

      <View style={confirmStyles.detailRow}>
        <Text style={confirmStyles.detailLabel}>Plan</Text>
        <Text style={confirmStyles.detailValue} numberOfLines={1}>
          {selectedPlan?.name}
        </Text>
      </View>

      <View style={confirmStyles.detailRow}>
        <Text style={confirmStyles.detailLabel}>Type</Text>
        <Text style={confirmStyles.detailValue}>
          {selectedTarget?.type === "plan" ? "Plan balance" : "Envelope balance"}
        </Text>
      </View>

      <View style={confirmStyles.detailRow}>
        <Text style={confirmStyles.detailLabel}>To</Text>
        <Text style={confirmStyles.detailValue}>Vault balance</Text>
      </View>
    </View>

    {/* Warning note */}
    <View style={confirmStyles.notice}>
      <Ionicons name="alert-circle-outline" size={15} color="#946500" />
      <Text style={confirmStyles.noticeText}>
        Withdrawals are processed immediately and cannot be reversed.
      </Text>
    </View>
  </View>
);

// ─── Step content shared styles ───────────────────────────────────────────────

const stepContentStyles = StyleSheet.create({
  wrap: { gap: 4 },

  heading: {
    fontSize: 22,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  sub: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9EAAA5",
    lineHeight: 19,
    marginBottom: 22,
  },

  list: { gap: 10 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#FFFFFF",
    padding: 14,
  },

  rowActive: {
    borderColor: "#063B2E",
    backgroundColor: "#F4FAF7",
  },

  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#EDF1EE",
    alignItems: "center",
    justifyContent: "center",
  },

  rowIconActive: {
    backgroundColor: "#063B2E",
  },

  rowBody: { flex: 1, gap: 3 },

  rowTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#063B2E",
  },

  rowTitleActive: { color: "#063B2E" },

  rowMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9EAAA5",
  },

  rowMetaActive: { color: "#7A8580" },

  rowTagRow: { flexDirection: "row", gap: 6, marginTop: 2 },

  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#EDF1EE",
  },

  tagActive: { backgroundColor: "#DFF5EB" },

  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A8580",
    textTransform: "capitalize",
  },

  tagTextActive: { color: "#106B4F" },

  rowBalance: {
    fontSize: 13,
    fontWeight: "900",
    color: "#063B2E",
    marginTop: 2,
  },

  rowBalanceActive: { color: "#106B4F" },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#DDE6E1",
    alignItems: "center",
    justifyContent: "center",
  },

  radioActive: { borderColor: "#063B2E" },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#063B2E",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },

  loadingText: {
    color: "#9EAAA5",
    fontSize: 13,
    fontWeight: "600",
  },

  emptyCard: {
    backgroundColor: "#F4F7F5",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },

  emptyText: {
    color: "#9EAAA5",
    fontSize: 13,
    fontWeight: "600",
  },

  lockedCard: {
    backgroundColor: "#F4F7F5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    padding: 24,
    alignItems: "center",
    gap: 10,
  },

  lockedIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    marginBottom: 4,
  },

  lockedTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#063B2E",
  },

  lockedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9EAAA5",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
});

// ─── Amount step styles ───────────────────────────────────────────────────────

const amountStyles = StyleSheet.create({
  maxCard: {
    backgroundColor: "#EAF7F1",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CDEDE0",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
    gap: 4,
  },

  maxLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7A8580",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  maxValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -0.5,
  },

  inputWrap: {
    height: 80,
    borderRadius: 20,
    backgroundColor: "#F4F7F5",
    borderWidth: 1.5,
    borderColor: "#DDE6E1",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },

  currencySymbol: {
    fontSize: 28,
    fontWeight: "900",
    color: "rgba(6,59,46,0.25)",
    marginRight: 6,
  },

  input: {
    flex: 1,
    fontSize: 36,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -1,
    paddingVertical: 0,
  },

  allButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },

  allButtonActive: {
    borderColor: "#063B2E",
    backgroundColor: "#F4FAF7",
  },

  allCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#DDE6E1",
    alignItems: "center",
    justifyContent: "center",
  },

  allCheckActive: {
    backgroundColor: "#063B2E",
    borderColor: "#063B2E",
  },

  allText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9EAAA5",
    flex: 1,
  },

  allTextActive: {
    color: "#063B2E",
    fontWeight: "800",
  },

  preview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EAF7F1",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CDEDE0",
    padding: 12,
  },

  previewText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#106B4F",
    lineHeight: 19,
  },
});

// ─── Confirm step styles ──────────────────────────────────────────────────────

const confirmStyles = StyleSheet.create({
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    overflow: "hidden",
    marginBottom: 14,
  },

  amountRow: {
    padding: 20,
    gap: 6,
    alignItems: "flex-start",
  },

  amountLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9EAAA5",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  amountValue: {
    fontSize: 34,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -1,
  },

  allBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EAF7F1",
    borderWidth: 1,
    borderColor: "#CDEDE0",
  },

  allBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#106B4F",
  },

  divider: {
    height: 1,
    backgroundColor: "#F0F4F2",
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F2",
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9EAAA5",
  },

  detailValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#063B2E",
    maxWidth: 200,
    textAlign: "right",
  },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEE",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F2E4A8",
    padding: 12,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#946500",
    lineHeight: 18,
  },
});

// ─── Sheet styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  sheet: {
    maxHeight: "92%",
    backgroundColor: "#F0F4F2",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },

  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#DDE6E1",
    alignSelf: "center",
    marginBottom: 20,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetTitleWrap: { flex: 1, alignItems: "center" },

  sheetTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -0.2,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingBottom: 16,
  },

  cta: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#063B2E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    shadowColor: "#063B2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },

  ctaDisabled: {
    opacity: 0.4,
  },

  ctaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});

export default WithdrawalModal;
