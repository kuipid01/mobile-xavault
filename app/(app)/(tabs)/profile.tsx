import { getAccessToken, useAuth } from "@/api/auth";
import { ProfileAvatar } from "@/components/general/ProfileAvatar";
import { useProfile } from "@/hooks/app/profile";
import { useActiveSubscription } from "@/hooks/app/subscription";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSubscriptionPrompt } from "../../../hooks/use-subscription-prompt";


const C = {
  forest: "#063B2E",
  forestDeep: "#042A20",
  forestLight: "#E6F7EF",
  gold: "#D6A84F",
  goldSoft: "#F1DFB8",
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  ink: "#0F1F1A",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E9EFEC",
  danger: "#B42318",
};

type JwtWithEmail = { email?: string; sub?: string;[key: string]: unknown };

const planVisuals = {
  free: {
    colors: ["#FFFFFF", "#F7FAF8"] as const,
    icon: "leaf-outline" as const,
    caption: "Start with simple vault habits",
    textColor: C.forest,
    mutedColor: C.muted,
  },
  lite: {
    colors: ["#ECFFF5", "#D9F6E7"] as const,
    icon: "sparkles-outline" as const,
    caption: "More room for everyday goals",
    textColor: C.forest,
    mutedColor: "#4D7465",
  },
  premium: {
    colors: ["#FFF7DC", "#F4D58E"] as const,
    icon: "diamond-outline" as const,
    caption: "Built for salary structure",
    textColor: "#4A3406",
    mutedColor: "#775C19",
  },
  power: {
    colors: ["#17251F", "#063B2E", "#D6A84F"] as const,
    icon: "flash-outline" as const,
    caption: "Unlimited vault capacity",
    textColor: "#FFFFFF",
    mutedColor: "rgba(255,255,255,0.76)",
  },
};

function SettingRow({
  icon,
  label,
  sublabel,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={onPress}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={19} color={C.forest} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowSub}>{sublabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={C.faint} />
      </TouchableOpacity>
      {!last ? <View style={styles.divider} /> : null}
    </>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionRule} />
      <Text style={styles.sectionLabel}>{text}</Text>
    </View>
  );
}

