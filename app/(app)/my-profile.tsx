import {
  useCheckNickname,
  useProfile,
  useUpdateProfile,
  useUploadProfileImage,
} from "@/hooks/app/profile";
import { useWallet } from "@/hooks/app/wallet";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const C = {
  forest: "#063B2E",
  forestLight: "#E6F7EF",
  gold: "#D6A84F",
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E4ECE8",
  danger: "#B42318",
};

type NicknameState = "idle" | "checking" | "available" | "taken";

export default function MyProfileScreen() {
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { mutateAsync: updateProfile, isPending: isSaving } = useUpdateProfile();
  const { mutateAsync: checkNickname } = useCheckNickname();
  const { mutateAsync: uploadProfileImage, isPending: isUploadingImage } =
    useUploadProfileImage();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameState, setNicknameState] = useState<NicknameState>("idle");
  const [dob, setDob] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!profile) return;
    setEmail(profile.email || "");
    setNickname(profile.nickname || "");
    setDob(profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : "");
    setAddress(profile.address || "");
  }, [profile]);

  useEffect(() => {
    const value = nickname.trim().toLowerCase();
    if (!value || value === profile?.nickname) {
      setNicknameState("idle");
      return;
    }

    setNicknameState("checking");
    const timer = setTimeout(async () => {
      try {
        const result = await checkNickname(value);
        setNicknameState(result?.available ? "available" : "taken");
      } catch {
        setNicknameState("taken");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [checkNickname, nickname, profile?.nickname]);

  const accountNumber = wallet?.dedicated_account_number;
  const accountTitle = wallet?.dedicated_account_name || "Dedicated account";
  const bankName = wallet?.dedicated_bank_name || "Bank pending";

  const nicknameHint = useMemo(() => {
    if (nicknameState === "checking") return "Checking availability...";
    if (nicknameState === "available") return `@${nickname.trim()} is available`;
    if (nicknameState === "taken") return "That nickname is not available";
    return "Choose a public @nickname";
  }, [nickname, nicknameState]);
  const dateValue = dob ? new Date(`${dob}T00:00:00`) : new Date(2000, 0, 1);
  const saveDisabled =
    isSaving ||
    profileLoading ||
    nicknameState === "checking" ||
    nicknameState === "taken";

  const handleCopyAccount = async () => {
    if (!accountNumber) return;
    const clipboard = (globalThis.navigator as {
      clipboard?: { writeText?: (value: string) => Promise<void> };
    })?.clipboard;

    if (clipboard?.writeText) {
      await clipboard.writeText(accountNumber);
      Toast.show({ type: "success", text1: "Account number copied" });
      return;
    }

    Toast.show({ type: "info", text1: accountNumber, text2: "Copy support is coming soon on this device." });
  };

  const comingSoon = (label: string) => {
    Toast.show({ type: "info", text1: label, text2: "This update is coming soon." });
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/profile");
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: "error", text1: "Photo access is required" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      await uploadProfileImage(result.assets[0]);
      Toast.show({ type: "success", text1: "Profile image updated" });
    } catch {
      Toast.show({ type: "error", text1: "Could not upload image" });
    }
  };

  const handleSave = async () => {
    if (nicknameState === "checking") {
      Toast.show({ type: "info", text1: "Nickname check in progress" });
      return;
    }
    if (nickname && nicknameState === "taken") {
      Toast.show({ type: "error", text1: "Choose an available nickname" });
      return;
    }

    try {
      await updateProfile({
        nickname,
        date_of_birth: dob,
        address,
      });
      Toast.show({ type: "success", text1: "Profile updated" });
    } catch {
      Toast.show({ type: "error", text1: "Could not update profile" });
    }
  };

  const handleDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setShowDatePicker(false);
    if (!selected) return;

    const year = selected.getFullYear();
    const month = String(selected.getMonth() + 1).padStart(2, "0");
    const day = String(selected.getDate()).padStart(2, "0");
    setDob(`${year}-${month}-${day}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header title="My Profile" subtitle="Your identity and deposit details." onBack={handleBack} />

        <View style={styles.avatarBlock}>
          <TouchableOpacity style={styles.avatar} onPress={handlePickImage} disabled={isUploadingImage}>
            {profile?.profile_image_url ? (
              <Image source={{ uri: profile.profile_image_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{email ? email[0].toUpperCase() : "U"}</Text>
            )}
            <View style={styles.cameraBadge}>
              {isUploadingImage ? (
                <ActivityIndicator size="small" color={C.forest} />
              ) : (
                <Ionicons name="camera-outline" size={14} color={C.forest} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.upcomingText}>Tap to change profile image</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Dedicated Account</Text>
            {accountNumber ? (
              <TouchableOpacity onPress={handleCopyAccount} style={styles.copyButton}>
                <Ionicons name="copy-outline" size={15} color={C.forest} />
                <Text style={styles.copyText}>Copy</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {walletLoading ? (
            <ActivityIndicator color={C.forest} />
          ) : accountNumber ? (
            <>
              <Text style={styles.accountNumber}>{accountNumber}</Text>
              <Text style={styles.accountMeta}>{accountTitle}</Text>
              <Text style={styles.accountMeta}>{bankName}</Text>
            </>
          ) : (
            <Text style={styles.emptyText}>Dedicated account is not integrated here yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Field
            label="Nickname"
            value={nickname}
            onChangeText={(value) => setNickname(value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24))}
            placeholder="yourname"
            prefix="@"
            hint={nicknameHint}
            state={nicknameState}
          />
          <DateField value={dob} onPress={() => setShowDatePicker(true)} />
          {showDatePicker ? (
            <DateTimePicker
              value={dateValue}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          ) : null}
          {Platform.OS === "ios" && showDatePicker ? (
            <TouchableOpacity style={styles.doneDateButton} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.doneDateText}>Done</Text>
            </TouchableOpacity>
          ) : null}
          <ReadonlyRow
            label="Email"
            value={email}
            hint="Email changes require verification."
            onPress={() => router.push("/(app)/change-email")}
          />
          <Field
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Add your address"
            multiline
          />
          <TouchableOpacity
            style={[styles.primaryButton, saveDisabled && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={saveDisabled}
          >
            {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Save Profile</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <LockedRow label="Mobile Number" value="Change coming soon" onPress={() => comingSoon("Mobile number")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={22} color={C.forest} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  prefix,
  state,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  hint?: string;
  prefix?: string;
  state?: NicknameState;
  keyboardType?: "default" | "email-address";
  multiline?: boolean;
}) {
  const hintColor = state === "available" ? C.forest : state === "taken" ? C.danger : C.muted;
  const inputStateStyle =
    state === "checking"
      ? styles.inputWrapChecking
      : state === "available"
        ? styles.inputWrapAvailable
        : state === "taken"
          ? styles.inputWrapTaken
          : null;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, inputStateStyle]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          style={[styles.input, multiline && styles.multilineInput]}
          keyboardType={keyboardType}
          multiline={multiline}
        />
        {state === "checking" ? (
          <View style={styles.verifySpinner}>
            <ActivityIndicator size="small" color="#2563EB" />
          </View>
        ) : state === "available" ? (
          <Ionicons name="checkmark-circle" size={20} color={C.forest} />
        ) : state === "taken" ? (
          <Ionicons name="close-circle" size={20} color={C.danger} />
        ) : null}
      </View>
      {hint ? <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
}

function DateField({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Date of Birth</Text>
      <TouchableOpacity style={styles.inputWrap} onPress={onPress} activeOpacity={0.75}>
        <Text style={[styles.readonlyValue, !value && styles.placeholderText]}>
          {value || "Select date of birth"}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={C.forest} />
      </TouchableOpacity>
    </View>
  );
}

function ReadonlyRow({
  label,
  value,
  hint,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.inputWrap} onPress={onPress} activeOpacity={0.75}>
        <Text style={[styles.readonlyValue, !value && styles.placeholderText]}>
          {value || "Add email"}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function LockedRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.lockedRow} onPress={onPress}>
      <View>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{value}</Text>
      </View>
      <View style={styles.soonPill}>
        <Text style={styles.soonText}>Upcoming</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { alignItems: "center", marginBottom: 22 },
  backButton: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: C.forest, fontSize: 24, fontWeight: "900", textAlign: "center" },
  subtitle: { color: C.muted, fontSize: 13, fontWeight: "600", marginTop: 6, textAlign: "center" },
  avatarBlock: { alignItems: "center", marginBottom: 18 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.forest, fontSize: 30, fontWeight: "900" },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  upcomingText: { color: C.muted, fontSize: 12, fontWeight: "700", marginTop: 8 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: C.forest, fontSize: 16, fontWeight: "900" },
  copyButton: { flexDirection: "row", alignItems: "center", gap: 5, padding: 8 },
  copyText: { color: C.forest, fontSize: 12, fontWeight: "900" },
  accountNumber: { color: C.forest, fontSize: 26, fontWeight: "900", marginTop: 14 },
  accountMeta: { color: C.muted, fontSize: 13, fontWeight: "700", marginTop: 4 },
  emptyText: { color: C.muted, fontSize: 13, fontWeight: "700", marginTop: 12 },
  field: { marginBottom: 16 },
  label: { color: C.forest, fontSize: 13, fontWeight: "900", marginBottom: 8 },
  inputWrap: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#F9FBFA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  inputWrapChecking: { borderColor: "#2563EB", borderWidth: 1.5 },
  inputWrapAvailable: { borderColor: C.forest, borderWidth: 1.5 },
  inputWrapTaken: { borderColor: C.danger, borderWidth: 1.5 },
  verifySpinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  prefix: { color: C.forest, fontSize: 15, fontWeight: "900", marginRight: 2 },
  input: { flex: 1, color: C.forest, fontSize: 15, fontWeight: "700", paddingVertical: 12 },
  readonlyValue: { flex: 1, color: C.forest, fontSize: 15, fontWeight: "700" },
  placeholderText: { color: C.faint },
  multilineInput: { minHeight: 86, textAlignVertical: "top" },
  hint: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  doneDateButton: { alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 10, marginTop: -8, marginBottom: 10 },
  doneDateText: { color: C.forest, fontSize: 14, fontWeight: "900" },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  lockedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLabel: { color: C.forest, fontSize: 15, fontWeight: "900" },
  rowSub: { color: C.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  soonPill: {
    backgroundColor: C.forestLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  soonText: { color: C.forest, fontSize: 11, fontWeight: "900" },
});
