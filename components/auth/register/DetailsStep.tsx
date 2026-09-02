import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Image, ImageSourcePropType, Modal, Platform, Pressable, Text, View } from "react-native";
import { AuthField, FooterLink, PrimaryButton } from "./FormControls";
import { countryMeta } from "./constants";
import { styles } from "./styles";
import type { RegisterDraft, SupportedCountry } from "./types";

type CountryOption = {
  value: SupportedCountry;
  label: string;
  code: string;
  flag?: ImageSourcePropType;
};

const CountryUI = ({
  options,
  selected,
  onSelect,
}: {
  options: CountryOption[];
  selected: SupportedCountry;
  onSelect: (val: SupportedCountry) => void;
}) => {
  const [clicked, setClicked] = useState(false);
  const selectedOption = options.find((o) => o.value === selected) || options[0];

  return (
    <View className="relative z-50 w-32 mb-4">
      <Pressable
        className="relative w-full h-16 rounded-xl px-4 justify-center bg-[#EEF2F0] border border-transparent"
        onPress={() => setClicked(!clicked)}
      >
        <Text className="absolute left-4 top-2 text-xs text-gray-500">
          Country code
        </Text>
        <View className="flex-row items-center justify-between mt-3">
          <View className="flex-row items-center space-x-2 gap-2">
            {selectedOption.flag && <Image source={selectedOption.flag} className="w-6 h-4 rounded-sm" />}
            <Text className="text-base font-semibold text-[#063B2E]">{selectedOption.code}</Text>
          </View>
          <Ionicons name={clicked ? "chevron-up" : "chevron-down"} size={20} color="gray" />
        </View>
      </Pressable>
      {clicked && (
        <View className="absolute top-18 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-sm z-50 overflow-hidden">
          {options.map((option) => (
            <Pressable
              key={option.value}
              className="flex-row items-center px-4 py-3 border-b border-gray-100 last:border-b-0 active:bg-gray-50"
              onPress={() => {
                onSelect(option.value);
                setClicked(false);
              }}
            >
              <View className="flex-row items-center space-x-3 gap-3">
                {option.flag && <Image source={option.flag} className="w-6 h-4 rounded-sm" />}
                <Text className="text-base font-semibold text-[#063B2E]">{option.label} ({option.code})</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

const GenderUI = ({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (val: string) => void;
}) => {
  const [clicked, setClicked] = useState(false);
  const options = ["Male", "Female", "Other", "Prefer not to say"];
  const selectedOption = selected || "Gender";

  return (
    <View className="relative z-40 w-full mb-4">
      <Pressable
        className="relative w-full h-16 rounded-xl px-4 justify-center bg-[#EEF2F0] border border-transparent"
        onPress={() => setClicked(!clicked)}
      >
        <Text className="absolute left-4 top-2 text-xs text-gray-500">
          Gender
        </Text>
        <View className="flex-row items-center justify-between mt-3">
          <Text className="text-base font-semibold text-[#063B2E]">{selectedOption}</Text>
          <Ionicons name={clicked ? "chevron-up" : "chevron-down"} size={20} color="gray" />
        </View>
      </Pressable>
      {clicked && (
        <View className="absolute top-18 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-sm z-50 overflow-hidden">
          {options.map((option) => (
            <Pressable
              key={option}
              className="flex-row items-center px-4 py-3 border-b border-gray-100 last:border-b-0 active:bg-gray-50"
              onPress={() => {
                onSelect(option);
                setClicked(false);
              }}
            >
              <Text className="text-base font-semibold text-[#063B2E]">{option}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

const DateOfBirthUI = ({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (val: string) => void;
}) => {
  const [show, setShow] = useState(false);
  const date = selected ? new Date(selected) : new Date();

  const onChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShow(false);
    }
    if (selectedDate) {
      onSelect(selectedDate.toISOString().split("T")[0]);
    }
  };

  return (
    <View className="mb-4 w-full">
      <Pressable
        className="relative w-full h-16 rounded-xl px-4 justify-center bg-[#EEF2F0] border border-transparent"
        onPress={() => setShow(true)}
      >
        <Text
          className={`absolute left-4 ${selected ? "top-2 text-xs text-gray-500" : "top-5 text-base text-gray-500"
            }`}
        >
          Date of Birth
        </Text>
        {selected ? (
          <Text className="text-base font-semibold text-[#063B2E] pt-5 pb-1">
            {selected}
          </Text>
        ) : null}
      </Pressable>

      {show &&
        (Platform.OS === "ios" ? (
          <Modal transparent animationType="slide">
            <View className="flex-1 justify-end bg-black/20">
              <View className="bg-white p-4 pb-8 rounded-t-2xl">
                <View className="items-end mb-2">
                  <Pressable onPress={() => setShow(false)}>
                    <Text className="text-[#063B2E] font-semibold text-lg">Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={onChange}
                  maximumDate={new Date()}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={date}
            mode="date"
            onChange={onChange}
            maximumDate={new Date()}
          />
        ))}
    </View>
  );
};

export const PasswordValidationUI = ({ password, textColor }: { password: string, textColor?: string }) => {
  const rules = [
    { label: "1 small letter", isValid: /[a-z]/.test(password) },
    { label: "1 capital letter", isValid: /[A-Z]/.test(password) },
    { label: "1 number", isValid: /[0-9]/.test(password) },
    { label: "1 special character", isValid: /[^a-zA-Z0-9]/.test(password) },
    { label: "8 characters", isValid: password.length >= 8 },
  ];

  return (
    <View className="flex-row flex-wrap mt-2 mb-6 px-1">
      {rules.map((rule, i) => (
        <View key={i} className="w-1/2 flex-row items-center mb-4">
          <View className={`w-5 h-5 rounded-full items-center justify-center mr-2 ${rule.isValid ? 'bg-[#063B2E]' : 'bg-[#EF4444]'}`}>
            <Ionicons name={rule.isValid ? "checkmark" : "close"} size={14} color="white" />
          </View>
          <Text className={textColor ? `text-white/90 text-[13px]` : `text-gray-600 text-[13px]`}>{rule.label}</Text>
        </View>
      ))}
    </View>
  );
};

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

export const RegHeader = ({ closeFlow }: { closeFlow: () => void }) => {
  return (
    <View className="flex-row items-center justify-between border-b border-primary w-full py-6 px-4 bg-white z-10">
      <Pressable hitSlop={10} onPress={() => { closeFlow }}>
        <Ionicons name="arrow-back" size={24} color="black" />
      </Pressable>
      <Text className="text-[30px] font-bold">Personal Details</Text>
      <Ionicons name="person" size={20} color="#063B2E" />
    </View>
  )
}
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
}: Props) => {
  const isPasswordValid =
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^a-zA-Z0-9]/.test(password) &&
    password.length >= 8;

  const isFormValid =
    draft.gender &&
    draft.dob &&
    draft.firstName &&
    draft.lastName &&
    draft.username &&
    draft.phone &&
    isPasswordValid &&
    password === confirmPassword;

  return (
    <>
      <View style={styles.detailsBody}>
        <GenderUI
          selected={draft.gender}
          onSelect={(gender) => onDraftChange({ gender })}
        />

        <DateOfBirthUI
          selected={draft.dob}
          onSelect={(dob) => onDraftChange({ dob })}
        />

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

        <View className="flex-row items-start gap-4 z-50">
          <CountryUI
            options={[
              { value: "NG", label: "NGN", code: "+234", flag: require("../../../assets/images/ng-flag.png") },
              { value: "GH", label: "GHS", code: "+233", flag: require("../../../assets/images/gh-flag.png") }
            ]}
            selected={draft.country}
            onSelect={(country) => onDraftChange({ country, phone: "" })}
          />

          <View className="flex-1">
            <AuthField
              label="Phone Number"
              value={draft.phone}
              onChangeText={(phone) => onDraftChange({ phone: phone.replace(/\D/g, "") })}
              keyboardType="phone-pad"
              maxLength={countryMeta[draft.country].maxLength}
            />
          </View>
        </View>

        <AuthField
          label="Citizenship"
          value={countryMeta[draft.country].label}
          editable={false}
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

        <PasswordValidationUI password={password} />

        <PrimaryButton label="Continue" onPress={onContinue} disabled={!isFormValid} />
        <FooterLink text="Wrong email?" action="Start over" onPress={onStartOver} />
      </View>
    </>
  );
};
