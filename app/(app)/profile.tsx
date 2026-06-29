import { logoutUser } from "@/api/auth";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const settings = [
  { icon: "person-outline" as const, title: "Account details", value: "Profile, email, password" },
  { icon: "notifications-outline" as const, title: "Notifications", value: "Plan and wallet alerts" },
  { icon: "shield-checkmark-outline" as const, title: "Security", value: "Device and login protection" },
];

export default function Profile() {
  const handleLogout = async () => {
    await logoutUser();
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>XA</Text>
          </View>
          <Text style={styles.name}>XAVAULT User</Text>
          <Text style={styles.email}>Manage your vault preferences</Text>
        </View>

        <View style={styles.list}>
          {settings.map((item) => (
            <View key={item.title} style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name={item.icon} size={20} color={COLORS.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowValue}>{item.value}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A0A6A3" />
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#B42318" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FD",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
  },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.tertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  name: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "900",
  },
  email: {
    marginTop: 6,
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    marginTop: 22,
    gap: 12,
  },
  row: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E7ECE9",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E1FFF1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  rowValue: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  logoutButton: {
    height: 54,
    borderRadius: 16,
    marginTop: 22,
    backgroundColor: "#FFF1F3",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "900",
  },
});
