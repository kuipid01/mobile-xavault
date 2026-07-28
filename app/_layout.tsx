import "react-native-gesture-handler";

import GlobalDrawerHost from "@/components/GlobalDrawerHost";
import { GlobalErrorModal } from "@/components/GlobalErrorModal";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { AuthProvider, useAuth } from "../api/auth";
import { getBiometricAvailability } from "../lib/biometric-auth";
import {
  loadAuthFlow,
  PENDING_EMAIL_KEY,
  REGISTRATION_DRAFT_KEY,
} from "../components/auth/authFlow";
import { DepositPaymentModal } from "../components/general/deposit-payment-modal";
import { DepositVerificationBanner } from "../components/general/deposit-verification-banner";
import { ModalProvider } from "../context/special-modal-context";
import { useSubscriptionPrompt } from "../hooks/use-subscription-prompt";
import {
  DepositVerificationProvider,
  DepositVerificationWatcher,
} from "../hooks/verify-deposit";
import { SubscriptionVerificationProvider } from "../hooks/verify-sub";
import "../global.css";

const DEBUG_ROOT_LAYOUT = true;

const debugLog = (...args: unknown[]) => {
  if (!DEBUG_ROOT_LAYOUT) return;
  console.log("[RootLayout]", ...args);
};

const queryClient = new QueryClient();

type ComponentWithDefaultProps = {
  defaultProps?: {
    style?: unknown;
  };
};

