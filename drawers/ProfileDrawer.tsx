import { getAccessToken, useAuth } from "@/api/auth";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "../hooks/app/profile";
import type { DrawerContentProps } from "./types";

type JwtWithEmail = {
  email?: string;
  sub?: string;
  [key: string]: unknown;
};
type DrawerRoute = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: Parameters<typeof router.push>[0];
};

const drawerRoutes: DrawerRoute[] = [
  { label: "Profile", icon: "person-outline", href: "/(app)/my-profile" },
  {
    label: "Payment",
    icon: "card-outline",
    href: "/(app)/payment-settings",
  },
  { label: "Plan", icon: "cube-outline", href: "/(app)/(tabs)/(plan)/plans" },

];

export default function ProfileDrawerContent({
  onClose,
}: DrawerContentProps) {
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const { logout } = useAuth();
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

    AsyncStorage.getItem("name").then(setName);
  }, []);

  const navigateTo = (href?: DrawerRoute["href"]) => {
    onClose();

    if (href) {
      router.push(href);
    }
  };
  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.shell}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 16) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileBlock}>
          {
            profile?.profile_image_url ? <Image
              source={{
                uri: profile?.profile_image_url,
              }}
              style={styles.avatar}
            />

              : <Image
                source={{
                  uri: "https://i.pinimg.com/1200x/31/02/62/3102629a406ed439592d5833f0faa979.jpg",
                }}
                style={styles.avatar}
              />
          }
          <View style={styles.profileText}>
            <Text style={styles.name} numberOfLines={1}>
              {name || email || "Xacvault User"}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              {email || "@xacvault"}
            </Text>
          </View>
        </View>

        <View style={styles.menu}>
          {drawerRoutes.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => navigateTo(item.href)}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.menuItem,
                    pressed ? styles.menuItemPressed : undefined,
                  ]}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name={item.icon} size={19} color={COLORS.white} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {/* <Ionicons
                    name="chevron-forward"
                    size={17}
                    color="rgba(255,255,255,0.38)"
                  /> */}
                </View>
              )}
            </Pressable>
          ))}
        </View>
        <View style={styles.drawerFooter}>
          <View style={styles.securityBadge}>
            <View style={styles.securityBadgeIcon}>
              <Ionicons name="shield-checkmark" size={18} color="#063B2E" />
            </View>
            <View>
              <Text style={styles.securityBadgeTitle}>Protected payments</Text>
              <Text style={styles.securityBadgeText}>PIN-secured withdrawals</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            {({ pressed }) => (
              <View style={[styles.logoutInner, pressed && styles.logoutPressed]}>
                <Ionicons name="power-outline" size={20} color="rgba(226,232,240,0.86)" />
                <Text style={styles.logoutText}>Sign Out</Text>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "#002626",

    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 18,
  },
  profileBlock: {
    alignItems: "flex-start",
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    flexDirection: "column",
    gap: 13,
    paddingBottom: 22,
    paddingRight: 42,
  },
  avatar: {
    backgroundColor: COLORS.white,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 100,
    borderWidth: 1,
    height: 100,
    width: 100,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "700",
  },
  handle: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
  },
  menu: {
    gap: 8,
    paddingTop: 22,
    // removed display: "flex" (default anyway)
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch", // Ensures the pressable stretches to 100% parent width
    borderRadius: 18,
    gap: 12,
    minHeight: 54,
    // paddingHorizontal: 12,
  },
  menuItemPressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "800",
  },
  menuIcon: {
    alignItems: "center",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34,
    color: COLORS.primary,
  },
  menuLabel: {
    color: COLORS.white,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  drawerFooter: {
    marginTop: "auto",
    paddingTop: 36,
  },
  securityBadge: {
    alignItems: "center",
    backgroundColor: "rgba(214,168,79,0.12)",
    borderColor: "rgba(214,168,79,0.28)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  securityBadgeIcon: {
    alignItems: "center",
    backgroundColor: "#D6A84F",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  securityBadgeTitle: {
    color: "#F8E7B8",
    fontSize: 12.5,
    fontWeight: "900",
  },
  securityBadgeText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 2,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    width: 38,
  },
  logoutBtn: {
    marginTop: 4,
  },
  logoutInner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 34,
  },
  logoutPressed: {
    backgroundColor: "#1D2430",
  },
  logoutText: {
    color: "rgba(226,232,240,0.86)",
    fontSize: 20,
    fontWeight: "500",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 16,
  },
});
