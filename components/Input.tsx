import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import React from "react";
import { COLORS, Radius } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";

type Props = TextInputProps & {
  label: string;
  icon?: any;
  viewPassword?: boolean;
  setViewPassword?: (value: boolean) => void;
};

export const Input = ({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  viewPassword,
  setViewPassword,
  style,
  ...inputProps
}: Props) => {
  const isPassword = secureTextEntry;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>

      <View style={styles.inputContainer}>
        {/* Left icon */}
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={COLORS.primary}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#9AA5A1"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !viewPassword}
          {...inputProps}
          style={[
            styles.input,
            icon && { paddingLeft: 40 },
            isPassword && { paddingRight: 45 },
            style,
          ]}
        />

        {/* Password toggle icon */}
        {isPassword && setViewPassword && (
          <TouchableOpacity
            onPress={() => setViewPassword(!viewPassword)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={viewPassword ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },

  label: {
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.text,
    marginBottom: 8,
    fontWeight: "800",
    fontFamily: "PlayfairDisplay_700Bold",
  },

  inputContainer: {
    position: "relative",
    height: 56,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E1E7E4",
    borderRadius: Radius.large,
    backgroundColor: COLORS.white,
    shadowColor: "#063B2E",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },

  input: {
    height: "100%",
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "600",
    fontFamily: "PlayfairDisplay_600SemiBold",
  },

  leftIcon: {
    position: "absolute",
    left: 12,
    zIndex: 10,
  },

  rightIcon: {
    position: "absolute",
    right: 12,
    zIndex: 10,
  },
});
