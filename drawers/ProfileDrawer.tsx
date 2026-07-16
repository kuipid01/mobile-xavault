import { getAccessToken } from "@/api/auth";
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
  { label: "Nest", icon: "cube-outline", href: "/(app)/(tabs)/(plan)/plans" },
  { label: "Chat", icon: "chatbubble-ellipses-outline" },
  { label: "About Us", icon: "information-circle-outline" },
];

export default function ProfileDrawerContent({
  onClose,
}: DrawerContentProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

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
          <Image
            source={{
              uri: "https://i.pinimg.com/1200x/31/02/62/3102629a406ed439592d5833f0faa979.jpg",
            }}
            style={styles.avatar}
          />
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
              style={({ pressed }) => [
                styles.menuItem,

                pressed && styles.menuItemPressed,
              ]}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={19} color={COLORS.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons
                name="chevron-forward"
                size={17}
                color="rgba(255,255,255,0.38)"
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.referCard}>
          <View style={styles.referIcon}>
            <Ionicons name="gift-outline" size={20} color="#063B2E" />
          </View>
          <View style={styles.referText}>
            <Text style={styles.referTitle}>Refer a friend</Text>
            <Text style={styles.referBody}>
              Invite someone to build better vault habits with you.
            </Text>
          </View>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: COLORS.primary,

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

    display: "flex",
  },
  menuItem: {
    alignItems: "center",
    borderRadius: 18,
    display: "flex",
    flexDirection: "row",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 12,

  },
  menuItemPressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  menuIcon: {
    alignItems: "center",
    backgroundColor: "rgba(214,168,79,0.13)",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  menuLabel: {
    color: COLORS.white,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  referCard: {
    alignItems: "center",
    backgroundColor: "#D6A84F",
    borderRadius: 20,
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
    padding: 16,
  },
  referIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  referText: {
    flex: 1,
  },
  referTitle: {
    color: "#052B20",
    fontSize: 15,
    fontWeight: "900",
  },
  referBody: {
    color: "rgba(5,43,32,0.72)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
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
});
