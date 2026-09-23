import "react-native-gesture-handler";

import { LoggingOutOverlay } from "@/components/general/logging-out-overlay";
import GlobalDrawerHost from "@/components/GlobalDrawerHost";
import { GlobalErrorModal } from "@/components/GlobalErrorModal";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import {
  Lexend_300Light,
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
  useFonts,
} from "@expo-google-fonts/lexend";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { AuthProvider, useAuth } from "../api/auth";
import {
  loadAuthFlow,
  PENDING_EMAIL_KEY,
  REGISTRATION_DRAFT_KEY,
} from "../components/auth/authFlow";
import { DepositPaymentModal } from "../components/general/deposit-payment-modal";
import { DepositVerificationBanner } from "../components/general/deposit-verification-banner";
import { PaymentVerificationWatcher } from "../components/general/payment-verification-watcher";
import { SubscriptionVerificationBanner } from "../components/general/subscription-verification-banner";
import { ModalProvider } from "../context/special-modal-context";
import "../global.css";
import { useSubscriptionPrompt } from "../hooks/use-subscription-prompt";
import {
  DepositVerificationProvider,
  DepositVerificationWatcher,
} from "../hooks/verify-deposit";
import { SubscriptionVerificationProvider } from "../hooks/verify-sub";
import { getBiometricAvailability } from "../lib/biometric-auth";

// Logging every render/route change is dev-only; in production this is
// measurable console overhead on the hottest component in the app.
const DEBUG_ROOT_LAYOUT = __DEV__;

const debugLog = (...args: unknown[]) => {
  if (!DEBUG_ROOT_LAYOUT) return;
  console.log("[RootLayout]", ...args);
};

// Sensible defaults so one failed request can't freeze a screen for minutes.
// Without these, react-query retries 3× with exponential backoff: a 15s axios
// timeout × 4 attempts + backoff ≈ 2 minutes of apparent "lag" on a failing
// screen, and staleTime 0 re-fetched + flashed spinners on every mount.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 500,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

type ComponentWithDefaultProps = {
  defaultProps?: {
    style?: unknown;
  };
};

function RootLayoutContent() {
  const { isLoading: authLoading, isAuthenticated, isLoggingOut } = useAuth();
  const { isFirstTime, isLoading: onboardingLoading } = useOnboarding();
  const pathname = usePathname();
  const segments = useSegments();
  const { maybeShowSubscriptionPrompt } = useSubscriptionPrompt();
  const rootSegment = segments[0];
  const [fontsLoaded] = useFonts({
    Lexend_300Light,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
  });

  const [isRedirectChecking, setIsRedirectChecking] = useState(true);

  // The startup redirect runs ONCE per app launch. The refs below mirror the
  // live route so the async check reads the route AT DECISION TIME, not at
  // schedule time — a stale captured pathname is what caused the redirect
  // fights right after onboarding handed off to the welcome screen.
  const hasResolvedStartupRouteRef = useRef(false);
  const routeStateRef = useRef({ pathname, rootSegment });
  routeStateRef.current = { pathname, rootSegment };

  useEffect(() => {
    debugLog("font defaults effect", { fontsLoaded });

    if (!fontsLoaded) {
      debugLog("font defaults skipped, fonts not loaded");
      return;
    }

    const defaultText = Text as unknown as ComponentWithDefaultProps;
    defaultText.defaultProps = defaultText.defaultProps || {};
    defaultText.defaultProps.style = [
      { fontFamily: "Lexend_400Regular" },
      defaultText.defaultProps.style,
    ];

    const defaultTextInput = TextInput as unknown as ComponentWithDefaultProps;
    defaultTextInput.defaultProps = defaultTextInput.defaultProps || {};
    defaultTextInput.defaultProps.style = [
      { fontFamily: "Lexend_400Regular" },
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

    // One-shot: decide the initial destination exactly once. Re-running this
    // whole check on every navigation re-read SecureStore/AsyncStorage each
    // time (the noticeable "wait") and raced with in-flight navigations.
    if (hasResolvedStartupRouteRef.current) return;

    let cancelled = false;

    // Live route accessors: always read the CURRENT route, never the values
    // captured when this effect was scheduled.
    const readCurrentPathname = () => routeStateRef.current.pathname;
    const readCurrentRootSegment = () => routeStateRef.current.rootSegment;

    const checkInitialRedirect = async () => {
      debugLog("redirect check started");

      try {
        if (isAuthenticated) {
          debugLog("user is authenticated", { rootSegment: readCurrentRootSegment() });

          if (!cancelled && readCurrentRootSegment() !== "(app)") {
            debugLog("redirecting to app home");
            router.replace("/(app)/(tabs)/home");
          } else {
            debugLog("already in app group");
          }

          return;
        }

        if (isFirstTime) {
          debugLog("user is first time", { rootSegment: readCurrentRootSegment() });

          // Force first-time users into onboarding from anywhere else.
          // (Completing onboarding flips isFirstTime BEFORE navigating,
          // so this branch can never fight the welcome-screen handoff.)
          if (!cancelled && readCurrentRootSegment() !== "(onboarding)") {
            debugLog("redirecting to onboarding");
            router.replace("/(onboarding)");
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
            if (!readCurrentPathname().includes("/login")) {
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
              if (!readCurrentPathname().includes("/verify-mail")) {
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

            if (!readCurrentPathname().includes("/register")) {
              debugLog("redirecting to register from auth flow");
              router.replace("/(auth)/register");
            } else {
              debugLog("already on register");
            }

            return;
          }

          if (email) {
            debugLog("pending email found", { email });

            if (!readCurrentPathname().includes("/verify-mail")) {
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
          } else if (registrationDraft && !readCurrentPathname().includes("/register")) {
            debugLog("registration draft found, redirecting to register");
            router.replace("/(auth)/register");
          } else if (
            readCurrentRootSegment() !== "(auth)" &&
            !["/login", "/register", "/verify-mail", "/forgot-password", "/initial", "/welcome"].includes(
              readCurrentPathname(),
            )
          ) {
            debugLog("no saved auth flow, redirecting to auth initial");
            router.replace("/(auth)/login");
          } else {
            debugLog("no redirect needed");
          }
        }
      } catch (error) {
        debugLog("failed to check pending auth flow", error);
        console.log("Failed to check pending auth flow:", error);
      } finally {
        debugLog("redirect check finished");

        // Whether we navigated or not, the startup destination is decided.
        // Later navigation is owned by the screens themselves.
        hasResolvedStartupRouteRef.current = true;
        if (!cancelled) setIsRedirectChecking(false);
      }
    };

    void checkInitialRedirect();

    return () => {
      cancelled = true;
    };
    // Deliberately narrow: this fires when the loading gates open, and the
    // one-shot ref makes every later firing a no-op. All flows (login,
    // register, logout) navigate explicitly from their own screens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname/rootSegment are read live via routeStateRef
  }, [onboardingLoading, authLoading, fontsLoaded, isFirstTime, isAuthenticated]);

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

function AuthenticatedRoot() {
  const { isLoggingOut } = useAuth();

  return (
    <>
      {isLoggingOut && <LoggingOutOverlay />}

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
              <PaymentVerificationWatcher />
              <SubscriptionVerificationBanner />
              <GlobalErrorModal />
              <Toast />
            </OnboardingProvider>
          </ModalProvider>
        </SubscriptionVerificationProvider>
      </DepositVerificationProvider>
    </>
  );
}

export default function RootLayout() {
  debugLog("rendering root layout");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthenticatedRoot />
      </AuthProvider>
    </QueryClientProvider>
  );
}
