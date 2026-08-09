import { COLORS, Padding, Radius } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  fallbackRoute?: string;
};

export function AppScreenHeader({
  title,
  subtitle,
  onBack,
  fallbackRoute = "/(app)/(tabs)/home",
}: Props) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(fallbackRoute as never);
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back"
        activeOpacity={0.75}
        onPress={handleBack}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: Padding.containerX,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: `${COLORS.border}33`,
    borderRadius: Radius.large,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerCopy: { flex: 1 },
  title: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    opacity: 0.75,
  },
});
