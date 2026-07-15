import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const C = {
  forest: "#063B2E",
  forestLight: "#E6F7EF",
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E4ECE8",
};

export default function FeedbackSuggestionsScreen() {
  const [message, setMessage] = useState("");
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/profile");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color={C.forest} />
          </TouchableOpacity>
          <View style={styles.headerIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={25} color={C.forest} />
          </View>
          <Text style={styles.title}>Feedback & Suggestions</Text>
          <Text style={styles.subtitle}>Share issues, ideas, and improvements.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what you think..."
            placeholderTextColor={C.faint}
            style={styles.textarea}
            multiline
          />
          <TouchableOpacity
            style={[styles.primaryButton, !message.trim() && styles.disabled]}
            disabled={!message.trim()}
            onPress={() => {
              setMessage("");
              Toast.show({ type: "info", text1: "Thanks", text2: "Feedback submission is coming soon." });
            }}
          >
            <Text style={styles.primaryText}>Send Feedback</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { color: C.forest, fontSize: 24, fontWeight: "900", textAlign: "center" },
  subtitle: { color: C.muted, fontSize: 13, fontWeight: "700", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 18 },
  label: { color: C.forest, fontSize: 13, fontWeight: "900", marginBottom: 8 },
  textarea: {
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#F9FBFA",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.forest,
    fontSize: 15,
    fontWeight: "700",
    textAlignVertical: "top",
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  disabled: { opacity: 0.45 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
});
