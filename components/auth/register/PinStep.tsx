import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import { FooterLink, PrimaryButton } from "./FormControls";
import { styles } from "./styles";

type Props = {
  pin: string;
  confirmPin: string;
  isCreating: boolean;
  onPinChange: (pin: string) => void;
  onConfirmPinChange: (pin: string) => void;
  onCreateAccount: () => void;
  onEditDetails: () => void;
};

export const PinStep = ({
  pin,
  confirmPin,
  isCreating,
  onPinChange,
  onConfirmPinChange,
  onCreateAccount,
  onEditDetails,
}: Props) => {
  const isConfirming = pin.length === 4;
  const currentVal = isConfirming ? confirmPin : pin;
  const isError = isConfirming && confirmPin.length === 4 && pin !== confirmPin;
  const hasSubmitted = useRef(false);

  useEffect(() => {
    if (isError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (isConfirming && confirmPin.length === 4 && pin === confirmPin && !isCreating) {
      if (!hasSubmitted.current) {
        hasSubmitted.current = true;
        onCreateAccount();
      }
    }
  }, [isError, isConfirming, confirmPin, pin, isCreating, onCreateAccount]);

  useEffect(() => {
    hasSubmitted.current = false;
  }, [pin, confirmPin]);

  const handlePress = (num: string) => {
    if (!isConfirming) {
      onPinChange(pin + num);
    } else if (confirmPin.length < 4) {
      onConfirmPinChange(confirmPin + num);
    }
  };

  const handleBackspace = () => {
    if (isConfirming) {
      if (confirmPin.length > 0) {
        onConfirmPinChange(confirmPin.slice(0, -1));
      } else {
        // Go back to editing pin
        onPinChange(pin.slice(0, -1));
      }
    } else if (pin.length > 0) {
      onPinChange(pin.slice(0, -1));
    }
  };

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "back"],
  ];

  const title = isConfirming ? "Confirm your PIN" : "Create a PIN";
  let subtitle = isConfirming ? "Please re-enter your 4-digit PIN" : "Create a 4-digit Transaction PIN";
  if (isError) subtitle = "PINs do not match. Please try again.";

  return (
    <View className="flex-1 pt-12 pb-8 bg-white items-center">
      <View className="w-full px-6 mb-12">
        <Text className="text-[32px] font-extrabold text-[#063B2E] mb-2 text-left">{title}</Text>
        <Text className={`text-[16px] text-left ${isError ? "text-[#EF4444]" : "text-gray-500"}`}>{subtitle}</Text>
      </View>

      <View className="flex-row items-center justify-center gap-4 mb-16">
        {[0, 1, 2, 3].map((index) => {
          const isFilled = currentVal.length > index;
          return (
            <View
              key={index}
              className={`w-4 h-4 rounded-full border-[2px] ${
                isError
                  ? "border-[#EF4444] bg-[#EF4444]"
                  : isFilled
                  ? "border-[#063B2E] bg-[#063B2E]"
                  : "border-[#063B2E] bg-transparent"
              }`}
            />
          );
        })}
      </View>

      <View className="flex-col items-center gap-6 w-full px-8 mb-auto">
        {keys.map((row, i) => (
          <View key={i} className="flex-row justify-between w-full max-w-[280px]">
            {row.map((key) => {
              if (key === "") return <View key="empty" className="w-[72px] h-[72px]" />;
              if (key === "back") {
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={handleBackspace}
                    disabled={isCreating}
                    className="w-[72px] h-[72px] rounded-full bg-[#EEF2F0] items-center justify-center active:bg-gray-300"
                  >
                    <Ionicons name="backspace-outline" size={32} color="#063B2E" />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => handlePress(key)}
                  disabled={isCreating}
                  className="w-[72px] h-[72px] rounded-full bg-[#EEF2F0] items-center justify-center active:bg-gray-300"
                >
                  <Text className="text-[32px] font-bold text-[#063B2E]">{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View className="w-full px-6 mt-8 mb-4">
        {isCreating && (
          <Text className="text-center text-[#063B2E] font-semibold mb-4">Creating account...</Text>
        )}
        <FooterLink
          text="Need to change something?"
          action="Edit details"
          onPress={onEditDetails}
        />
      </View>
    </View>
  );
};
