import { BlurView } from "expo-blur";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primary: "#063B2E",
  secondary: "#0F6B4F",
  tertiary: "#D6A84F",
  text: "#404945",
  border: "#717975",
  hash: "#F6F7FB",
  white: "#FFFFFF",
  error: "#D64545",
  errorSoft: "rgba(214, 69, 69, 0.12)",
};

type ErrorModalProps = {
  visible: boolean;
  message: string;
  title?: string;
  actionLabel?: string;
  supportReference?: string;
  onClose: () => void;
};

export function ErrorModal({
  visible,
  title,
  message,
  actionLabel = "OK",
  supportReference,
  onClose,
}: ErrorModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.dialog}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconGlyph}>!</Text>
          </View>

          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={styles.message}>{message}</Text>
          {supportReference ? (
            <View style={styles.referenceBox}>
              <Text style={styles.referenceLabel}>Support reference</Text>
              <Text selectable style={styles.referenceValue}>{supportReference}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onClose}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 59, 46, 0.12)",
  },

  dialog: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    elevation: 12,
    paddingBottom: 20,
    paddingHorizontal: 28,
    paddingTop: 28,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    width: "100%",
    maxWidth: 340,
  },

  iconCircle: {
    alignItems: "center",
    backgroundColor: COLORS.errorSoft,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginBottom: 14,
    width: 44,
  },

  iconGlyph: {
    color: COLORS.error,
    fontSize: 22,
    fontWeight: "700",
  },

  title: {
    color: COLORS.primary,
    fontFamily: "System",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },

  message: {
    color: COLORS.text,
    fontFamily: "System",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  action: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    marginTop: 24,
    paddingVertical: 12,
    width: "100%",
  },

  referenceBox: {
    alignItems: "center",
    backgroundColor: COLORS.hash,
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: "100%",
  },
  referenceLabel: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "600",
    opacity: 0.65,
    textTransform: "uppercase",
  },
  referenceValue: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },

  actionText: {
    color: COLORS.white,
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