function RootLayoutContent() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { isFirstTime, isLoading: onboardingLoading } = useOnboarding();
  const pathname = usePathname();
  const segments = useSegments();
  const { maybeShowSubscriptionPrompt } = useSubscriptionPrompt();
  const rootSegment = segments[0];
  const fontsLoaded = true;

  const [isRedirectChecking, setIsRedirectChecking] = useState(true);

  useEffect(() => {
    debugLog("font defaults effect", { fontsLoaded });

    if (!fontsLoaded) {
      debugLog("font defaults skipped, fonts not loaded");
      return;
    }

    const defaultText = Text as unknown as ComponentWithDefaultProps;
    defaultText.defaultProps = defaultText.defaultProps || {};
    defaultText.defaultProps.style = [
      { fontFamily: "System" },
      defaultText.defaultProps.style,
    ];

    const defaultTextInput = TextInput as unknown as ComponentWithDefaultProps;
    defaultTextInput.defaultProps = defaultTextInput.defaultProps || {};
    defaultTextInput.defaultProps.style = [
      { fontFamily: "System" },
      defaultTextInput.defaultProps.style,
    ];

    debugLog("font defaults applied");
  }, [fontsLoaded]);

  // Startup redirect: keep the route tree stable and move users to the right flow.
  useEffect(() => {
    debugLog("redirect effect fired", {
      onboardingLoading,
      authLoading,
      fontsLoaded,
      isFirstTime,
      isAuthenticated,
      pathname,
      rootSegment,
    });

    if (onboardingLoading || authLoading || !fontsLoaded) {
      debugLog("redirect skipped, still loading", {
        onboardingLoading,
        authLoading,
        fontsLoaded,
      });
      return;
    }

    let cancelled = false;

    const checkInitialRedirect = async () => {
      debugLog("redirect check started");

      try {
        if (isAuthenticated) {
          debugLog("user is authenticated", { rootSegment });

          if (!cancelled && rootSegment !== "(app)") {
            debugLog("redirecting to app home");
            router.replace("/(app)/(tabs)/home");
          } else {
            debugLog("already in app group");
          }

          return;
        }

        if (isFirstTime) {
          debugLog("user is first time", { rootSegment });

          if (!cancelled && rootSegment !== "(onboarding)") {
            debugLog("redirecting to onboarding");
            router.replace("/(onboarding)");
          } else {
            debugLog("already on onboarding");
          }

          return;
        }

        if (!isAuthenticated) {
          debugLog("user is not authenticated, checking saved auth flow");
          const biometric = await getBiometricAvailability();

          if (
            biometric.enabled &&
            biometric.deviceReady &&
            biometric.sessionRecoverable
          ) {
            if (!pathname.includes("/login")) {
              router.replace("/(auth)/login");
            }
            return;
          }

          const [authFlow, email, registrationDraft] = await Promise.all([
            loadAuthFlow(),
            AsyncStorage.getItem(PENDING_EMAIL_KEY),
            AsyncStorage.getItem(REGISTRATION_DRAFT_KEY),
          ]);

          debugLog("saved auth state loaded", {
            authFlow,
            hasPendingEmail: Boolean(email),
            pendingEmail: email,
            hasRegistrationDraft: Boolean(registrationDraft),
          });

          if (authFlow?.kind === "register") {
            debugLog("register auth flow found", {
              step: authFlow.step,
              email: authFlow.email,
            });

            if (authFlow.step === "email_otp_sent") {
              if (!pathname.includes("/verify-mail")) {
                debugLog("redirecting to verify mail from auth flow", {
                  email: authFlow.email,
                });

                router.replace({
                  pathname: "/(auth)/verify-mail",
                  params: { email: authFlow.email },
                });
              } else {
                debugLog("already on verify mail");
              }

              return;
            }

            if (!pathname.includes("/register")) {
              debugLog("redirecting to register from auth flow");
              router.replace("/(auth)/register");
            } else {
              debugLog("already on register");
            }

            return;
          }

          if (email) {
            debugLog("pending email found", { email });

            if (!pathname.includes("/verify-mail")) {
              debugLog("redirecting to verify mail from pending email", {
                email,
              });

              router.replace({
                pathname: "/(auth)/verify-mail",
                params: { email },
              });
            } else {
              debugLog("already on verify mail");
            }
          } else if (registrationDraft && !pathname.includes("/register")) {
            debugLog("registration draft found, redirecting to register");
            router.replace("/(auth)/register");
          } else if (
            rootSegment !== "(auth)" &&
            ![
              "/login",
              "/register",
              "/verify-mail",
              "/forgot-password",
              "/initial",
              "/welcome",
            ].includes(pathname)
          ) {
            debugLog("no saved auth flow, redirecting to auth initial", {
              rootSegment,
              pathname,
            });

            router.replace("/(auth)/login");
          } else {
            debugLog("no redirect needed", {
              rootSegment,
              pathname,
            });
          }
        }
      } catch (error) {
        debugLog("failed to check pending auth flow", error);
        console.log("Failed to check pending auth flow:", error);
      } finally {
        debugLog("redirect check finished");
        if (!cancelled) setIsRedirectChecking(false);
      }
    };

    void checkInitialRedirect();

    return () => {
      cancelled = true;
    };
  }, [
    onboardingLoading,
    authLoading,
    fontsLoaded,
    isFirstTime,
    isAuthenticated,
    pathname,
    rootSegment,
  ]);

  useEffect(() => {
    if (
      onboardingLoading ||
      authLoading ||
      !fontsLoaded ||
      isRedirectChecking ||
      !isAuthenticated ||
      rootSegment !== "(app)"
    ) {
      return;
    }

    void maybeShowSubscriptionPrompt("app_open");
  }, [
    authLoading,
    fontsLoaded,
    isAuthenticated,
    isRedirectChecking,
    maybeShowSubscriptionPrompt,
    onboardingLoading,
    rootSegment,
  ]);

  if (onboardingLoading || authLoading || !fontsLoaded || isRedirectChecking) {
    debugLog("showing loading screen", {
      onboardingLoading,
      authLoading,
      fontsLoaded,
      isRedirectChecking,
    });

    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#063B2E",
        }}
      >
        <ActivityIndicator color="#D6A84F" />
      </View>
    );
  }

  debugLog("rendering app stack", {
    pathname,
    rootSegment,
  });

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="modal" />
    </Stack>
  );
}

export default function RootLayout() {
  debugLog("rendering root layout");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DepositVerificationProvider>
          <SubscriptionVerificationProvider>
            <ModalProvider>
              <OnboardingProvider>
                <StatusBar style="light" />
                <GlobalDrawerHost>
                  <RootLayoutContent />
                </GlobalDrawerHost>
                <DepositVerificationWatcher />
                <DepositPaymentModal />
                <DepositVerificationBanner />
                <GlobalErrorModal />
                <Toast />
              </OnboardingProvider>
            </ModalProvider>
          </SubscriptionVerificationProvider>
        </DepositVerificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
