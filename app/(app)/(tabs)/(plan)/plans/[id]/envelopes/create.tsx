import { koboToNaira, nairaToKobo } from "@/api/money";
import { useCreateEnvelope, useEnvelopes } from "@/hooks/app/envelopes";
import { usePlan } from "@/hooks/app/plans";
import { useSubscriptionLimitModal } from "@/hooks/use-subscription-limit-modal";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-NG").format(value);

const formatDateForApi = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateShort = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// --- Duration presets, same pattern as the create-plan screen: replace a
// forced "open calendar, pick a day" decision with one-tap defaults. Every
// numeric preset is automatically disabled if it would run past the plan's
// own end date, and "Full plan" / "Custom" cover the edge cases.
const DURATION_PRESETS = [
  { key: "1w", label: "1 week", days: 7 },
  { key: "2w", label: "2 weeks", days: 14 },
  { key: "1m", label: "1 month", months: 1 },
  { key: "3m", label: "3 months", months: 3 },
  { key: "6m", label: "6 months", months: 6 },
] as const;

type DurationPreset = (typeof DURATION_PRESETS)[number];
type DurationKey = DurationPreset["key"] | "full" | "custom" | "continue";

const addDuration = (date: Date, preset: DurationPreset) => {
  const next = new Date(date);
  if ("days" in preset) next.setDate(next.getDate() + preset.days);
  if ("months" in preset) next.setMonth(next.getMonth() + preset.months);
  return normalizeDate(next);
};

