import { nairaToKobo } from "@/api/money";
import { useCreatePlan } from "@/hooks/app/plans";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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

const normalizeDate = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const today = normalizeDate(new Date());

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

export default function CreatePlanScreen() {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(
    null
  );

  const [policy, setPolicy] = useState<"flexible" | "locked_until_plan_ends">(
    "flexible"
  );

  const { mutateAsync: create, isPending } = useCreatePlan();

  const minimumEndDate = useMemo(() => {
    return normalizeDate(startDate);
  }, [startDate]);

  const pickerValue =
    activePicker === "start" ? startDate : endDate || minimumEndDate;

  const pickerMinimumDate = activePicker === "start" ? today : minimumEndDate;

  const disabled =
    !name.trim() || !amount.trim() || !endDate || Number(amount) <= 0 || isPending;

  const handleDateChange = (selectedDate?: Date) => {
    if (!selectedDate || !activePicker) return;

    const selected = normalizeDate(selectedDate);

    if (activePicker === "start") {
      setStartDate(selected);

      if (endDate && endDate < selected) {
        setEndDate(selected);
      }

      return;
    }

    if (activePicker === "end") {
      setEndDate(selected);
    }
  };

  const handleSubmit = async () => {
    const amountNumber = Number(amount || 0);

    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Plan name required",
        text2: "Please enter a name for this plan.",
      });
      return;
    }

    if (!amount.trim() || amountNumber <= 0) {
      Toast.show({
        type: "error",
        text1: "Invalid amount",
        text2: "Please enter an amount greater than zero.",
      });
      return;
    }

    if (startDate < today) {
      Toast.show({
        type: "error",
        text1: "Invalid start date",
        text2: "Start date cannot be in the past.",
      });
      return;
    }

    if (!endDate) {
      Toast.show({
        type: "error",
        text1: "End date required",
        text2: "Please choose when this plan should end.",
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

    try {
      const plan = await create({
        name: name.trim(),
        amount: nairaToKobo(amount),
        start_date: formatDateForApi(startDate),
        end_date: formatDateForApi(endDate),
        unboxed_balance_policy: policy,
      });

      Toast.show({ type: "success", text1: "Draft plan created" });

      if (plan?.id) {
        router.replace({
          pathname: "/plans/[id]",
          params: { id: plan.id },
        });
      } else {
        router.back();
      }
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Could not create plan",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try again.",
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.75}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color="#063B2E" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Create Plan</Text>
            <Text style={styles.subtitle}>
              Build a draft plan, add envelopes, then confirm when ready.
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="wallet-outline" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>Plan your vault</Text>
            <Text style={styles.summaryText}>
              Split your money into clear goals before spending starts.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Plan details</Text>

          <Field
            label="Plan name"
            value={name}
            onChangeText={setName}
            placeholder="July savings plan"
            icon="document-text-outline"
          />

          <Field
            label="Amount"
            value={amount}
            onChangeText={(value) => {
              const cleanValue = value.replace(/[^0-9.]/g, "");

              const parts = cleanValue.split(".");
              const formattedValue =
                parts.length > 2
                  ? `${parts[0]}.${parts.slice(1).join("")}`
                  : cleanValue;

              setAmount(formattedValue);
            }}
            placeholder="250000"
            keyboardType="decimal-pad"
            icon="cash-outline"
            prefix="₦"
          />

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

          <View style={styles.dateInfoBox}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#106B4F"
            />
            <Text style={styles.dateInfoText}>
              Start date cannot be in the past. End date must be the same day or
              after the start date.
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Unboxed balance policy</Text>
          <Text style={styles.sectionHint}>
            Choose what happens to money that is not assigned to an envelope.
          </Text>

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
              active={policy === "locked_until_plan_ends"}
              onPress={() => setPolicy("locked_until_plan_ends")}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, disabled && styles.buttonDisabled]}
            disabled={disabled}
            onPress={handleSubmit}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.buttonText}>Create Draft Plan</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {activePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="calendar"
          minimumDate={pickerMinimumDate}
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
                      ? "Plans cannot start in the past"
                      : "End date cannot be before start date"}
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