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

type ErrorModalProps = {
  visible: boolean;
  message: string;
  title?: string;
  actionLabel?: string;
  onClose: () => void;
};

export function ErrorModal({
  visible,
  title,
  message,
  actionLabel = "OK",
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
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.dialog}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconGlyph}>!</Text>
          </View>

          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={styles.message}>{message}</Text>

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
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },

  dialog: {
    alignItems: "center",
    backgroundColor: "#1A1F29",
    borderRadius: 20,
    elevation: 12,
    paddingBottom: 20,
    paddingHorizontal: 28,
    paddingTop: 28,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    width: "100%",
    maxWidth: 340,
  },

  iconCircle: {
    alignItems: "center",
    backgroundColor: "rgba(255, 82, 82, 0.15)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginBottom: 14,
    width: 44,
  },

  iconGlyph: {
    color: "#FF5252",
    fontSize: 22,
    fontWeight: "700",
  },

  title: {
    color: "#FFFFFF",
    fontFamily: "System",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },

  message: {
    color: "rgba(255, 255, 255, 0.72)",
    fontFamily: "System",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  action: {
    backgroundColor: "#5B9BFF",
    borderRadius: 12,
    marginTop: 24,
    paddingVertical: 12,
    width: "100%",
  },

  actionText: {
    color: "#FFFFFF",
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});