export default function Profile() {
  const [email, setEmail] = useState<string | null>(null);
  const { logout } = useAuth();
  const { maybeShowSubscriptionPrompt } = useSubscriptionPrompt();
  const { data: profile } = useProfile();
  const { data: activeSubscription } = useActiveSubscription({ enabled: true });
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

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.nickname ||
    email ||
    "XAVAULT User";
  const displayEmail = profile?.email || email || "Complete your profile";
  const planCode = activeSubscription?.plan?.Code || "free";
  const plan = planVisuals[planCode] || planVisuals.free;

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    // One tap = one logout. Rapid taps can't stack parallel teardown chains
    // (the same disease Switch Account had).
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    void (async () => {
      try {
        // Await the local teardown BEFORE navigating so the login screen never
        // mounts while the biometric key still exists (it would auto-unlock
        // straight back into the app). logout() is instant-local; the server
        // revoke inside it is already fire-and-forget.
        await logout();
        router.replace("/(auth)/login");
      } finally {
        setIsLoggingOut(false);
      }
    })();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Profile</Text>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => router.push("/(app)/my-profile")}
            style={styles.avatarRing}
            accessibilityRole="button"
            accessibilityLabel="Open my profile"
          >
            <View style={styles.avatar}>
              <ProfileAvatar profile={profile} size={68} />
            </View>
            <View style={styles.cameraBadge}>
              <Ionicons name="pencil" size={12} color={C.forest} />
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {displayEmail}
          </Text>
        </View>

        <LinearGradient
          colors={plan.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.planBanner}
        >
          <View style={styles.planShine} />
          <View style={styles.planIcon}>
            <Ionicons name={plan.icon} size={20} color={plan.textColor} />
          </View>
          <View style={styles.planText}>
            <Text style={[styles.planName, { color: plan.textColor }]}>
              {activeSubscription?.plan?.Name || "Free"}
            </Text>
            <Text style={[styles.planCaption, { color: plan.mutedColor }]}>
              {plan.caption}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={async () => {
              const shown = await maybeShowSubscriptionPrompt("manual_upgrade_button");
              if (!shown) router.push("/(app)/upgrade-plan");
            }}
            style={[
              styles.planAction,
              planCode === "power" && styles.planActionOnDark,
            ]}
          >
            <Text
              style={[
                styles.planActionText,
                planCode === "power" && styles.planActionTextOnDark,
              ]}
            >
              {planCode === "power" ? "Top tier" : "Upgrade"}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        <SectionLabel text="General" />

        <View style={styles.card}>
          <SettingRow
            icon="person-outline"
            label="My Profile"
            sublabel="Account number, nickname, contact and address"
            onPress={() => router.push("/(app)/my-profile")}
          />
          <SettingRow
            icon="receipt-outline"
            label="Transactions"
            sublabel="View deposits, withdrawals and transaction receipts"
            onPress={() => router.push("/(app)/transactions")}
          />
          <SettingRow
            icon="card-outline"
            label="Payment Settings"
            sublabel="Change payment PIN or recover access"
            onPress={() => router.push("/(app)/payment-settings")}
          />
          <SettingRow
            icon="lock-closed-outline"
            label="Login Settings"
            sublabel="Password, biometric login and pattern setup"
            onPress={() => router.push("/(app)/login-settings")}
          />
          <SettingRow
            icon="help-buoy-outline"
            label="Security Questions"
            sublabel="Add extra checks for account recovery"
            onPress={() => router.push("/(app)/security-questions")}
          />
          <SettingRow
            icon="diamond-outline"
            label="Upgrade Plan"
            sublabel="Increase vault capacity and plan limits"
            onPress={async () => {
              const shown = await maybeShowSubscriptionPrompt("manual_upgrade_button");
              if (!shown) router.push("/(app)/upgrade-plan");
            }}
            last={!__DEV__}
          />
          {__DEV__ ? (
            <SettingRow
              icon="bug-outline"
              label="Subscription Debug"
              sublabel="Test reminders, backoff, and payment verification"
              onPress={() => router.push("/(app)/subscription-debug")}
              last
            />
          ) : null}
        </View>

        <SectionLabel text="Support" />

        <View style={styles.card}>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Feedback & Suggestions"
            sublabel="Tell us what to improve next"
            onPress={() => router.push("/(app)/feedback-suggestions")}
            last
          />
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={C.danger} />
          ) : (
            <Ionicons name="log-out-outline" size={17} color={C.danger} />
          )}
          <Text style={styles.logoutText}>
            {isLoggingOut ? "Logging out..." : "Log out"}
          </Text>
        </TouchableOpacity>

        <View style={styles.versionRow}>
          <View style={styles.versionDot} />
          <Text style={styles.version}>XAVAULT · v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FCF7" },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },

  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  screenTitle: {
    alignSelf: "flex-start",
    color: C.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 30,
  },

  hero: {
    borderColor: "rgba(214,168,79,0.28)",
    borderRadius: 26,
    borderWidth: 1,
    padding: 22,
    marginBottom: 28,
    shadowColor: C.forestDeep,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroEyebrow: {
    color: C.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: C.surface,
    fontSize: 21,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.2,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#CDEFA8",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7FB55A",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cameraBadge: {
    position: "absolute",
    right: 2,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  profileName: {
    color: C.ink,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 14,
    maxWidth: "92%",
    textAlign: "center",
  },
  profileEmail: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
    maxWidth: "92%",
    textAlign: "center",
  },

  planBanner: {
    alignItems: "center",
    borderColor: "rgba(6, 59, 46, 0.08)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: C.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  planShine: {
    backgroundColor: "rgba(255,255,255,0.24)",
    height: 90,
    position: "absolute",
    right: -22,
    top: -34,
    transform: [{ rotate: "24deg" }],
    width: 54,
  },
  planIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 16,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  planText: {
    flex: 1,
  },
  planName: {
    fontSize: 14,
    fontWeight: "900",
  },
  planCaption: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  planAction: {
    backgroundColor: C.forest,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planActionOnDark: {
    backgroundColor: C.gold,
  },
  planActionText: {
    color: C.surface,
    fontSize: 12,
    fontWeight: "800",
  },
  planActionTextOnDark: {
    color: C.forest,
  },
  heroIdentity: { marginTop: 22 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    maxWidth: "70%",
  },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.goldSoft,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierPillText: {
    color: C.forest,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  heroSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12.5,
    fontWeight: "500",
    marginTop: 5,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginTop: 20,
    marginBottom: 16,
  },
  profileCta: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: C.gold,
    borderRadius: 14,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  profileCtaText: {
    color: C.forest,
    fontSize: 13,
    fontWeight: "700",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionRule: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.gold,
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 22,
    overflow: "hidden",
    shadowColor: C.ink,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
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
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { color: C.ink, fontSize: 14.5, fontWeight: "700" },
  rowSub: { color: C.muted, fontSize: 12, fontWeight: "500", marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginHorizontal: 16,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "transparent",
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "rgba(180,35,24,0.22)",
    marginTop: 2,
  },
  logoutText: { color: C.danger, fontSize: 14.5, fontWeight: "700" },

  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 26,
  },
  versionDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.faint,
  },
  version: {
    color: C.faint,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
});
