import {
  useCheckNickname,
  useProfile,
  useUpdateProfile,
  useUploadProfileImage,
} from "@/hooks/app/profile";
import { useWallet } from "@/hooks/app/wallet";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { countryMeta } from "@/components/auth/register/constants";
import type { SupportedCountry } from "@/components/auth/register/types";
import { COLORS } from "../../themes/colors";

const C = {
  forest: "#063B2E",
  forestDeep: "#04261D",
  forestLight: "#E6F7EF",
  gold: "#D6A84F",
  goldSoft: "#F2DEB2",
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E7EEEA",
  danger: "#B42318",
  dangerSoft: "#FDECEC",
  info: "#2563EB",
  infoSoft: "#EAF1FE",
  primary: COLORS.primary,
};

type NicknameState = "idle" | "checking" | "available" | "taken";

export default function MyProfileScreen() {
  const {
    data: wallet,
    isLoading: walletLoading,
    refetch: refetchWallet,
  } = useWallet();
  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useProfile();


  // console.log(profile)
  const { mutateAsync: updateProfile, isPending: isSaving } = useUpdateProfile();
  const { mutateAsync: checkNickname } = useCheckNickname();
  const { mutateAsync: uploadProfileImage, isPending: isUploadingImage } =
    useUploadProfileImage();

  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameState, setNicknameState] = useState<NicknameState>("idle");
  const [gender, setGender] = useState("");
  // Baseline of what we know is persisted. The server may not echo `gender`
  // back on refetch yet, so the baseline is: server value when present,
  // otherwise whatever we last saved. Keeps the UI from clobbering a just-
  // made selection and keeps the dirty-check honest.
  const [lastSavedGender, setLastSavedGender] = useState("");
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [dob, setDob] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState<SupportedCountry>("NG");
  const [phone, setPhone] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "";

  useEffect(() => {
    if (!profile) return;
    setEmail(profile.email || "");
    setNickname(profile.nickname || "");

    // Adopt the server's gender only when it actually returns one; a refetch
    // that omits the field must never wipe the user's current selection.
    const serverGender = profile.gender || "";
    if (serverGender) setLastSavedGender(serverGender);
    setGender((current) => serverGender || current);

    setDob(profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : "");
    setAddress(profile.address || "");
    setCountry((profile.country as SupportedCountry) || "NG");
    setPhone(profile.phone_number || "");
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

  // Track whether the user has changed anything, to enable/disable Save intelligently
  useEffect(() => {
    if (!profile) return;
    const changed =
      nickname !== (profile.nickname || "") ||
      gender !== lastSavedGender ||
      dob !== (profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : "") ||
      address !== (profile.address || "") ||
      phone !== (profile.phone_number || "") ||
      country !== ((profile.country as SupportedCountry) || "NG");
    setIsDirty(changed);
  }, [nickname, gender, lastSavedGender, dob, address, phone, country, profile]);

  const accountNumber = wallet?.dedicated_account_number;
  const accountTitle = wallet?.dedicated_account_name || "Dedicated account";
  const bankName = wallet?.dedicated_bank_name || "Bank pending";

  const nicknameHint = useMemo(() => {
    if (nicknameState === "checking") return "Checking availability…";
    if (nicknameState === "available") return `@${nickname.trim()} is available`;
    if (nicknameState === "taken") return "That nickname is already taken";
    return "Choose a public @nickname";
  }, [nickname, nicknameState]);

  const dateValue = dob ? new Date(`${dob}T00:00:00`) : new Date(2000, 0, 1);

  /** Digits-only length must match the selected country's rules. */
  const isPhoneValid = useMemo(() => {
    const meta = countryMeta[country];
    return (
      phone.length === meta.maxLength || phone.length === meta.alternateLength
    );
  }, [country, phone]);

  const saveDisabled =
    isSaving ||
    profileLoading ||
    !isDirty ||
    nicknameState === "checking" ||
    nicknameState === "taken" ||
    (phone !== (profile?.phone_number || "") && !isPhoneValid);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile?.(), refetchWallet?.()]);
    setRefreshing(false);
  };

  const handleCopyAccount = async () => {
    if (!accountNumber) return;
    const clipboard = (globalThis.navigator as {
      clipboard?: { writeText?: (value: string) => Promise<void> };
    })?.clipboard;

    if (clipboard?.writeText) {
      await clipboard.writeText(accountNumber);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      Toast.show({ type: "success", text1: "Account number copied" });
      return;
    }
    Toast.show({
      type: "info",
      text1: accountNumber,
      text2: "Copy support is coming soon on this device.",
    });
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/profile");
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
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
      // Phone travels as digits only, keyed to the selected country — same
      // shape registration uses, so the backend stores one canonical format.
      await updateProfile({
        nickname,
        gender: gender || undefined,
        date_of_birth: dob,
        address,
        country,
        phone_number: phone.replace(/\D/g, ""),
      });
      setLastSavedGender(gender);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      Toast.show({ type: "success", text1: "Profile updated" });
      setIsDirty(false);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      Toast.show({ type: "error", text1: "Could not update profile" });
    }
  };

  const openDatePicker = () => {
    setTempDate(dateValue);
    setShowDatePicker(true);
  };

  const handleDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
      if (!selected) return;
      applyDate(selected);
      return;
    }
    if (selected) setTempDate(selected);
  };

  const applyDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    setDob(`${year}-${month}-${day}`);
  };

  const confirmIosDate = () => {
    if (tempDate) applyDate(tempDate);
    setShowDatePicker(false);
  };

  if (profileLoading && !profile) {
    return <ProfileSkeleton onBack={handleBack} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.forest} />
        }
      >
        <Header title="My Profile" onBack={handleBack} />

        <View style={styles.avatarBlock}>
          <TouchableOpacity
            style={styles.avatarRing}
            onPress={handlePickImage}
            disabled={isUploadingImage}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[C.gold, C.forest]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradientRing}
            >
              <View style={styles.avatar}>
                {profile?.profile_image_url ? (
                  <Image source={{ uri: profile.profile_image_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {email ? email[0].toUpperCase() : "U"}
                  </Text>
                )}
                {isUploadingImage ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
            </LinearGradient>
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color={C.forest} />
            </View>
          </TouchableOpacity>
          <Text style={styles.nameText}>{fullName || "Your name"}</Text>
          {nickname ? <Text style={styles.handleText}>@{nickname}</Text> : null}
        </View>

        <SectionLabel icon="wallet-outline" text="Dedicated Account" />
        <View style={styles.card}>
          {walletLoading ? (
            <View style={styles.cardLoading}>
              <ActivityIndicator color={C.forest} />
            </View>
          ) : accountNumber ? (
            <View style={styles.accountRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountNumber}>{formatAccountNumber(accountNumber)}</Text>
                <Text style={styles.accountMeta}>{accountTitle}</Text>
                <Text style={styles.accountMeta}>{bankName}</Text>
              </View>
              <TouchableOpacity onPress={handleCopyAccount} style={styles.copyButton} activeOpacity={0.7}>
                <Ionicons name="copy-outline" size={16} color={C.forest} />
                <Text style={styles.copyText}>Copy</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyRow}>
              <Ionicons name="information-circle-outline" size={18} color={C.faint} />
              <Text style={styles.emptyText}>Dedicated account is not integrated here yet.</Text>
            </View>
          )}
        </View>

        <SectionLabel icon="person-outline" text="Personal Details" />
        <View style={styles.card}>
          <Field
            label="Nickname"
            value={nickname}
            onChangeText={(value) => setNickname(value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24))}
            placeholder="yourname"
            prefix="@"
            hint={nicknameHint}
            state={nicknameState}
            focused={focusedField === "nickname"}
            onFocus={() => setFocusedField("nickname")}
            onBlur={() => setFocusedField(null)}
          />

          <View style={styles.divider} />

          <GenderField value={gender} onPress={() => setShowGenderPicker(true)} focused={focusedField === "gender"} />

          <View style={styles.divider} />

          <DateField value={dob} onPress={openDatePicker} focused={focusedField === "dob"} />

          <View style={styles.divider} />

          <ReadonlyRow
            label="Email"
            value={email}
            hint="Email changes require verification."
            verified
            onPress={() => router.push("/(app)/change-email")}
          />

          <View style={styles.divider} />

          <Field
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Add your address"
            multiline
            focused={focusedField === "address"}
            onFocus={() => setFocusedField("address")}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <SectionLabel icon="call-outline" text="Contact" />
        <View style={styles.card}>
          {/* Country + phone are editable here: registration already collects
              them, so this screen edits rather than locks them. Phone is kept
              digits-only and length-validated against the selected country. */}
          <View style={styles.field}>
            <Text style={styles.label}>Mobile Number</Text>
            <View
              style={[
                styles.inputWrap,
                focusedField === "phone" && styles.inputWrapFocused,
              ]}
            >
              <TouchableOpacity
                style={styles.countryChip}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.7}
              >
                <Image
                  source={country === "GH" ? require("@/assets/images/gh-flag.png") : require("@/assets/images/ng-flag.png")}
                  style={styles.countryFlag}
                />
                <Text style={styles.countryCode}>
                  {COUNTRY_DIAL_CODES[country]}
                </Text>
                <Ionicons name="chevron-down" size={14} color={C.faint} />
              </TouchableOpacity>
              <TextInput
                value={phone}
                onChangeText={(value) => setPhone(value.replace(/\D/g, ""))}
                placeholder={country === "GH" ? "e.g. 241234567" : "e.g. 8012345678"}
                placeholderTextColor={C.faint}
                keyboardType="phone-pad"
                maxLength={countryMeta[country].maxLength}
                style={styles.input}
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <Text
              style={[
                styles.hint,
                !isPhoneValid && phone.length > 0 && { color: C.danger },
              ]}
            >
              {isPhoneValid || !phone
                ? countryMeta[country].hint
                : `Wrong length for ${countryMeta[country].label}.`}
            </Text>
          </View>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Sticky save bar */}
      <View style={styles.saveBar} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.primaryButton, saveDisabled && styles.primaryButtonDisabled]}
          onPress={handleSave}
          disabled={saveDisabled}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryText}>{isDirty ? "Save Changes" : "Saved"}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Country picker: same two-country list as registration */}
      {showCountryPicker && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCountryPicker(false)}>
            <Pressable style={styles.optionCard} onPress={() => { }}>
              {([
                { value: "NG" as SupportedCountry, flag: require("@/assets/images/ng-flag.png") },
                { value: "GH" as SupportedCountry, flag: require("@/assets/images/gh-flag.png") },
              ]).map(({ value, flag }) => (
                <TouchableOpacity
                  key={value}
                  style={styles.optionRow}
                  onPress={() => {
                    setCountry(value);
                    setPhone(""); // lengths differ per country; start fresh
                    setShowCountryPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Image source={flag} style={styles.countryFlag} />
                    <Text style={styles.optionText}>
                      {countryMeta[value].label} ({COUNTRY_DIAL_CODES[value]})
                    </Text>
                  </View>
                  {country === value ? (
                    <Ionicons name="checkmark" size={20} color={C.forest} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Gender picker: bottom sheet list on iOS, plain modal list on Android */}
      {showGenderPicker &&
        (Platform.OS === "ios" ? (
          <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => setShowGenderPicker(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setShowGenderPicker(false)}>
              <Pressable style={styles.sheet} onPress={() => { }}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                    <Text style={styles.sheetCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>Gender</Text>
                  <View style={styles.backButton} />
                </View>
                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.optionRow}
                    onPress={() => {
                      setGender(option);
                      setShowGenderPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, gender === option && styles.optionTextSelected]}>
                      {option}
                    </Text>
                    {gender === option ? (
                      <Ionicons name="checkmark" size={20} color={C.forest} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </Pressable>
            </Pressable>
          </Modal>
        ) : (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setShowGenderPicker(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setShowGenderPicker(false)}>
              <Pressable style={styles.optionCard} onPress={() => { }}>
                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.optionRow}
                    onPress={() => {
                      setGender(option);
                      setShowGenderPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, gender === option && styles.optionTextSelected]}>
                      {option}
                    </Text>
                    {gender === option ? (
                      <Ionicons name="checkmark" size={20} color={C.forest} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </Pressable>
            </Pressable>
          </Modal>
        ))}

      {/* Date picker */}
      {Platform.OS === "ios" ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
            <Pressable style={styles.sheet} onPress={() => { }}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.sheetCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Date of Birth</Text>
                <TouchableOpacity onPress={confirmIosDate}>
                  <Text style={styles.sheetDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate || dateValue}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={handleDateChange}
                style={{ alignSelf: "center" }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={dateValue}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={handleDateChange}
          />
        )
      )}
    </SafeAreaView>
  );
}

function formatAccountNumber(value: string) {
  return value.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={20} color={C.forest} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function SectionLabel({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon} size={14} color={C.muted} />
      <Text style={styles.sectionLabelText}>{text}</Text>
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
  multiline,
  focused,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  hint?: string;
  prefix?: string;
  state?: NicknameState;
  multiline?: boolean;
  focused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const hintColor =
    state === "available" ? C.forest : state === "taken" ? C.danger : C.muted;

  const borderStyle =
    state === "checking"
      ? styles.inputWrapChecking
      : state === "available"
        ? styles.inputWrapAvailable
        : state === "taken"
          ? styles.inputWrapTaken
          : focused
            ? styles.inputWrapFocused
            : null;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, borderStyle, multiline && styles.inputWrapMultiline]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          style={[styles.input, multiline && styles.multilineInput]}
          multiline={multiline}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {state === "checking" ? (
          <ActivityIndicator size="small" color={C.info} />
        ) : state === "available" ? (
          <View style={[styles.statusChip, { backgroundColor: C.forestLight }]}>
            <Ionicons name="checkmark" size={13} color={C.forest} />
          </View>
        ) : state === "taken" ? (
          <View style={[styles.statusChip, { backgroundColor: C.dangerSoft }]}>
            <Ionicons name="close" size={13} color={C.danger} />
          </View>
        ) : null}
      </View>
      {hint ? <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
}

/** Gender options offered in the profile picker (mirrors registration). */
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"] as const;

/** Dial codes for the countries registration supports. */
const COUNTRY_DIAL_CODES: Record<SupportedCountry, string> = {
  NG: "+234",
  GH: "+233",
};

function GenderField({
  value,
  onPress,
  focused,
}: {
  value: string;
  onPress: () => void;
  focused?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Gender</Text>
      <TouchableOpacity
        style={[styles.inputWrap, focused && styles.inputWrapFocused]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <Ionicons name="person-circle-outline" size={18} color={C.forest} style={{ marginRight: 10 }} />
        <Text style={[styles.readonlyValue, !value && styles.placeholderText]}>
          {value || "Select gender"}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </TouchableOpacity>
    </View>
  );
}

function DateField({
  value,
  onPress,
  focused,
}: {
  value: string;
  onPress: () => void;
  focused?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Date of Birth</Text>
      <TouchableOpacity
        style={[styles.inputWrap, focused && styles.inputWrapFocused]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <Ionicons name="calendar-outline" size={18} color={C.forest} style={{ marginRight: 10 }} />
        <Text style={[styles.readonlyValue, !value && styles.placeholderText]}>
          {value ? formatDisplayDate(value) : "Select date of birth"}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </TouchableOpacity>
    </View>
  );
}

function formatDisplayDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function ReadonlyRow({
  label,
  value,
  hint,
  verified,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  verified?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {verified && value ? (
          <View style={styles.verifiedPill}>
            <Ionicons name="shield-checkmark" size={11} color={C.forest} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : null}
      </View>
      <TouchableOpacity style={styles.inputWrap} onPress={onPress} activeOpacity={0.75}>
        <Ionicons name="mail-outline" size={18} color={C.forest} style={{ marginRight: 10 }} />
        <Text style={[styles.readonlyValue, !value && styles.placeholderText]}>
          {value || "Add email"}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ProfileSkeleton({ onBack }: { onBack: () => void }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Header title="My Profile" onBack={onBack} />
        <View style={styles.avatarBlock}>
          <Animated.View style={[styles.skeletonAvatar, { opacity: pulse }]} />
          <Animated.View style={[styles.skeletonLine, { width: 140, opacity: pulse }]} />
        </View>
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={[styles.skeletonCard, { opacity: pulse }]} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 140 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: C.forest, fontSize: 18, fontWeight: "800" },

  avatarBlock: { alignItems: "center", marginBottom: 24 },
  avatarRing: { width: 100, height: 100 },
  avatarGradientRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: C.goldSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: { color: C.forest, fontSize: 32, fontWeight: "900" },
  avatarImage: { width: "100%", height: "100%" },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,59,46,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.bg,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  nameText: { color: C.forest, fontSize: 19, fontWeight: "900", marginTop: 12 },
  handleText: { color: C.muted, fontSize: 13, fontWeight: "700", marginTop: 2 },

  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 4,
  },
  sectionLabelText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#0B2E23",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardLoading: { paddingVertical: 18, alignItems: "center" },

  accountRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  accountNumber: { color: C.forest, fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  accountMeta: { color: C.muted, fontSize: 13, fontWeight: "600", marginTop: 3 },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.forestLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  copyText: { color: C.forest, fontSize: 12, fontWeight: "800" },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  emptyText: { color: C.muted, fontSize: 13, fontWeight: "600", flexShrink: 1 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 4 },

  field: { paddingVertical: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  label: { color: C.forest, fontSize: 12.5, fontWeight: "800", marginBottom: 8, letterSpacing: 0.2 },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.forestLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedText: { color: C.forest, fontSize: 10.5, fontWeight: "800" },

  inputWrap: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.3,
    borderColor: "transparent",
    backgroundColor: "#F7FAF8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  inputWrapMultiline: { alignItems: "flex-start", paddingTop: 12 },
  inputWrapFocused: { borderColor: C.forest, backgroundColor: "#FFFFFF" },
  inputWrapChecking: { borderColor: C.info, backgroundColor: C.infoSoft },
  inputWrapAvailable: { borderColor: C.forest, backgroundColor: C.forestLight },
  inputWrapTaken: { borderColor: C.danger, backgroundColor: C.dangerSoft },

  statusChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  prefix: { color: C.forest, fontSize: 15, fontWeight: "900", marginRight: 2 },
  input: { flex: 1, color: C.forest, fontSize: 15, fontWeight: "700", paddingVertical: 12 },
  readonlyValue: { flex: 1, color: C.forest, fontSize: 15, fontWeight: "700" },
  placeholderText: { color: C.faint, fontWeight: "500" },
  multilineInput: { minHeight: 76, textAlignVertical: "top" },
  countryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  countryFlag: { width: 24, height: 16, borderRadius: 3 },
  countryCode: { color: C.forest, fontSize: 14, fontWeight: "800" },

  hint: { fontSize: 12, fontWeight: "700", marginTop: 6 },

  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    backgroundColor: "rgba(244,247,245,0.92)",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: C.forest,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryButtonDisabled: { opacity: 0.4, shadowOpacity: 0 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(6,20,15,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  optionText: { color: C.forest, fontSize: 15, fontWeight: "700" },
  optionTextSelected: { fontWeight: "900" },
  optionCard: {
    alignSelf: "stretch",
    marginHorizontal: 40,
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: "hidden",
  },

  sheetCancel: { color: C.muted, fontSize: 15, fontWeight: "700" },
  sheetTitle: { color: C.forest, fontSize: 15, fontWeight: "900" },
  sheetDone: { color: C.forest, fontSize: 15, fontWeight: "900" },

  skeletonAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E0E7E3",
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E0E7E3",
    marginTop: 14,
  },
  skeletonCard: {
    height: 90,
    borderRadius: 20,
    backgroundColor: "#E9EFEC",
    marginBottom: 16,
  },
});