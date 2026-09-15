import { COLORS } from "@/themes/colors";
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
  viewPassword?: boolean;
  setViewPassword?: any;
  iconColor?: string;
};

export const AuthField = ({
  label,
  icon,
  onIconPress,
  style,
  editable = true,
  setViewPassword,
  secureTextEntry,
  viewPassword,
  iconColor,
  ...props
}: AuthFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const isActive = isFocused || !!props.value;
  const isPassword = secureTextEntry;
  return (
    <View className="mb-4 w-full">
      <View
        className={`relative w-full h-16 rounded-xl px-4 justify-center ${editable ? 'bg-[#EEF2F0]' : 'bg-gray-200 opacity-60'} ${isFocused ? 'border border-[#063B2E]' : 'border border-transparent'}`}
      >
        <Text
          className={`absolute left-4 ${isActive ? "top-2 text-xs text-gray-500" : "top-5 text-base text-gray-500"
            }`}
        >
          {label}
        </Text>

        <TextInput
          {...props}
          editable={editable}
          placeholder=""
          className={`text-base font-semibold pt-5 pb-1 w-full h-full ${editable ? 'text-[#063B2E]' : 'text-gray-500'}`}
          style={style}
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
          <TouchableOpacity onPress={() => {
            onIconPress
            if (label === "password") {

              setViewPassword(!viewPassword)
            }
          }} className="absolute right-4 top-0 bottom-0 z-10 justify-center">
            <Ionicons name={icon} size={22} color="#AAB1C0" />
          </TouchableOpacity>
        )}
        {/* Password toggle icon */}
        {isPassword && setViewPassword && (
          <TouchableOpacity
            onPress={() => setViewPassword(!viewPassword)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={viewPassword ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={iconColor || COLORS.primary}
            />
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
