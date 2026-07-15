import { getAccessToken, useAuth } from "@/api/auth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSubscriptionPrompt } from "../../../hooks/use-subscription-prompt";

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
  dangerBg: "#FFF1F3",
};

type JwtWithEmail = { email?: string; sub?: string;[key: string]: unknown };

function SettingRow({
  icon,
  label,
  sublabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.72} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={C.forest} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sublabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </TouchableOpacity>
  );
}

export default function Profile() {
  const [email, setEmail] = useState<string | null>(null);
  const { logout } = useAuth();
  const { maybeShowSubscriptionPrompt } = useSubscriptionPrompt();
  useEffect(() => {
    getAccessToken().then((token) => {
      if (!token) return;
      try {
        const payload = jwtDecode<JwtWithEmail>(token);
        setEmail(payload.email ?? payload.sub ?? null);
      } catch {
        setEmail(null);
      }
    });
  }, []);

  const avatarLetter = email ? email[0].toUpperCase() : "U";

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <TouchableOpacity
              style={styles.avatar}
              activeOpacity={0.8}
              onPress={() => router.push("/(app)/my-profile")}
            >
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              <View style={styles.cameraBadge}>
                <Ionicons name="camera-outline" size={13} color={C.forest} />
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroName}>{email ?? "XAVAULT User"}</Text>
          <Text style={styles.heroSub}>Manage your account settings</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>General</Text>
        </View>

        <View style={styles.card}>
          <SettingRow
            icon="person-outline"
            label="My Profile"
            sublabel="Account number, nickname, contact and address"
            onPress={() => router.push("/(app)/my-profile")}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="card-outline"
            label="Payment Settings"
            sublabel="Change payment PIN or recover access"
            onPress={() => router.push("/(app)/payment-settings")}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="lock-closed-outline"
            label="Login Settings"
            sublabel="Password, biometric login and pattern setup"
            onPress={() => router.push("/(app)/login-settings")}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="help-buoy-outline"
            label="Security Questions"
            sublabel="Add extra checks for account recovery"
            onPress={() => router.push("/(app)/security-questions")}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="help-buoy-outline"
            label="Upgrade Plan"
            sublabel=""
            onPress={async () => {
              const shown = await maybeShowSubscriptionPrompt("manual_upgrade_button");
              if (!shown) router.push("/(app)/upgrade-plan");
            }}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Support</Text>
        </View>

        <View style={styles.card}>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Feedback & Suggestions"
            sublabel="Tell us what to improve next"
            onPress={() => router.push("/(app)/feedback-suggestions")}
          />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <View style={styles.logoutIconBox}>
            <Ionicons name="log-out-outline" size={18} color={C.danger} />
          </View>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>XAVAULT · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 },
  hero: {
    backgroundColor: C.forest,
    borderRadius: 32,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: C.forest,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  avatarRing: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 2.5,
    borderColor: "rgba(214,168,79,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: C.forest, fontSize: 28, fontWeight: "900" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    maxWidth: 270,
  },
  heroSub: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  sectionHeader: { marginBottom: 10, marginTop: 4 },
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: C.forest,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { color: C.forest, fontSize: 15, fontWeight: "900" },
  rowSub: { color: C.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginHorizontal: 16,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.dangerBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FECDD3",
    marginTop: 4,
  },
  logoutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFE4E7",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: C.danger, fontSize: 15, fontWeight: "900" },
  version: {
    textAlign: "center",
    color: C.faint,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 24,
    letterSpacing: 0.8,
  },
});
