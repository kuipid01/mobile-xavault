import { useSaveSecurityQuestions, useSecurityQuestions } from "@/hooks/app/profile";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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

const QUESTIONS = [
  "What was the name of your first school?",
  "What city were you born in?",
  "What is your favorite childhood nickname?",
];

export default function SecurityQuestionsScreen() {
  const { data: savedQuestions = [], isLoading } = useSecurityQuestions();
  const { mutateAsync: saveSecurityQuestions, isPending: isSaving } = useSaveSecurityQuestions();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!savedQuestions.length) return;
    setAnswers(
      savedQuestions.reduce<Record<string, string>>((acc, item) => {
        acc[item.question] = "";
        return acc;
      }, {})
    );
  }, [savedQuestions]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/profile");
  };

  const handleSave = async () => {
    const questions = QUESTIONS.map((question) => ({
      question,
      answer: answers[question]?.trim() || "",
    })).filter((item) => item.answer);

    if (questions.length === 0) {
      Toast.show({ type: "error", text1: "Answer at least one question" });
      return;
    }

    try {
      await saveSecurityQuestions(questions);
      Toast.show({ type: "success", text1: "Security questions saved" });
    } catch {
      Toast.show({ type: "error", text1: "Could not save questions" });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header title="Security Questions" subtitle="Extra checks for account recovery." onBack={handleBack} />

        <View style={styles.card}>
          {isLoading ? <ActivityIndicator color={C.forest} /> : null}
          {savedQuestions.length ? (
            <Text style={styles.savedText}>Saved questions are on file. Enter new answers to replace them.</Text>
          ) : null}
          {QUESTIONS.map((question) => (
            <View key={question} style={styles.field}>
              <Text style={styles.label}>{question}</Text>
              <TextInput
                value={answers[question] ?? ""}
                onChangeText={(value) => setAnswers((current) => ({ ...current, [question]: value }))}
                placeholder="Enter answer"
                placeholderTextColor={C.faint}
                style={styles.input}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.primaryButton, isSaving && { opacity: 0.55 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Save Questions</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color={C.forest} />
      </TouchableOpacity>
      <View style={styles.headerIcon}>
        <Ionicons name="help-buoy-outline" size={25} color={C.forest} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
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
  title: { color: C.forest, fontSize: 24, fontWeight: "900" },
  subtitle: { color: C.muted, fontSize: 13, fontWeight: "700", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 18 },
  savedText: { color: C.muted, fontSize: 12, fontWeight: "700", marginBottom: 14 },
  field: { marginBottom: 16 },
  label: { color: C.forest, fontSize: 13, fontWeight: "900", marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#F9FBFA",
    paddingHorizontal: 14,
    color: C.forest,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
});
