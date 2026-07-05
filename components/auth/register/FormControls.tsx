import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "./styles";

type AuthFieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onIconPress?: () => void;
};

export const AuthField = ({
  label,
  icon,
  onIconPress,
  style,
  ...props
}: AuthFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const isActive = isFocused || !!props.value;

  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldRow}>
        <Text
          style={[
            styles.floatingLabel,
            isActive && styles.floatingLabelActive,
          ]}
        >
          {label}
        </Text>

        <TextInput
          {...props}
          placeholder=""
          style={[styles.fieldInput, style]}
          onFocus={(event) => {
            setIsFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            props.onBlur?.(event);
          }}
        />

        {icon && (
          <TouchableOpacity onPress={onIconPress} style={styles.fieldIcon}>
            <Ionicons name={icon} size={22} color="#AAB1C0" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const PinField = ({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) => {
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.pinField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry={false}
        style={styles.hiddenPinInput}
      />

      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={styles.pinLineRow}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={styles.pinBox}>
            <Text style={styles.pinText}>{value[index] ? "*" : ""}</Text>
          </View>
        ))}
      </TouchableOpacity>
    </View>
  );
};

export const PrimaryButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    activeOpacity={0.9}
    disabled={disabled}
    onPress={onPress}
    style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
  >
    <Text style={styles.primaryButtonText}>{label}</Text>
  </TouchableOpacity>
);

export const FooterLink = ({
  text,
  action,
  onPress,
}: {
  text: string;
  action: string;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress}>
    <Text style={styles.footerText}>
      {text} <Text style={styles.footerLink}>{action}</Text>
    </Text>
  </Pressable>
);
