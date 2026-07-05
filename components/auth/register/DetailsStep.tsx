import React from "react";
import { Pressable, Text, View } from "react-native";
import { AuthField, FooterLink, PrimaryButton } from "./FormControls";
import { countryMeta } from "./constants";
import { styles } from "./styles";
import type { RegisterDraft, SupportedCountry } from "./types";

type Props = {
  draft: RegisterDraft;
  password: string;
  confirmPassword: string;
  viewPassword: boolean;
  onDraftChange: (patch: Partial<RegisterDraft>) => void;
  onPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
  onTogglePassword: () => void;
  onContinue: () => void;
  onStartOver: () => void;
  normalizeUsername: (value: string) => string;
};

export const DetailsStep = ({
  draft,
  password,
  confirmPassword,
  viewPassword,
  onDraftChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onContinue,
  onStartOver,
  normalizeUsername,
}: Props) => (
  <View style={styles.detailsBody}>
    <Text style={styles.largeTitle}>Let{"'"}s get you started</Text>

    <AuthField
      label="Legal First Name"
      icon="person-outline"
      value={draft.firstName}
      onChangeText={(firstName) => onDraftChange({ firstName })}
      autoCapitalize="words"
    />
    <AuthField
      label="Legal Last Name"
      icon="person-outline"
      value={draft.lastName}
      onChangeText={(lastName) => onDraftChange({ lastName })}
      autoCapitalize="words"
    />
    <AuthField
      label="Username"
      icon="person-outline"
      value={draft.username}
      onChangeText={(username) =>
        onDraftChange({ username: normalizeUsername(username) })
      }
      autoCapitalize="none"
    />

    <Text style={styles.segmentLabel}>Country</Text>
    <View style={styles.countryGroup}>
      {(["NG", "GH"] as SupportedCountry[]).map((option) => (
        <Pressable
          key={option}
          onPress={() => onDraftChange({ country: option, phone: "" })}
          style={[
            styles.countryOption,
            draft.country === option && styles.countryOptionActive,
          ]}
        >
          <Text
            style={[
              styles.countryText,
              draft.country === option && styles.countryTextActive,
            ]}
          >
            {countryMeta[option].label}
          </Text>
        </Pressable>
      ))}
    </View>

    <AuthField
      label="Phone Number"
      icon="phone-portrait-outline"
      value={draft.phone}
      onChangeText={(phone) => onDraftChange({ phone: phone.replace(/\D/g, "") })}
      keyboardType="phone-pad"
      maxLength={countryMeta[draft.country].maxLength}
    />
    <AuthField
      label="Password"
      icon={viewPassword ? "eye-outline" : "eye-off-outline"}
      value={password}
      onChangeText={onPasswordChange}
      secureTextEntry={!viewPassword}
      onIconPress={onTogglePassword}
    />
    <AuthField
      label="Confirm Password"
      icon={viewPassword ? "eye-outline" : "eye-off-outline"}
      value={confirmPassword}
      onChangeText={onConfirmPasswordChange}
      secureTextEntry={!viewPassword}
      onIconPress={onTogglePassword}
    />

    <PrimaryButton label="Continue" onPress={onContinue} />
    <FooterLink text="Wrong email?" action="Start over" onPress={onStartOver} />
  </View>
);