export default function CreateEnvelopeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === "string" ? id : "";

  const { data: plan, isLoading: isPlanLoading } = usePlan(planId);
  const { data: existingEnvelopes = [] } = useEnvelopes(planId);
  const { mutateAsync: createEnvelope, isPending } = useCreateEnvelope(planId);
  const { showSubscriptionLimitModal } = useSubscriptionLimitModal();

  const planStartDate = useMemo(() => parseApiDate(plan?.start_date), [plan?.start_date]);
  const planEndDate = useMemo(() => parseApiDate(plan?.end_date), [plan?.end_date]);
  const planAmountNaira = koboToNaira(plan?.amount);
  const allocatedNaira = koboToNaira(plan?.top_level_allocated);
  const remainingPlanBalance = Math.max(planAmountNaira - allocatedNaira, 0);

  const minimumStartDate = useMemo(() => {
    if (planStartDate && planStartDate > today) return planStartDate;
    return today;
  }, [planStartDate]);

  // ── Compute the latest-ending sibling envelope ──
  const latestEnvelope = useMemo(() => {
    if (!existingEnvelopes.length) return null;
    return existingEnvelopes.reduce((latest, env) => {
      const envEnd = parseApiDate(env.end_date);
      const latestEnd = parseApiDate(latest.end_date);
      return envEnd && latestEnd && envEnd > latestEnd ? env : latest;
    });
  }, [existingEnvelopes]);

  // ── Compute the suggested "continue" date range ──
  const continueSuggested = useMemo(() => {
    if (!latestEnvelope || !planEndDate) return null;

    const lastEnd = parseApiDate(latestEnvelope.end_date);
    const lastStart = parseApiDate(latestEnvelope.start_date);
    if (!lastEnd || !lastStart) return null;

    const suggestedStart = normalizeDate(new Date(lastEnd.getTime() + 86400000));
    if (suggestedStart > planEndDate) return null;

    // Mirror the duration of the last envelope
    const lastDurationMs = lastEnd.getTime() - lastStart.getTime();
    let suggestedEnd = normalizeDate(new Date(suggestedStart.getTime() + lastDurationMs));
    if (suggestedEnd > planEndDate) suggestedEnd = planEndDate;
    if (suggestedEnd < suggestedStart) suggestedEnd = suggestedStart;

    return { start: suggestedStart, end: suggestedEnd };
  }, [latestEnvelope, planEndDate]);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState<Date>(minimumStartDate);
  const [endDate, setEndDate] = useState<Date | null>(planEndDate || null);
  const [durationPreset, setDurationPreset] = useState<DurationKey>("full");
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);

  // ── Smart name placeholder (2.4): soft suggestion from latest envelope ──
  const namePlaceholder = useMemo(() => {
    if (!latestEnvelope || name.length > 0) return "Rent";
    const match = latestEnvelope.name.match(/^(.*?)(\d+)\s*$/);
    if (!match) return "Rent";
    const prefix = match[1].trim();
    const num = parseInt(match[2], 10);
    return `${prefix} ${num + 1}`;
  }, [latestEnvelope, name]);
  const [policy, setPolicy] = useState<"flexible" | "locked_until_parent_ends">(
    "flexible"
  );
  const inheritsPlanLock =
    plan?.unboxed_balance_policy === "locked_until_plan_ends";

  useEffect(() => {
    if (inheritsPlanLock) setPolicy("locked_until_parent_ends");
  }, [inheritsPlanLock]);

  const amountNumber = Number(amount || 0);

  // Keep the start date inside the plan window as plan data resolves.
  useEffect(() => {
    setStartDate((current) => (current < minimumStartDate ? minimumStartDate : current));
  }, [minimumStartDate]);

  // Keep the end date anchored to whichever duration is active, always
  // clamped inside the plan's own start/end range.
  useEffect(() => {
    if (durationPreset === "custom") {
      setEndDate((current) => {
        if (!current) return planEndDate;
        if (current < startDate) return startDate;
        if (planEndDate && current > planEndDate) return planEndDate;
        return current;
      });
      return;
    }

    if (durationPreset === "full") {
      setEndDate(planEndDate);
      return;
    }

    const preset = DURATION_PRESETS.find((item) => item.key === durationPreset);
    if (!preset) return;

    const raw = addDuration(startDate, preset);
    setEndDate(planEndDate && raw > planEndDate ? planEndDate : raw);
  }, [durationPreset, startDate, planEndDate]);

  const minimumEndDate = useMemo(() => {
    if (startDate > minimumStartDate) return startDate;
    return minimumStartDate;
  }, [startDate, minimumStartDate]);

  const isPresetAvailable = (preset: DurationPreset) => {
    if (!planEndDate) return true;
    return addDuration(startDate, preset) <= planEndDate;
  };

  const selectDurationPreset = (key: DurationKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (key === "continue" && continueSuggested) {
      setStartDate(continueSuggested.start);
      setEndDate(continueSuggested.end);
      setDurationPreset("continue");
      return;
    }

    setDurationPreset(key);
  };

  const handleDateChange = (selectedDate?: Date) => {
    if (!selectedDate || !activePicker) return;

    const selected = normalizeDate(selectedDate);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (activePicker === "start") {
      setStartDate(selected);
      return;
    }

    if (activePicker === "end") {
      setEndDate(selected);
      setDurationPreset("custom");
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Envelope name required",
        text2: "Please enter a name for this envelope.",
      });
      return;
    }

    if (!endDate) {
      Toast.show({
        type: "error",
        text1: "End date required",
        text2: "Please choose when this envelope should end.",
      });
      return;
    }

    if (startDate < minimumStartDate) {
      Toast.show({
        type: "error",
        text1: "Invalid start date",
        text2: "Envelope start date cannot be before the plan start date.",
      });
      return;
    }

    if (endDate < startDate) {
      Toast.show({
        type: "error",
        text1: "Invalid end date",
        text2: "End date cannot be before start date.",
      });
      return;
    }

    if (planEndDate && endDate > planEndDate) {
      Toast.show({
        type: "error",
        text1: "Invalid end date",
        text2: "Envelope end date cannot be after the plan end date.",
      });
      return;
    }

    if (amountNumber <= 0) {
      Toast.show({
        type: "error",
        text1: "Invalid amount",
        text2: "Please enter an amount greater than zero.",
      });
      return;
    }

    if (amountNumber > remainingPlanBalance) {
      Toast.show({
        type: "error",
        text1: "Amount too high",
        text2: `You cannot save more than ₦${formatNumber(
          remainingPlanBalance
        )} in this plan.`,
      });
      return;
    }

    try {
      await createEnvelope({
        name,
        amount: nairaToKobo(amount),
        start_date: formatDateForApi(startDate),
        end_date: formatDateForApi(endDate),
        unboxed_balance_policy: policy,
      });

      Toast.show({ type: "success", text1: "Envelope created" });
      router.back();
    } catch (error: any) {
      if (showSubscriptionLimitModal("envelope_create", error)) {
        return;
      }

      Toast.show({
        type: "error",
        text1: "Could not create envelope",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try again.",
      });
    }
  };

  const disabled =
    !name.trim() ||
    !amount.trim() ||
    !endDate ||
    isPending ||
    isPlanLoading;

  // ── Smarter picker default (2.5): open on suggested continuation date ──
  const pickerValue = (() => {
    if (activePicker === "start") {
      return continueSuggested ? continueSuggested.start : startDate;
    }
    return endDate || continueSuggested?.end || minimumEndDate;
  })();

  const pickerMinimumDate =
    activePicker === "start" ? minimumStartDate : minimumEndDate;

  const pickerMaximumDate = planEndDate || undefined;

  // Where the envelope's date range sits inside the plan's own range, as
  // percentages — drives the timeline bar below.
  const timeline = useMemo(() => {
    if (!planStartDate || !planEndDate) return null;

    const total = planEndDate.getTime() - planStartDate.getTime();
    if (total <= 0) return null;

    const endForMath = endDate || planEndDate;
    const startPercent = clamp(
      ((startDate.getTime() - planStartDate.getTime()) / total) * 100,
      0,
      100
    );
    const endPercent = clamp(
      ((endForMath.getTime() - planStartDate.getTime()) / total) * 100,
      0,
      100
    );

    return { startPercent, endPercent: Math.max(endPercent, startPercent) };
  }, [planStartDate, planEndDate, startDate, endDate]);

  const allocationPercent =
    planAmountNaira > 0 ? clamp((allocatedNaira / planAmountNaira) * 100, 0, 100) : 0;

  const projectedPercent =
    planAmountNaira > 0
      ? clamp(((allocatedNaira + amountNumber) / planAmountNaira) * 100, 0, 100)
      : 0;

  // --- Entrance animation ---------------------------------------------
  const headerAnim = useRef(new Animated.Value(0)).current;
  const summaryAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(headerAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(summaryAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(formAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [formAnim, headerAnim, summaryAnim]);

  const enterStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
    ],
  });

  // Button press feedback.
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pressButtonIn = () =>
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  const pressButtonOut = () =>
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, enterStyle(headerAnim)]}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.75}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="#063B2E" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Add Envelope</Text>
            <Text style={styles.subtitle}>
              Partition {plan?.name || "this plan"} into a specific spending bucket.
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.summaryCard, enterStyle(summaryAnim)]}>
          <View style={styles.summaryIcon}>
            <Ionicons name="albums-outline" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>Create a spending bucket</Text>
            <Text style={styles.summaryText}>
              Use envelopes for things like rent, food, savings, bills, or transport.
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.formCard, enterStyle(formAnim)]}>
          <Text style={styles.sectionTitle}>Envelope details</Text>

          <Field
            label="Envelope name"
            value={name}
            onChangeText={setName}
            placeholder={namePlaceholder}
            icon="file-tray-full-outline"
          />

          <Field
            label="Amount"
            value={amount}
            onChangeText={(value) => {
              const cleanValue = value.replace(/[^0-9.]/g, "");

              const numericValue = Number(cleanValue || 0);

              if (numericValue > remainingPlanBalance) {
                Toast.show({
                  type: "error",
                  text1: "Amount too high",
                  text2: `You only have ₦${formatNumber(remainingPlanBalance)} left in this plan.`,
                });

                setAmount(String(remainingPlanBalance));
                return;
              }

              setAmount(cleanValue);
            }}
            placeholder="100000"
            keyboardType="decimal-pad"
            icon="cash-outline"
            prefix="₦"
          />

          {planAmountNaira > 0 ? (
            <View style={styles.allocationBlock}>
              <View style={styles.allocationLabelRow}>
                <Text style={styles.allocationLabel}>Plan allocation</Text>
                <Text style={styles.allocationValue}>
                  ₦{formatNumber(allocatedNaira + amountNumber)} / ₦{formatNumber(planAmountNaira)}
                </Text>
              </View>

              <View style={styles.allocationTrack}>
                <View style={[styles.allocationFillBase, { width: `${allocationPercent}%` }]} />
                {amountNumber > 0 ? (
                  <View
                    style={[
                      styles.allocationFillNew,
                      {
                        left: `${allocationPercent}%`,
                        width: `${Math.max(projectedPercent - allocationPercent, 0)}%`,
                      },
                    ]}
                  />
                ) : null}
              </View>

              <Text style={styles.allocationHint}>
                ₦{formatNumber(remainingPlanBalance)} left unassigned in this plan
              </Text>
            </View>
          ) : null}

          <View style={styles.dateRow}>
            <DateButton
              label="Start date"
              value={formatDateForDisplay(startDate)}
              icon="calendar-outline"
              onPress={() => setActivePicker("start")}
            />

            <DateButton
              label="End date"
              value={endDate ? formatDateForDisplay(endDate) : "Choose date"}
              icon="calendar-clear-outline"
              muted={!endDate}
              onPress={() => setActivePicker("end")}
            />
          </View>

          <Text style={styles.presetLabel}>How long should this envelope run?</Text>
          <View style={styles.presetRow}>
            {continueSuggested ? (
              <TouchableOpacity
                onPress={() => selectDurationPreset("continue")}
                activeOpacity={0.8}
                style={[
                  styles.presetPill,
                  styles.presetPillContinue,
                  durationPreset === "continue" && styles.presetPillActive,
                ]}
              >
                <Ionicons
                  name="arrow-forward-outline"
                  size={13}
                  color={durationPreset === "continue" ? "#FFFFFF" : "#106B4F"}
                  style={styles.presetPillIcon}
                />
                <Text
                  style={[
                    styles.presetPillText,
                    durationPreset === "continue" && styles.presetPillTextActive,
                  ]}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            ) : null}

            {DURATION_PRESETS.map((preset) => {
              const active = durationPreset === preset.key;
              const available = isPresetAvailable(preset);

              return (
                <TouchableOpacity
                  key={preset.key}
                  disabled={!available}
                  onPress={() => selectDurationPreset(preset.key)}
                  activeOpacity={0.8}
                  style={[
                    styles.presetPill,
                    active && styles.presetPillActive,
                    !available && styles.presetPillDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      active && styles.presetPillTextActive,
                      !available && styles.presetPillTextDisabled,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              disabled={!planEndDate}
              onPress={() => selectDurationPreset("full")}
              activeOpacity={0.8}
              style={[
                styles.presetPill,
                durationPreset === "full" && styles.presetPillActive,
                !planEndDate && styles.presetPillDisabled,
              ]}
            >
              <Ionicons
                name="expand-outline"
                size={13}
                color={durationPreset === "full" ? "#FFFFFF" : "#063B2E"}
                style={styles.presetPillIcon}
              />
              <Text
                style={[
                  styles.presetPillText,
                  durationPreset === "full" && styles.presetPillTextActive,
                  !planEndDate && styles.presetPillTextDisabled,
                ]}
              >
                Full plan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActivePicker("end")}
              activeOpacity={0.8}
              style={[
                styles.presetPill,
                durationPreset === "custom" && styles.presetPillActive,
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={durationPreset === "custom" ? "#FFFFFF" : "#063B2E"}
                style={styles.presetPillIcon}
              />
              <Text
                style={[
                  styles.presetPillText,
                  durationPreset === "custom" && styles.presetPillTextActive,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateInfoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#106B4F" />
            <Text style={styles.dateInfoText}>
              Envelope dates must stay within the plan period — presets that
              would run past it are greyed out.
            </Text>
          </View>

          <View style={styles.planPeriodCard}>
            <View style={styles.planPeriodHeaderRow}>
              <Text style={styles.planPeriodLabel}>Plan period</Text>
              <Text style={styles.planPeriodText}>
                {planStartDate ? formatDateShort(planStartDate) : "Today"} —{" "}
                {planEndDate ? formatDateShort(planEndDate) : "No end date"}
              </Text>
            </View>

            {timeline ? (
              <View style={styles.timelineTrack}>
                <View
                  style={[
                    styles.timelineFill,
                    {
                      left: `${timeline.startPercent}%`,
                      width: `${Math.max(timeline.endPercent - timeline.startPercent, 2)}%`,
                    },
                  ]}
                />
              </View>
            ) : null}

            {/* 2.6 — Visual occupied-range indicator for sibling envelopes */}
            {existingEnvelopes.length > 0 && planStartDate && planEndDate ? (
              <View style={styles.occupiedTrack}>
                {existingEnvelopes.map((env) => {
                  const envStart = parseApiDate(env.start_date);
                  const envEnd = parseApiDate(env.end_date);
                  if (!envStart || !envEnd) return null;
                  const totalMs = planEndDate.getTime() - planStartDate.getTime();
                  if (totalMs <= 0) return null;
                  const left = clamp(
                    ((envStart.getTime() - planStartDate.getTime()) / totalMs) * 100,
                    0,
                    100
                  );
                  const width = clamp(
                    ((envEnd.getTime() - envStart.getTime()) / totalMs) * 100,
                    0,
                    100 - left
                  );
                  return (
                    <View
                      key={env.id}
                      style={[styles.occupiedSlice, { left: `${left}%`, width: `${Math.max(width, 1)}%` }]}
                    />
                  );
                })}
              </View>
            ) : null}

            <View style={styles.timelineLabelsRow}>
              <Text style={styles.timelineLabelText}>
                Envelope: {formatDateShort(startDate)}
                {endDate ? ` – ${formatDateShort(endDate)}` : ""}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Unboxed balance policy</Text>
          <Text style={styles.sectionHint}>
            {inheritsPlanLock
              ? "This envelope follows the withdrawal lock on its plan."
              : "Choose how leftover money inside this envelope should behave."}
          </Text>

          {inheritsPlanLock ? (
            <View style={styles.inheritedLockCard}>
              <View style={styles.inheritedLockIcon}>
                <Ionicons name="lock-closed" size={16} color="#946500" />
              </View>
              <View style={styles.inheritedLockCopy}>
                <View style={styles.inheritedLockTitleRow}>
                  <Text style={styles.inheritedLockTitle}>Locked</Text>
                  <View style={styles.inheritedBadge}>
                    <Text style={styles.inheritedBadgeText}>INHERITED FROM PLAN</Text>
                  </View>
                </View>
                <Text style={styles.inheritedLockText}>
                  Funds cannot be withdrawn until the parent plan ends.
                </Text>
              </View>
            </View>
          ) : (
          <View style={styles.policyRow}>
            <PolicyButton
              title="Flexible"
              description="Allow access anytime"
              icon="swap-horizontal-outline"
              active={policy === "flexible"}
              onPress={() => setPolicy("flexible")}
            />

            <PolicyButton
              title="Locked"
              description="Hold till plan ends"
              icon="lock-closed-outline"
              active={policy === "locked_until_parent_ends"}
              onPress={() => setPolicy("locked_until_parent_ends")}
            />
          </View>
          )}

          <TouchableOpacity
            disabled={disabled}
            onPress={handleSubmit}
            onPressIn={pressButtonIn}
            onPressOut={pressButtonOut}
            activeOpacity={0.85}
          >
            <Animated.View
              style={[
                styles.button,
                disabled && styles.buttonDisabled,
                { transform: [{ scale: buttonScale }] },
              ]}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Create Envelope</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {activePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="calendar"
          minimumDate={pickerMinimumDate}
          maximumDate={pickerMaximumDate}
          onChange={(event, selectedDate) => {
            setActivePicker(null);

            if (event.type === "dismissed") return;

            handleDateChange(selectedDate);
          }}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={!!activePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setActivePicker(null)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setActivePicker(null)}
          >
            <Pressable style={styles.datePickerSheet}>
              <View style={styles.datePickerHeader}>
                <View style={styles.datePickerTextWrap}>
                  <Text style={styles.datePickerTitle}>
                    {activePicker === "start"
                      ? "Choose start date"
                      : "Choose end date"}
                  </Text>

                  <Text style={styles.datePickerSubtitle}>
                    {activePicker === "start"
                      ? "Envelope cannot start before the plan starts"
                      : "Envelope cannot end before it starts"}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setActivePicker(null)}
                  style={styles.closeButton}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close" size={20} color="#063B2E" />
                </TouchableOpacity>
              </View>

              {activePicker ? (
                <DateTimePicker
                  value={pickerValue}
                  mode="date"
                  display="spinner"
                  minimumDate={pickerMinimumDate}
                  maximumDate={pickerMaximumDate}
                  onChange={(_, selectedDate) => {
                    handleDateChange(selectedDate);
                  }}
                  style={styles.datePicker}
                />
              ) : null}

              <TouchableOpacity
                onPress={() => setActivePicker(null)}
                style={styles.doneButton}
                activeOpacity={0.8}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad";
  icon: keyof typeof Ionicons.glyphMap;
  prefix?: string;
};

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  icon,
  prefix,
}: FieldProps) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>

    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color="#7A8580" />
      {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA5A1"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  </View>
);

const DateButton = ({
  label,
  value,
  icon,
  muted,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  muted?: boolean;
  onPress: () => void;
}) => (
  <View style={styles.dateField}>
    <Text style={styles.label}>{label}</Text>

    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.dateButton}
    >
      <View style={styles.dateIcon}>
        <Ionicons name={icon} size={18} color="#063B2E" />
      </View>

      <Text
        style={[styles.dateButtonText, muted && styles.dateButtonTextMuted]}
        numberOfLines={1}
      >
        {value}
      </Text>

      <Ionicons name="chevron-down" size={17} color="#7A8580" />
    </TouchableOpacity>
  </View>
);

const PolicyButton = ({
  title,
  description,
  icon,
  active,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.policyButton, active && styles.policyButtonActive]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={[styles.policyIcon, active && styles.policyIconActive]}>
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : "#063B2E"} />
    </View>

    <Text style={[styles.policyTitle, active && styles.policyTitleActive]}>
      {title}
    </Text>

    <Text
      style={[
        styles.policyDescription,
        active && styles.policyDescriptionActive,
      ]}
    >
      {description}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F5",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 100,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3EAE6",
    shadowColor: "#063B2E",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },

  headerTextWrap: {
    flex: 1,
  },

  title: {
    color: "#063B2E",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  subtitle: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#063B2E",
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
  },

  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryTextWrap: {
    flex: 1,
  },

  summaryTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  summaryText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 3,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E4EBE7",
    shadowColor: "#063B2E",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },

  sectionTitle: {
    color: "#063B2E",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },

  sectionHint: {
    color: "#7A8580",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginBottom: 14,
  },

  field: {
    marginTop: 14,
  },

  label: {
    color: "#3F4945",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.7,
  },

  inputWrap: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E3EAE6",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  prefix: {
    color: "#063B2E",
    fontSize: 16,
    fontWeight: "900",
  },

  input: {
    flex: 1,
    color: "#063B2E",
    fontSize: 15,
    fontWeight: "800",
    paddingVertical: 0,
  },

  allocationBlock: {
    marginTop: 14,
  },

  allocationLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },

  allocationLabel: {
    color: "#3F4945",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  allocationValue: {
    color: "#063B2E",
    fontSize: 12,
    fontWeight: "900",
  },

  allocationTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#EEF2F0",
    overflow: "hidden",
    position: "relative",
  },

  allocationFillBase: {
    height: "100%",
    backgroundColor: "#D8E4DF",
    borderRadius: 999,
  },

  allocationFillNew: {
    position: "absolute",
    top: 0,
    height: "100%",
    backgroundColor: "#106B4F",
    borderRadius: 999,
  },

  allocationHint: {
    color: "#7A8580",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 7,
  },

  dateRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },

  dateField: {
    flex: 1,
  },

  dateButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E3EAE6",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  dateIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
  },

  dateButtonText: {
    flex: 1,
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "900",
  },

  dateButtonTextMuted: {
    color: "#9AA5A1",
  },

  presetLabel: {
    color: "#3F4945",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginTop: 16,
    marginBottom: 9,
  },

  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  presetPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E3EAE6",
  },

  presetPillActive: {
    backgroundColor: "#063B2E",
    borderColor: "#063B2E",
  },

  presetPillDisabled: {
    opacity: 0.4,
  },

  presetPillIcon: {
    marginRight: 5,
  },

  presetPillText: {
    color: "#063B2E",
    fontSize: 12,
    fontWeight: "800",
  },

  presetPillTextActive: {
    color: "#FFFFFF",
  },

  presetPillTextDisabled: {
    color: "#9AA5A1",
  },

  dateInfoBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#EAF7F1",
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },

  dateInfoText: {
    flex: 1,
    color: "#106B4F",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  planPeriodCard: {
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FFF8E7",
    borderWidth: 1,
    borderColor: "#F6E5B3",
  },

  planPeriodHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  planPeriodLabel: {
    color: "#946500",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  planPeriodText: {
    color: "#6B4E00",
    fontSize: 12,
    fontWeight: "800",
  },

  timelineTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148, 101, 0, 0.14)",
    overflow: "hidden",
    position: "relative",
  },

  timelineFill: {
    position: "absolute",
    top: 0,
    height: "100%",
    backgroundColor: "#946500",
    borderRadius: 999,
  },

  timelineLabelsRow: {
    marginTop: 8,
  },

  timelineLabelText: {
    color: "#946500",
    fontSize: 11,
    fontWeight: "800",
  },

  occupiedTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148, 101, 0, 0.08)",
    overflow: "hidden",
    position: "relative",
    marginTop: 6,
  },

  occupiedSlice: {
    position: "absolute",
    top: 0,
    height: "100%",
    backgroundColor: "rgba(148, 101, 0, 0.28)",
    borderRadius: 999,
  },

  presetPillContinue: {
    borderColor: "#CDEDE0",
    backgroundColor: "#EAF7F1",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF2F0",
    marginVertical: 22,
  },

  policyRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  inheritedLockCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1D99A",
    backgroundColor: "#FFF9E8",
  },
  inheritedLockIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0BE",
  },
  inheritedLockCopy: { flex: 1 },
  inheritedLockTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  inheritedLockTitle: { color: "#5F4500", fontSize: 14, fontWeight: "900" },
  inheritedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F7E5AC",
  },
  inheritedBadgeText: { color: "#7A5900", fontSize: 8, fontWeight: "900" },
  inheritedLockText: {
    marginTop: 4,
    color: "#7A641E",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },

  policyButton: {
    flex: 1,
    minHeight: 124,
    borderRadius: 20,
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E3EAE6",
    padding: 14,
  },

  policyButtonActive: {
    backgroundColor: "#063B2E",
    borderColor: "#063B2E",
  },

  policyIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  policyIconActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  policyTitle: {
    color: "#063B2E",
    fontSize: 14,
    fontWeight: "900",
  },

  policyTitleActive: {
    color: "#FFFFFF",
  },

  policyDescription: {
    color: "#7A8580",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 4,
  },

  policyDescriptionActive: {
    color: "rgba(255,255,255,0.68)",
  },

  button: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#063B2E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#063B2E",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 59, 46, 0.35)",
    justifyContent: "flex-end",
  },

  datePickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },

  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 10,
  },

  datePickerTextWrap: {
    flex: 1,
  },

  datePickerTitle: {
    color: "#063B2E",
    fontSize: 18,
    fontWeight: "900",
  },

  datePickerSubtitle: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F4F7F5",
    alignItems: "center",
    justifyContent: "center",
  },

  datePicker: {
    width: "100%",
  },

  doneButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#063B2E",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
