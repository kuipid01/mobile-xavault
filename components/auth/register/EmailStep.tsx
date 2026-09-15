import Coin from "@/assets/images/coin.svg";
import React from "react";
import { Text, View } from "react-native";
import { AuthField, FooterLink, PrimaryButton } from "./FormControls";
import { styles } from "./styles";

type Props = {
  email: string;
  canContinue: boolean;
  isSubmitting: boolean;
  onEmailChange: (email: string) => void;
  onContinue: () => void;
  onSignIn: () => void;
};

export const EmailStep = ({
  email,
  canContinue,
  isSubmitting,
  onEmailChange,
  onContinue,
  onSignIn,
}: Props) => (
  <>
    <View style={styles.artWrap}>
      <Coin width={200} height={200} />
    </View>

    <View style={styles.stepBody}>
      <Text style={styles.title}>Start your{"\n"}Discipline journey</Text>

      <AuthField
        label="Type in your email"
        icon="mail-outline"
        value={email}
        onChangeText={onEmailChange}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <PrimaryButton
        label={isSubmitting ? "Sending..." : "Get started"}
        onPress={onContinue}
        disabled={!canContinue || isSubmitting}
      />

      <FooterLink text="Got an account?" action="Sign in" onPress={onSignIn} />
    </View>
  </>
);
