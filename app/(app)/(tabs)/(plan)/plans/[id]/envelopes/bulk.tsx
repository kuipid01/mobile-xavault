import { createEnvelope } from "@/api/envelopes";
import { koboToNaira, nairaToKobo } from "@/api/money";
import { useEnvelopes } from "@/hooks/app/envelopes";
import { usePlan } from "@/hooks/app/plans";
import { useActiveSubscription } from "@/hooks/app/subscription";
import { useSubscriptionLimitModal } from "@/hooks/use-subscription-limit-modal";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const normalizeDate = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const today = normalizeDate(new Date());

const parseApiDate = (value?: string | null) => {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  return normalizeDate(new Date(year, month - 1, day));
};

const formatDateForApi = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
};

const formatDateShort = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-NG").format(value);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86400000);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return normalizeDate(next);
};

const buildEqualSlices = (
  count: number,
  startDate: Date,
  endDate: Date | null
): TimeSlice[] => {
  if (!endDate || count <= 0) {
    return Array.from({ length: Math.max(count, 1) }, () => ({
      startDate,
      endDate: addDays(startDate, 7),
    }));
  }

  const totalDays = Math.max(daysBetween(startDate, endDate) + 1, 1);
  const sliceDays = Math.floor(totalDays / count);
  const remainder = totalDays % count;

  let currentStart = new Date(startDate);

  return Array.from({ length: count }, (_, i) => {
    const extra = i < remainder ? 1 : 0;
    const duration = sliceDays + extra;
    const currentEnd = addDays(currentStart, Math.max(duration - 1, 0));

    const slice = {
      startDate: new Date(currentStart),
      endDate: currentEnd > endDate ? new Date(endDate) : new Date(currentEnd),
    };

    currentStart = addDays(currentEnd, 1);
    return slice;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type EnvelopeDraft = {
  name: string;
  amountKobo: number;
  startDate: Date;
  endDate: Date;
};

type TimeSlice = {
  startDate: Date;
  endDate: Date;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateBulkEnvelopesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === "string" ? id : "";

  const { data: plan, isLoading: isPlanLoading } = usePlan(planId);
  const { data: existingEnvelopes = [] } = useEnvelopes(planId);
  const { data: subscription } = useActiveSubscription({ enabled: true });
  const { showSubscriptionLimitModal } = useSubscriptionLimitModal();

  // ───────────────────────────────────────────────────────────────────────────
  // Plan data
  // ───────────────────────────────────────────────────────────────────────────

  const planStartDate = useMemo(
    () => parseApiDate(plan?.start_date),
    [plan?.start_date]
  );

  const planEndDate = useMemo(
    () => parseApiDate(plan?.end_date),
    [plan?.end_date]
  );

  const planAmountNaira = koboToNaira(plan?.amount);
  const allocatedNaira = koboToNaira(plan?.top_level_allocated);

  const remainingPlanBalance = Math.max(
    planAmountNaira - allocatedNaira,
    0
  );

  // -1 means unlimited
  const maxEnvelopesAllowed =
    subscription?.plan?.MaxFlexibleEnvelopes ?? 2;

  const isUnlimitedEnvelopes = maxEnvelopesAllowed === -1;

  const remainingSlots = isUnlimitedEnvelopes
    ? Infinity
    : Math.max(
      maxEnvelopesAllowed - existingEnvelopes.length,
      0
    );

  // ───────────────────────────────────────────────────────────────────────────
  // Existing envelopes / remaining duration
  // ───────────────────────────────────────────────────────────────────────────

  const latestEnvelopeEnd = useMemo(() => {
    if (!existingEnvelopes.length) return null;

    return existingEnvelopes.reduce<Date | null>(
      (latest, env) => {
        const end = parseApiDate(env.end_date);

        if (!end) return latest;

        return !latest || end > latest ? end : latest;
      },
      null
    );
  }, [existingEnvelopes]);

  const remainingDurationStart = useMemo(() => {
    if (latestEnvelopeEnd) {
      return addDays(latestEnvelopeEnd, 1);
    }

    return planStartDate || today;
  }, [latestEnvelopeEnd, planStartDate]);

  const remainingDays = useMemo(() => {
    if (!planEndDate) return 0;

    return Math.max(
      daysBetween(remainingDurationStart, planEndDate) + 1,
      0
    );
  }, [remainingDurationStart, planEndDate]);

  // ───────────────────────────────────────────────────────────────────────────
  // Wizard state
  // ───────────────────────────────────────────────────────────────────────────

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [envelopeCount, setEnvelopeCount] = useState(2);

  const [amounts, setAmounts] = useState<number[]>(() =>
    Array(2)
      .fill(0)
      .map(() =>
        Math.floor(
          nairaToKobo(remainingPlanBalance) / 2
        )
      )
  );

  const [timeSlices, setTimeSlices] = useState<TimeSlice[]>(() =>
    buildEqualSlices(
      2,
      remainingDurationStart,
      planEndDate
    )
  );

  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: 2 }, (_, i) => `Envelope ${i + 1}`)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // Sync arrays
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setAmounts((prev) => {
      const next = [...prev];

      while (next.length < envelopeCount) {
        next.push(0);
      }

      return next.slice(0, envelopeCount);
    });

    setTimeSlices(() =>
      buildEqualSlices(
        envelopeCount,
        remainingDurationStart,
        planEndDate
      )
    );

    setNames((prev) => {
      const next = [...prev];

      while (next.length < envelopeCount) {
        next.push(`Envelope ${next.length + 1}`);
      }

      return next.slice(0, envelopeCount);
    });
  }, [
    envelopeCount,
    remainingDays,
    remainingDurationStart,
    planEndDate,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Amount calculations
  // ───────────────────────────────────────────────────────────────────────────

  const totalEditedKobo = useMemo(
    () =>
      amounts
        .slice(0, Math.max(envelopeCount - 1, 0))
        .reduce((sum, value) => sum + value, 0),
    [amounts, envelopeCount]
  );

  const totalAvailableKobo = nairaToKobo(remainingPlanBalance);

  const lastAmountKobo = useMemo(
    () =>
      Math.max(
        totalAvailableKobo - totalEditedKobo,
        0
      ),
    [totalAvailableKobo, totalEditedKobo]
  );

  const lastAmountNegative = totalEditedKobo > totalAvailableKobo;

  const setAmount = useCallback((index: number, value: number) => {
    setAmounts((prev) => {
      const next = [...prev];
      next[index] = Math.max(value, 0);
      return next;
    });
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Time helpers
  // ───────────────────────────────────────────────────────────────────────────

  const setTimeSlice = useCallback(
    (index: number, patch: Partial<TimeSlice>) => {
      setTimeSlices((prev) => {
        const next = [...prev];

        if (!next[index]) return prev;

        next[index] = {
          ...next[index],
          ...patch,
        };

        return next;
      });
    },
    []
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Name helpers
  // ───────────────────────────────────────────────────────────────────────────

  const setName = useCallback((index: number, value: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Drafts
  // ───────────────────────────────────────────────────────────────────────────

  const drafts: EnvelopeDraft[] = useMemo(
    () =>
      Array.from({ length: envelopeCount }, (_, i) => ({
        name: names[i] || `Envelope ${i + 1}`,
        amountKobo:
          i === envelopeCount - 1
            ? lastAmountKobo
            : amounts[i] || 0,
        startDate: timeSlices[i]?.startDate || today,
        endDate: timeSlices[i]?.endDate || addDays(today, 7),
      })),
    [
      envelopeCount,
      names,
      amounts,
      lastAmountKobo,
      timeSlices,
    ]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Validation
  // ───────────────────────────────────────────────────────────────────────────

  const canSubmit = useMemo(() => {
    if (!planEndDate) return false;

    for (let i = 0; i < envelopeCount; i++) {
      const draft = drafts[i];

      if (!draft.name.trim()) return false;
      if (draft.amountKobo <= 0) return false;
      if (draft.startDate < today) return false;
      if (draft.endDate < draft.startDate) return false;
      if (draft.endDate > planEndDate) return false;
    }

    return !lastAmountNegative && !isSubmitting;
  }, [
    drafts,
    envelopeCount,
    lastAmountNegative,
    isSubmitting,
    planEndDate,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Submit
  // ───────────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    let created = 0;
    let failed = 0;

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];

      try {
        await createEnvelope(planId, {
          name: draft.name.trim(),
          amount: draft.amountKobo,
          start_date: formatDateForApi(draft.startDate),
          end_date: formatDateForApi(draft.endDate),
          unboxed_balance_policy: "flexible",
        });

        created++;
      } catch (error: any) {
        failed++;

        if (
          showSubscriptionLimitModal("envelope_create", error)
        ) {
          break;
        }
      }
    }

    setIsSubmitting(false);

    if (created > 0) {
      Toast.show({
        type: "success",
        text1: `${created} envelope${created === 1 ? "" : "s"} created`,
        text2: failed > 0 ? `${failed} failed` : undefined,
      });

      router.back();
    } else {
      Toast.show({
        type: "error",
        text1: "Could not create envelopes",
        text2: "Please try again.",
      });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Navigation
  // ───────────────────────────────────────────────────────────────────────────

  const nextStep = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.Presets.easeInEaseOut
    );

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      if (lastAmountNegative) {
        Toast.show({
          type: "error",
          text1: "Amount is too high",
          text2: "Reduce the amount in one of the envelopes.",
        });
        return;
      }

      setStep(3);
      return;
    }

    if (step === 3) {
      setStep(4);
      return;
    }
  };

  const previousStep = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.Presets.easeInEaseOut
    );

    if (step === 1) {
      router.back();
      return;
    }

    setStep((step - 1) as 1 | 2 | 3 | 4);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Animations
  // ───────────────────────────────────────────────────────────────────────────

  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 340,
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 340,
        useNativeDriver: true,
      }),
    ]).start();
  }, [formAnim, headerAnim]);

  const enterStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Loading
  // ───────────────────────────────────────────────────────────────────────────

  if (isPlanLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color="#063B2E" />
        </View>
      </View>
    );
  }

  const existingUsedKobo = existingEnvelopes.reduce(
    (sum, envelope) => sum + (envelope.amount || 0),
    0
  );

  const allocationPercentage =
    totalAvailableKobo > 0
      ? clamp(
        (totalEditedKobo / totalAvailableKobo) * 100,
        0,
        100
      )
      : 0;

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {/* Header */}
        <Animated.View style={[styles.header, enterStyle(headerAnim)]}>
          <TouchableOpacity
            onPress={previousStep}
            activeOpacity={0.75}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={21} color="#063B2E" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>CREATE ENVELOPES</Text>
            <Text style={styles.title}>Divide your plan</Text>
            <Text style={styles.subtitle}>
              Organise the money in {plan?.name || "this plan"} into separate
              envelopes.
            </Text>
          </View>
        </Animated.View>

        {/* Progress */}
        <Animated.View style={[styles.progressWrap, enterStyle(formAnim)]}>
          {[1, 2, 3, 4].map((item, index) => {
            const active = item <= step;

            return (
              <View key={item} style={styles.progressItem}>
                <View
                  style={[
                    styles.progressDot,
                    active && styles.progressDotActive,
                  ]}
                >
                  {item < step ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.progressNumber,
                        active && styles.progressNumberActive,
                      ]}
                    >
                      {item}
                    </Text>
                  )}
                </View>

                {index < 3 && (
                  <View
                    style={[
                      styles.progressLine,
                      item < step && styles.progressLineActive,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </Animated.View>

        {/* Plan summary */}
        <Animated.View style={[styles.contextCard, enterStyle(formAnim)]}>
          <View style={styles.contextTop}>
            <View>
              <Text style={styles.contextLabel}>PLAN</Text>
              <Text style={styles.contextPlanName} numberOfLines={1}>
                {plan?.name || "Current plan"}
              </Text>
            </View>

            <View style={styles.availableBadge}>
              <Text style={styles.availableBadgeText}>
                ₦{formatNumber(remainingPlanBalance)} available
              </Text>
            </View>
          </View>

          <View style={styles.contextDivider} />

          <View style={styles.contextStats}>
            <View>
              <Text style={styles.contextStatLabel}>PLAN TOTAL</Text>
              <Text style={styles.contextStatValue}>
                ₦{formatNumber(planAmountNaira)}
              </Text>
            </View>

            <View>
              <Text style={styles.contextStatLabel}>REMAINING</Text>
              <Text style={styles.contextStatValue}>
                {remainingDays} days
              </Text>
            </View>
          </View>

          <View style={styles.contextBar}>
            <View
              style={[
                styles.contextBarFill,
                {
                  width: `${clamp(
                    planAmountNaira > 0
                      ? (allocatedNaira / planAmountNaira) * 100
                      : 0,
                    0,
                    100
                  )}%`,
                },
              ]}
            />
          </View>
        </Animated.View>

        {/* Existing envelopes */}
        {existingEnvelopes.length > 0 && (
          <View style={styles.existingCard}>
            <View style={styles.existingTop}>
              <View style={styles.existingIcon}>
                <Ionicons name="layers-outline" size={17} color="#063B2E" />
              </View>

              <View style={styles.existingCopy}>
                <Text style={styles.existingTitle}>
                  {existingEnvelopes.length} existing envelope
                  {existingEnvelopes.length === 1 ? "" : "s"}
                </Text>

                <Text style={styles.existingDetail}>
                  ₦{formatNumber(koboToNaira(existingUsedKobo))} already
                  allocated
                </Text>
              </View>
            </View>

            {latestEnvelopeEnd && (
              <View style={styles.existingFooter}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color="#7A8580"
                />
                <Text style={styles.existingFooterText}>
                  Latest envelope ends {formatDateShort(latestEnvelopeEnd)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>STEP 1 OF 4</Text>
                <Text style={styles.cardTitle}>How many envelopes?</Text>
                <Text style={styles.cardHint}>
                  Decide how you want to divide this plan.
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Ionicons name="layers-outline" size={20} color="#063B2E" />
              </View>
            </View>

            <View style={styles.counter}>
              <TouchableOpacity
                style={[
                  styles.counterButton,
                  envelopeCount <= 1 && styles.counterButtonDisabled,
                ]}
                disabled={envelopeCount <= 1}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut
                  );
                  setEnvelopeCount(Math.max(1, envelopeCount - 1));
                }}
              >
                <Ionicons
                  name="remove"
                  size={22}
                  color={envelopeCount <= 1 ? "#B8C2BE" : "#063B2E"}
                />
              </TouchableOpacity>

              <View style={styles.counterValue}>
                <Text style={styles.counterNumber}>{envelopeCount}</Text>
                <Text style={styles.counterLabel}>
                  {envelopeCount === 1 ? "envelope" : "envelopes"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut
                  );
                  setEnvelopeCount((current) =>
                    isUnlimitedEnvelopes
                      ? current + 1
                      : Math.min(remainingSlots, current + 1)
                  );
                }}
                disabled={
                  !isUnlimitedEnvelopes && envelopeCount >= remainingSlots
                }
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={
                    !isUnlimitedEnvelopes && envelopeCount >= remainingSlots
                      ? "#B8C2BE"
                      : "#063B2E"
                  }
                />
              </TouchableOpacity>
            </View>

            <View style={styles.infoMessage}>
              <Ionicons
                name={
                  isUnlimitedEnvelopes
                    ? "infinite-outline"
                    : "information-circle-outline"
                }
                size={17}
                color="#106B4F"
              />

              <Text style={styles.infoText}>
                {isUnlimitedEnvelopes
                  ? "Your plan has unlimited flexible envelopes."
                  : `${remainingSlots} envelope${remainingSlots === 1 ? "" : "s"
                  } available on your plan.`}
              </Text>
            </View>
          </View>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>STEP 2 OF 4</Text>
                <Text style={styles.cardTitle}>Allocate the money</Text>
                <Text style={styles.cardHint}>
                  Set each amount. The final envelope gets what's left.
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Ionicons name="cash-outline" size={20} color="#063B2E" />
              </View>
            </View>

            <View style={styles.allocationSummary}>
              <View style={styles.allocationSummaryTop}>
                <View>
                  <Text style={styles.allocationLabel}>ALLOCATING</Text>
                  <Text style={styles.allocationAmount}>
                    ₦
                    {formatNumber(
                      koboToNaira(totalEditedKobo + lastAmountKobo)
                    )}
                  </Text>
                </View>

                <View style={styles.remainingAmountWrap}>
                  <Text style={styles.allocationLabel}>REMAINING</Text>
                  <Text
                    style={[
                      styles.remainingAmount,
                      lastAmountNegative && styles.remainingAmountError,
                    ]}
                  >
                    ₦
                    {formatNumber(
                      Math.max(
                        remainingPlanBalance - koboToNaira(totalEditedKobo),
                        0
                      )
                    )}
                  </Text>
                </View>
              </View>

              <View style={styles.allocationBar}>
                <View
                  style={[
                    styles.allocationBarFill,
                    { width: `${allocationPercentage}%` },
                  ]}
                />
              </View>
            </View>

            {Array.from({ length: envelopeCount }, (_, i) => {
              const isLast = i === envelopeCount - 1;
              const valKobo = isLast ? lastAmountKobo : amounts[i] || 0;
              const valNaira = koboToNaira(valKobo);

              return (
                <View key={i} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Envelope {i + 1} Amount {isLast ? "(Calculated)" : ""}
                  </Text>

                  <View
                    style={[
                      styles.amountInputWrap,
                      isLast && styles.amountInputDisabled,
                    ]}
                  >
                    <Text style={styles.currencyPrefix}>₦</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      editable={!isLast}
                      value={valNaira === 0 ? "" : String(valNaira)}
                      placeholder="0"
                      placeholderTextColor="#7A8580"
                      onChangeText={(text) => {
                        const parsed = parseFloat(text.replace(/,/g, "")) || 0;
                        setAmount(i, nairaToKobo(parsed));
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>STEP 3 OF 4</Text>
                <Text style={styles.cardTitle}>Time Schedule</Text>
                <Text style={styles.cardHint}>
                  Review calculated duration slices for each envelope.
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Ionicons name="calendar-outline" size={20} color="#063B2E" />
              </View>
            </View>

            {timeSlices.map((slice, i) => (
              <View key={i} style={styles.sliceRow}>
                <Text style={styles.sliceTitle}>Envelope {i + 1}</Text>
                <Text style={styles.sliceDate}>
                  {formatDateShort(slice.startDate)} -{" "}
                  {formatDateShort(slice.endDate)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>STEP 4 OF 4</Text>
                <Text style={styles.cardTitle}>Name Envelopes</Text>
                <Text style={styles.cardHint}>
                  Give each envelope a recognizable title.
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Ionicons
                  name="create-outline"
                  size={20}
                  color="#063B2E"
                />
              </View>
            </View>

            {Array.from({ length: envelopeCount }, (_, i) => (
              <View key={i} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Envelope {i + 1} Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={names[i] || ""}
                  placeholder={`Envelope ${i + 1}`}
                  placeholderTextColor="#7A8580"
                  onChangeText={(val) => setName(i, val)}
                />
              </View>
            ))}
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.footerNav}>
          {step < 4 ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={nextStep}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                !canSubmit && styles.buttonDisabled,
              ]}
              disabled={!canSubmit}
              onPress={handleSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Envelopes</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F5",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#106B4F",
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#063B2E",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#52605B",
    lineHeight: 20,
  },
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  progressItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E1E6E4",
    justifyContent: "center",
    alignItems: "center",
  },
  progressDotActive: {
    backgroundColor: "#063B2E",
  },
  progressNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7A8580",
  },
  progressNumberActive: {
    color: "#FFFFFF",
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E1E6E4",
    marginHorizontal: 6,
  },
  progressLineActive: {
    backgroundColor: "#063B2E",
  },
  contextCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  contextTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A8580",
  },
  contextPlanName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#063B2E",
  },
  availableBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableBadgeText: {
    fontSize: 12,
    color: "#106B4F",
    fontWeight: "600",
  },
  contextDivider: {
    height: 1,
    backgroundColor: "#F0F3F2",
    marginVertical: 12,
  },
  contextStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  contextStatLabel: {
    fontSize: 10,
    color: "#7A8580",
    fontWeight: "700",
  },
  contextStatValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#063B2E",
    marginTop: 2,
  },
  contextBar: {
    height: 6,
    backgroundColor: "#F0F3F2",
    borderRadius: 3,
    overflow: "hidden",
  },
  contextBarFill: {
    height: "100%",
    backgroundColor: "#106B4F",
  },
  existingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  existingTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  existingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F3F2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  existingCopy: {
    flex: 1,
  },
  existingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#063B2E",
  },
  existingDetail: {
    fontSize: 12,
    color: "#7A8580",
  },
  existingFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F3F2",
  },
  existingFooterText: {
    fontSize: 12,
    color: "#7A8580",
    marginLeft: 6,
  },
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    color: "#106B4F",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#063B2E",
    marginTop: 2,
  },
  cardHint: {
    fontSize: 13,
    color: "#7A8580",
    marginTop: 2,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F3F2",
    justifyContent: "center",
    alignItems: "center",
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAF9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E6E4",
  },
  counterButtonDisabled: {
    backgroundColor: "#F0F3F2",
    borderColor: "#F0F3F2",
  },
  counterValue: {
    alignItems: "center",
  },
  counterNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#063B2E",
  },
  counterLabel: {
    fontSize: 12,
    color: "#7A8580",
  },
  infoMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 10,
  },
  infoText: {
    fontSize: 12,
    color: "#106B4F",
    marginLeft: 8,
    flex: 1,
  },
  allocationSummary: {
    backgroundColor: "#F8FAF9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  allocationSummaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  allocationLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A8580",
  },
  allocationAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#063B2E",
  },
  remainingAmountWrap: {
    alignItems: "flex-end",
  },
  remainingAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#106B4F",
  },
  remainingAmountError: {
    color: "#D32F2F",
  },
  allocationBar: {
    height: 6,
    backgroundColor: "#E1E6E4",
    borderRadius: 3,
    overflow: "hidden",
  },
  allocationBarFill: {
    height: "100%",
    backgroundColor: "#106B4F",
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#52605B",
    marginBottom: 6,
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E6E4",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  amountInputDisabled: {
    backgroundColor: "#F4F6F5",
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: "600",
    color: "#063B2E",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    fontWeight: "600",
    color: "#063B2E",
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E1E6E4",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#063B2E",
    backgroundColor: "#FFFFFF",
  },
  sliceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F2",
  },
  sliceTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#063B2E",
  },
  sliceDate: {
    fontSize: 13,
    color: "#7A8580",
  },
  footerNav: {
    marginTop: 10,
  },
  primaryButton: {
    height: 50,
    backgroundColor: "#063B2E",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});