
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

type Step = "plan" | "source" | "amount" | "destination" | "confirm";
type DestinationSelection = {
  type: "account" | "beneficiary";
  id: string;
  label: string;
  bank: string;
  accountNumber: string;
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
    reason: matured ? "Reached end date" : "Flexible balance",
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
    reason: matured ? "Reached end date" : "Flexible balance",
    envelope,
  };
};

const maskAccountNumber = (value: string) =>
  value.length > 4 ? `**${value.slice(-4)}` : value;

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

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: Step[] = ["plan", "source", "amount", "destination", "confirm"];
const STEP_LABELS: Record<Step, string> = {
  plan: "Plan",
  source: "Source",
  amount: "Amount",
  destination: "To",
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
  const [selectedDestinationKey, setSelectedDestinationKey] = useState<string>();
  const [withdrawalPin, setWithdrawalPin] = useState("");
  const [newWithdrawalPin, setNewWithdrawalPin] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [pinMode, setPinMode] = useState<"enter" | "reset">("enter");

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
      ...beneficiaries.map((account) =>
        mapDestination(account, "beneficiary")
      ),
    ],
    [bankAccounts, beneficiaries]
  );
  const selectedDestination = destinationOptions.find(
    (destination) =>
      `${destination.type}:${destination.id}` === selectedDestinationKey
  );
  const amountInKobo = withdrawAll
    ? selectedTarget?.balance || 0
    : nairaToKobo(amount);
  const amountIsValid =
    !!selectedTarget &&
    amountInKobo > 0 &&
    amountInKobo <= selectedTarget.balance;
  const hasWithdrawalPin = !!pinStatus?.has_pin;
  const pinToSubmit = hasWithdrawalPin ? withdrawalPin : newWithdrawalPin;
  const pinIsValid = /^\d{4}$/.test(pinToSubmit);
  const canConfirmWithdrawal =
    !!selectedPlan &&
    !!selectedTarget &&
    !!selectedDestination &&
    amountIsValid &&
    !isPinStatusLoading &&
    pinMode === "enter" &&
    pinIsValid;

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
      setStep("destination");
    } else if (step === "destination") {
      if (!selectedDestination) {
        Toast.show({ type: "error", text1: "Select a destination account." });
        return;
      }
      setStep("confirm");
    }
  };

  const handleConfirm = async () => {
    if (!canConfirmWithdrawal || !selectedPlan || !selectedTarget || !selectedDestination) return;

    if (!hasWithdrawalPin) {
      try {
        await saveWithdrawalPin(newWithdrawalPin);
      } catch (error: any) {
        Toast.show({
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
      idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    try {
      await requestWithdrawal({ planId: selectedPlan.id, payload });
      Toast.show({
        type: "success",
        text1: "Withdrawal requested",
        text2: `${formatMoney(amountInKobo, selectedPlan.currency)} is being sent.`,
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
                  setWithdrawAll(!withdrawAll);
                  setAmount("");
                }}
              />
            )}

            {/* STEP 4 — Pick destination */}
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

            {/* STEP 4 — Review */}
            {step === "confirm" && (
              <StepConfirm
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
                    Toast.show({
                      type: "success",
                      text1: "OTP sent",
                      text2: "Check your email for the reset code.",
                    });
                  } catch (error: any) {
                    Toast.show({
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
                    Toast.show({
                      type: "success",
                      text1: "PIN reset",
                      text2: "You can now confirm this withdrawal.",
                    });
                  } catch (error: any) {
                    Toast.show({
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
          {step !== "confirm" ? (
            <TouchableOpacity
              style={[
                styles.cta,
                ((step === "plan" && !selectedPlanId) ||
                  (step === "source" && !selectedTargetId) ||
                  (step === "amount" && !amountIsValid) ||
                  (step === "destination" && !selectedDestination)) &&
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
              style={[
                styles.cta,
                (isWithdrawing || isSettingPin || !canConfirmWithdrawal) &&
                styles.ctaDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isWithdrawing || isSettingPin || !canConfirmWithdrawal}
              activeOpacity={0.85}
            >
              {isWithdrawing || isSettingPin ? (
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
        onFocus={() => {
          if (withdrawAll) onChangeAmount(amount);
        }}
        editable={!!selectedTarget}
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
          </Text>
          .
        </Text>
      </View>
    )}
  </View>
);

// ─── Step 4: Review ───────────────────────────────────────────────────────────

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

  const selectedBank = banks.find((bank) => bank.code === selectedBankCode);
  const filteredDestinations = destinationOptions.filter((destination) => {
    const query = destinationSearch.trim().toLowerCase();
    if (!query) return true;

    return [
      destination.label,
      destination.bank,
      destination.accountNumber,
      destination.type,
    ].some((value) => value.toLowerCase().includes(query));
  });
  const filteredBanks = banks.filter((bank) => {
    const query = bankSearch.trim().toLowerCase();
    if (!query) return true;

    return [bank.name, bank.code, bank.slug]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });

  const handleResolve = async () => {
    if (!selectedBankCode || accountNumber.length < 10) {
      Toast.show({ type: "error", text1: "Enter bank and account number" });
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
      Toast.show({
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

      Toast.show({ type: "success", text1: "Account saved" });
      setShowAdd(false);
      setAccountNumber("");
      setNickname("");
      setResolved(undefined);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Could not save account",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try again.",
      });
    }
  };

  return (
    <View style={stepContentStyles.wrap}>
      <Text style={stepContentStyles.heading}>Send to where?</Text>
      <Text style={stepContentStyles.sub}>
        Choose a verified account or add a new one before confirming.
      </Text>

      {isLoading ? (
        <View style={stepContentStyles.loadingRow}>
          <ActivityIndicator color="#063B2E" size="small" />
          <Text style={stepContentStyles.loadingText}>Loading accounts...</Text>
        </View>
      ) : null}

      {destinationOptions.length > 0 ? (
        <View style={stepContentStyles.list}>
          <View style={destinationStyles.searchBox}>
            <Ionicons name="search" size={16} color="#7A8580" />
            <TextInput
              value={destinationSearch}
              onChangeText={setDestinationSearch}
              placeholder="Search saved accounts"
              placeholderTextColor="#9EAAA5"
              style={destinationStyles.searchInput}
            />
          </View>

          {filteredDestinations.length === 0 ? (
            <View style={stepContentStyles.emptyCard}>
              <Ionicons name="search-outline" size={24} color="#9EAAA5" />
              <Text style={stepContentStyles.emptyText}>No matching account.</Text>
            </View>
          ) : null}

          {filteredDestinations.map((destination) => {
            const key = `${destination.type}:${destination.id}`;
            const selected = key === selectedDestinationKey;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.8}
                onPress={() => onSelect(key)}
                style={[
                  stepContentStyles.row,
                  selected && stepContentStyles.rowActive,
                ]}
              >
                <View
                  style={[
                    stepContentStyles.rowIcon,
                    selected && stepContentStyles.rowIconActive,
                  ]}
                >
                  <Ionicons
                    name={
                      destination.type === "account"
                        ? "card-outline"
                        : "person-outline"
                    }
                    size={18}
                    color={selected ? "#FFFFFF" : "#7A8580"}
                  />
                </View>

                <View style={stepContentStyles.rowBody}>
                  <Text style={stepContentStyles.rowTitle} numberOfLines={1}>
                    {destination.label}
                  </Text>
                  <Text style={stepContentStyles.rowMeta}>
                    {destination.bank} - {maskAccountNumber(destination.accountNumber)}
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
      ) : !isLoading ? (
        <View style={stepContentStyles.emptyCard}>
          <Ionicons name="card-outline" size={24} color="#9EAAA5" />
          <Text style={stepContentStyles.emptyText}>No saved accounts yet.</Text>
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.8}
        style={destinationStyles.addToggle}
        onPress={() => setShowAdd((prev) => !prev)}
      >
        <Ionicons name={showAdd ? "remove" : "add"} size={16} color="#063B2E" />
        <Text style={destinationStyles.addToggleText}>
          {showAdd ? "Hide new account" : "Add account"}
        </Text>
      </TouchableOpacity>

      {showAdd ? (
        <View style={destinationStyles.form}>
          <View style={destinationStyles.segment}>
            {(["account", "beneficiary"] as const).map((option) => (
              <TouchableOpacity
                key={option}
                activeOpacity={0.8}
                onPress={() => setSaveAs(option)}
                style={[
                  destinationStyles.segmentItem,
                  saveAs === option && destinationStyles.segmentItemActive,
                ]}
              >
                <Text
                  style={[
                    destinationStyles.segmentText,
                    saveAs === option && destinationStyles.segmentTextActive,
                  ]}
                >
                  {option === "account" ? "My account" : "Beneficiary"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={destinationStyles.label}>Bank</Text>
          <View style={destinationStyles.searchBox}>
            <Ionicons name="search" size={16} color="#7A8580" />
            <TextInput
              value={bankSearch}
              onChangeText={setBankSearch}
              placeholder="Search bank by name"
              placeholderTextColor="#9EAAA5"
              style={destinationStyles.searchInput}
            />
          </View>
          <ScrollView
            style={destinationStyles.bankScroll}
            contentContainerStyle={destinationStyles.bankList}
            nestedScrollEnabled
          >
            {filteredBanks.slice(0, 30).map((bank) => {
              const selected = bank.code === selectedBankCode;
              return (
                <TouchableOpacity
                  key={bank.code + bank.name}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedBankCode(bank.code);
                    setResolved(undefined);
                  }}
                  style={[
                    destinationStyles.bankChip,
                    selected && destinationStyles.bankChipActive,
                  ]}
                >
                  <Text
                    style={[
                      destinationStyles.bankChipText,
                      selected && destinationStyles.bankChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {bank.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {filteredBanks.length === 0 ? (
              <Text style={destinationStyles.noBankText}>No matching bank.</Text>
            ) : null}
          </ScrollView>

          <Text style={destinationStyles.label}>Account number</Text>
          <TextInput
            value={accountNumber}
            onChangeText={(value) => {
              setAccountNumber(value.replace(/[^0-9]/g, "").slice(0, 10));
              setResolved(undefined);
            }}
            keyboardType="number-pad"
            placeholder="0123456789"
            placeholderTextColor="#9EAAA5"
            style={destinationStyles.input}
          />

          <Text style={destinationStyles.label}>Nickname</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="Optional"
            placeholderTextColor="#9EAAA5"
            style={destinationStyles.input}
          />

          {resolved ? (
            <View style={destinationStyles.resolvedBox}>
              <Ionicons name="checkmark-circle" size={18} color="#106B4F" />
              <Text style={destinationStyles.resolvedText}>
                {resolved.account_name}
              </Text>
            </View>
          ) : null}

          <View style={destinationStyles.formActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleResolve}
              disabled={isResolving}
              style={destinationStyles.secondaryButton}
            >
              <Text style={destinationStyles.secondaryButtonText}>
                {isResolving ? "Verifying..." : "Verify"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={!resolved || isSaving}
              style={[
                destinationStyles.saveButton,
                (!resolved || isSaving) && styles.ctaDisabled,
              ]}
            >
              <Text style={destinationStyles.saveButtonText}>
                {isSaving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const StepConfirm = ({
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
  onChangeWithdrawalPin: (value: string) => void;
  onChangeNewWithdrawalPin: (value: string) => void;
  onChangeResetOtp: (value: string) => void;
  onForgotPin: () => void;
  onResetPin: () => void;
  onCancelReset: () => void;
}) => {
  const cleanPin = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 4);
  const cleanOtp = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 6);
  const resetReady = resetOtp.length === 6 && newWithdrawalPin.length === 4;

  return (
    <View style={stepContentStyles.wrap}>
      <Text style={stepContentStyles.heading}>Review &amp; confirm</Text>
      <Text style={stepContentStyles.sub}>
        Double-check the details before releasing your funds.
      </Text>

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
          <Text style={confirmStyles.detailValue} numberOfLines={1}>
            {selectedDestination
              ? `${selectedDestination.label} - ${maskAccountNumber(
                selectedDestination.accountNumber
              )}`
              : "Account"}
          </Text>
        </View>
      </View>

      <View style={pinStyles.card}>
        <View style={pinStyles.header}>
          <View style={pinStyles.icon}>
            <Ionicons name="keypad-outline" size={18} color="#063B2E" />
          </View>
          <View style={pinStyles.headerText}>
            <Text style={pinStyles.title}>
              {isPinStatusLoading
                ? "Checking PIN"
                : hasWithdrawalPin
                  ? "Withdrawal PIN"
                  : "Create withdrawal PIN"}
            </Text>
            <Text style={pinStyles.subtitle}>
              {isPinStatusLoading
                ? "Please wait while we confirm your security settings."
                : hasWithdrawalPin
                ? "Enter your 4-digit PIN to approve this withdrawal."
                : "Set a 4-digit PIN before confirming this withdrawal."}
            </Text>
          </View>
        </View>

        {isPinStatusLoading ? (
          <View style={stepContentStyles.loadingRow}>
            <ActivityIndicator color="#063B2E" size="small" />
            <Text style={stepContentStyles.loadingText}>Checking PIN status...</Text>
          </View>
        ) : pinMode === "reset" ? (
          <View style={pinStyles.form}>
            <TextInput
              value={resetOtp}
              onChangeText={(value) => onChangeResetOtp(cleanOtp(value))}
              keyboardType="number-pad"
              placeholder="Email OTP"
              placeholderTextColor="#9EAAA5"
              style={pinStyles.input}
              maxLength={6}
            />
            <TextInput
              value={newWithdrawalPin}
              onChangeText={(value) => onChangeNewWithdrawalPin(cleanPin(value))}
              keyboardType="number-pad"
              placeholder="New 4-digit PIN"
              placeholderTextColor="#9EAAA5"
              secureTextEntry
              style={pinStyles.input}
              maxLength={4}
            />
            <View style={pinStyles.actions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onCancelReset}
                style={pinStyles.secondaryButton}
              >
                <Text style={pinStyles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onResetPin}
                disabled={!resetReady || isResettingPin}
                style={[
                  pinStyles.primaryButton,
                  (!resetReady || isResettingPin) && styles.ctaDisabled,
                ]}
              >
                <Text style={pinStyles.primaryButtonText}>
                  {isResettingPin ? "Resetting..." : "Reset PIN"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={pinStyles.form}>
            <TextInput
              value={hasWithdrawalPin ? withdrawalPin : newWithdrawalPin}
              onChangeText={(value) =>
                hasWithdrawalPin
                  ? onChangeWithdrawalPin(cleanPin(value))
                  : onChangeNewWithdrawalPin(cleanPin(value))
              }
              keyboardType="number-pad"
              placeholder="4-digit PIN"
              placeholderTextColor="#9EAAA5"
              secureTextEntry
              style={pinStyles.input}
              maxLength={4}
            />
            {hasWithdrawalPin ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onForgotPin}
                disabled={isSendingPinOtp}
                style={pinStyles.linkButton}
              >
                <Text style={pinStyles.linkText}>
                  {isSendingPinOtp ? "Sending OTP..." : "Forgot PIN?"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>

      <View style={confirmStyles.notice}>
        <Ionicons name="alert-circle-outline" size={15} color="#946500" />
        <Text style={confirmStyles.noticeText}>
          Withdrawals are processed immediately and cannot be reversed.
        </Text>
      </View>
    </View>
  );
};

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

const destinationStyles = StyleSheet.create({
  searchBox: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },

  searchInput: {
    flex: 1,
    color: "#063B2E",
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
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
  },

  addToggleText: {
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "800",
  },

  form: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 10,
  },

  segment: {
    flexDirection: "row",
    backgroundColor: "#F4F7F5",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },

  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  segmentItemActive: {
    backgroundColor: "#063B2E",
  },

  segmentText: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "800",
  },

  segmentTextActive: {
    color: "#FFFFFF",
  },

  label: {
    color: "#7A8580",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },

  bankScroll: {
    maxHeight: 186,
  },

  bankList: {
    gap: 8,
  },

  bankChip: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#F4F7F5",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  bankChipActive: {
    borderColor: "#063B2E",
    backgroundColor: "#EAF7F1",
  },

  bankChipText: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "700",
  },

  bankChipTextActive: {
    color: "#063B2E",
    fontWeight: "900",
  },

  noBankText: {
    color: "#9EAAA5",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 10,
  },

  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#F4F7F5",
    color: "#063B2E",
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 14,
  },

  resolvedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CDEDE0",
    backgroundColor: "#EAF7F1",
    padding: 12,
  },

  resolvedText: {
    color: "#106B4F",
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
  },

  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F4F7F5",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "900",
  },

  saveButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#106B4F",
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});

// ─── Confirm step styles ──────────────────────────────────────────────────────

const pinStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    padding: 14,
    gap: 14,
    marginBottom: 14,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#EAF7F1",
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    gap: 3,
  },

  title: {
    color: "#063B2E",
    fontSize: 14,
    fontWeight: "900",
  },

  subtitle: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },

  form: {
    gap: 10,
  },

  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    backgroundColor: "#F4F7F5",
    color: "#063B2E",
    fontSize: 16,
    fontWeight: "900",
    paddingHorizontal: 14,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },

  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F4F7F5",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "900",
  },

  primaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#106B4F",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  linkButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },

  linkText: {
    color: "#106B4F",
    fontSize: 13,
    fontWeight: "900",
  },
});

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
