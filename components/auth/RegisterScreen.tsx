import { useRegister, useStartRegistration } from "@/hooks/auth/auth";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Toast from "react-native-toast-message";
import { ErrorModal } from "../ui/ErrorModal";
import {
  clearRegistrationFlow,
  createRegistrationFlow,
  loadAuthFlow,
  PENDING_EMAIL_KEY,
  REGISTRATION_DRAFT_KEY,
  saveAuthFlow,
} from "./authFlow";
import { countryMeta, initialDraft } from "./register/constants";
import { DetailsStep } from "./register/DetailsStep";
import { EmailStep } from "./register/EmailStep";
import { PinStep } from "./register/PinStep";
import { styles } from "./register/styles";
import type { RegisterDraft, RegisterStep } from "./register/types";
import { getApiErrorMessage, normalizeUsername } from "./register/utils";

const RegisterScreen = () => {
  const params = useLocalSearchParams<{ verified?: string }>();
  const [draft, setDraft] = useState<RegisterDraft>(initialDraft);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [viewPassword, setViewPassword] = useState(false);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { mutateAsync: register, isPending } = useRegister();
  const { mutateAsync: startRegistration, isPending: isStartingRegistration } =
    useStartRegistration();

  const updateDraft = useCallback((patch: Partial<RegisterDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const loadDraft = useCallback(async () => {
    try {
      const [savedDraft, authFlow] = await Promise.all([
        AsyncStorage.getItem(REGISTRATION_DRAFT_KEY),
        loadAuthFlow(),
      ]);
      const forceDetails = params.verified === "1";

      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as Partial<RegisterDraft>;
        const savedStep =
          forceDetails ||
            parsed.step === "pin" ||
            authFlow?.step === "pin" ||
            authFlow?.step === "email_verified" ||
            authFlow?.step === "details"
            ? "details"
            : parsed.step || "email";
        setDraft({
          ...initialDraft,
          ...parsed,
          email: authFlow?.email || parsed.email || "",
          step: savedStep,
        });
      } else if (authFlow) {
        setDraft({
          ...initialDraft,
          email: authFlow.email,
          username: authFlow.email.split("@")[0],
          step:
            forceDetails ||
              authFlow.step === "email_verified" ||
              authFlow.step === "details" ||
              authFlow.step === "pin"
              ? "details"
              : "email",
        });
      }
    } catch (error) {
      console.log("Failed to load registration draft:", error);
    } finally {
      setHasLoadedDraft(true);
    }
  }, [params.verified]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useFocusEffect(
    useCallback(() => {
      loadDraft();
    }, [loadDraft]),
  );
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (draft.step === "pin") {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: 0,
          animated: false,
        });
      });
    }
  }, [draft.step]);
  useEffect(() => {
    if (!hasLoadedDraft) return;

    AsyncStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(draft)).catch(
      (error) => console.log("Failed to save registration draft:", error),
    );
  }, [draft, hasLoadedDraft]);

  const normalizedEmail = useMemo(
    () => draft.email.trim().toLowerCase(),
    [draft.email],
  );
  const canContinueFromEmail = /\S+@\S+\.\S+/.test(normalizedEmail);

  const goToDetails = async () => {
    if (!canContinueFromEmail) {
      Toast.show({ type: "error", text1: "Enter a valid email" });
      return;
    }

    try {
      const response = await startRegistration({ email: normalizedEmail });
      const shouldResumeDetails =
        response?.data?.resume === true ||
        response?.data?.mail_verified === true;
      const nextDraft = {
        ...draft,
        email: normalizedEmail,
        step: shouldResumeDetails
          ? ("details" as RegisterStep)
          : ("email" as RegisterStep),
        username: draft.username || normalizedEmail.split("@")[0],
      };
      updateDraft(nextDraft);
      await AsyncStorage.setItem(
        REGISTRATION_DRAFT_KEY,
        JSON.stringify(nextDraft),
      );

      if (shouldResumeDetails) {
        await AsyncStorage.removeItem(PENDING_EMAIL_KEY);
        await saveAuthFlow(createRegistrationFlow(normalizedEmail, "details"));
        Toast.show({
          type: "success",
          text1: "Email already verified",
          text2: "Continue creating your account.",
        });
        return;
      }

      await AsyncStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);
      await saveAuthFlow(
        createRegistrationFlow(normalizedEmail, "email_otp_sent"),
      );
      Toast.show({
        type: "success",
        text1: "Verification code sent",
        text2: `Check ${normalizedEmail}.`,
      });
      router.replace({
        pathname: "/(auth)/verify-mail",
        params: { email: normalizedEmail },
      });
    } catch (error: any) {
      setErrorMessage(getApiErrorMessage(error));
    }
  };

  const goToPin = async () => {
    const cleanPhone = draft.phone.replace(/\D/g, "");
    const selectedCountry = countryMeta[draft.country];
    const validLength =
      cleanPhone.length === selectedCountry.maxLength ||
      cleanPhone.length === selectedCountry.alternateLength;

    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      Toast.show({ type: "error", text1: "Add your legal name" });
      return;
    }

    if (!normalizeUsername(draft.username)) {
      Toast.show({ type: "error", text1: "Choose a username" });
      return;
    }

    if (!validLength) {
      Toast.show({
        type: "error",
        text1: "Check phone number",
        text2: selectedCountry.hint,
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: "error",
        text1: "Password is too short",
        text2: "Use at least 6 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({ type: "error", text1: "Passwords do not match" });
      return;
    }

    const nextDraft = {
      ...draft,
      phone: cleanPhone,
      username: normalizeUsername(draft.username),
      step: "pin" as RegisterStep,
    };
    updateDraft(nextDraft);
    await AsyncStorage.setItem(
      REGISTRATION_DRAFT_KEY,
      JSON.stringify(nextDraft),
    );
    await saveAuthFlow(createRegistrationFlow(normalizedEmail, "pin"));
  };

  const handleCreateAccount = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) {
      Toast.show({ type: "error", text1: "Enter a 4 digit PIN" });
      return;
    }

    if (pin !== confirmPin) {
      Toast.show({ type: "error", text1: "PINs do not match" });
      return;
    }

    try {
      await register({
        email: normalizedEmail,
        password,
        confirm_password: confirmPassword,
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        country: draft.country,
        phone_number: draft.phone,
        nickname: normalizeUsername(draft.username),
      });

      await clearRegistrationFlow();

      Toast.show({
        type: "success",
        text1: "Account created",
        text2: "You can now sign in.",
      });

      router.replace("/(auth)/login");
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Registration failed",
        text2: getApiErrorMessage(error),
      });
    }
  };

  const goBackToDetails = useCallback(async () => {
    const nextDraft = { ...draft, step: "details" as RegisterStep };
    updateDraft(nextDraft);
    await AsyncStorage.setItem(
      REGISTRATION_DRAFT_KEY,
      JSON.stringify(nextDraft),
    );
    await saveAuthFlow(createRegistrationFlow(normalizedEmail, "details"));
    setPin("");
    setConfirmPin("");
  }, [draft, normalizedEmail, updateDraft]);

  const startOver = useCallback(async () => {
    await clearRegistrationFlow();
    setDraft(initialDraft);
    setPassword("");
    setConfirmPassword("");
    setPin("");
    setConfirmPin("");
  }, []);

  const closeFlow = useCallback(async () => {
    await clearRegistrationFlow();
    router.replace("/(auth)/initial");
  }, []);

  const goToLogin = async () => {
    await clearRegistrationFlow();
    router.replace("/(auth)/login");
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (draft.step === "pin") {
          void goBackToDetails();
          return true;
        }

        if (draft.step === "details") {
          void startOver();
          return true;
        }

        void closeFlow();
        return true;
      },
    );

    return () => subscription.remove();
  }, [closeFlow, draft.step, goBackToDetails, startOver]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
      >
        {draft.step !== "pin" && <TouchableOpacity
          onPress={closeFlow}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={34} color={COLORS.primary} />
        </TouchableOpacity>}

        {draft.step === "email" && (
          <EmailStep
            email={draft.email}
            canContinue={canContinueFromEmail}
            isSubmitting={isStartingRegistration}
            onEmailChange={(email) => updateDraft({ email })}
            onContinue={goToDetails}
            onSignIn={goToLogin}
          />
        )}

        {draft.step === "details" && (
          <DetailsStep
            draft={draft}
            password={password}
            confirmPassword={confirmPassword}
            viewPassword={viewPassword}
            onDraftChange={updateDraft}
            onPasswordChange={setPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onTogglePassword={() => setViewPassword((value) => !value)}
            onContinue={goToPin}
            onStartOver={startOver}
            normalizeUsername={normalizeUsername}
          />
        )}

        {draft.step === "pin" && (
          <PinStep
            pin={pin}
            confirmPin={confirmPin}
            isCreating={isPending}
            onPinChange={setPin}
            onConfirmPinChange={setConfirmPin}
            onCreateAccount={handleCreateAccount}
            onEditDetails={goBackToDetails}
          />
        )}

        <ErrorModal
          visible={!!errorMessage}
          message={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;
