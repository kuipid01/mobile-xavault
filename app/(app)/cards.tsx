import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Cards() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Cards</Text>
          <Text style={styles.title}>Spend from the right vault.</Text>
          <Text style={styles.subtitle}>
            Virtual cards will let you tie spending limits to your plans and envelopes.
          </Text>
        </View>

        <LinearGradient
          colors={["#0C1D2C", "#0F6B4F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardPreview}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardBrand}>XAVAULT</Text>
            <Ionicons name="card-outline" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.cardNumber}>••••  ••••  ••••  2048</Text>
          <View style={styles.cardBottom}>
            <Text style={styles.cardMeta}>Virtual Card</Text>
            <Text style={styles.cardMeta}>NGN</Text>
          </View>
        </LinearGradient>

        <View style={styles.panel}>
          <View style={styles.panelIcon}>
            <Ionicons name="sparkles-outline" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.panelTitle}>Card controls are coming next</Text>
          <Text style={styles.panelText}>
            This tab is ready for card creation, freezing, spending rules, and envelope-backed limits once the backend exposes card endpoints.
          </Text>
          <TouchableOpacity style={styles.disabledButton} disabled>
            <Text style={styles.disabledButtonText}>Create Card Soon</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    marginBottom: 22,
  },
  eyebrow: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: COLORS.primary,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    marginTop: 8,
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    marginTop: 10,
  },
  cardPreview: {
    height: 218,
    borderRadius: 28,
    padding: 22,
    justifyContent: "space-between",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardBrand: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cardNumber: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardMeta: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "800",
  },
  panel: {
    marginTop: 22,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E7ECE9",
  },
  panelIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E1FFF1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  panelTitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  panelText: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 21,
    fontWeight: "600",
    marginTop: 8,
  },
  disabledButton: {
    marginTop: 18,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EEF2F0",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButtonText: {
    color: "#7A8580",
    fontWeight: "900",
  },
});
