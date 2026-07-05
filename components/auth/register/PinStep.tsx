import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { FooterLink, PinField, PrimaryButton } from "./FormControls";
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
}: Props) => (
  <View style={styles.pinBody}>
    <View style={styles.pinHeader}>
      <Ionicons name="lock-closed-outline" size={52} color={COLORS.primary} />
      <Text style={styles.largeTitle}>Create PIN</Text>
      <Text style={styles.pinSubtitle}>
        Your PIN adds an extra layer of security.
      </Text>
    </View>

    <View style={styles.pinBlock}>
      <PinField label="Enter your PIN" value={pin} onChangeText={onPinChange} />
      <PinField
        label="Confirm PIN"
        value={confirmPin}
        onChangeText={onConfirmPinChange}
      />
    </View>

    <View style={styles.pinFooter}>
      <PrimaryButton
        label={isCreating ? "Creating..." : "Done"}
        onPress={onCreateAccount}
        disabled={isCreating}
      />
      <FooterLink
        text="Need to change something?"
        action="Edit details"
        onPress={onEditDetails}
      />
    </View>
  </View>
);
