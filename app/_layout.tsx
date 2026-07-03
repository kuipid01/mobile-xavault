import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "../api/auth";
import "../global.css";

const queryClient = new QueryClient();
type ComponentWithDefaultProps = {
  defaultProps?: {
    style?: unknown;
  };
};

function RootLayoutContent() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { isFirstTime, isLoading: onboardingLoading } = useOnboarding();
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  const [isRedirectChecking, setIsRedirectChecking] = useState(true);

  useEffect(() => {
    if (!fontsLoaded) return;

    const defaultText = Text as unknown as ComponentWithDefaultProps;
    defaultText.defaultProps = defaultText.defaultProps || {};
    defaultText.defaultProps.style = [
      { fontFamily: "PlayfairDisplay_400Regular" },
      defaultText.defaultProps.style,
    ];

    const defaultTextInput = TextInput as unknown as ComponentWithDefaultProps;
    defaultTextInput.defaultProps = defaultTextInput.defaultProps || {};
    defaultTextInput.defaultProps.style = [
      { fontFamily: "PlayfairDisplay_400Regular" },
      defaultTextInput.defaultProps.style,
    ];
  }, [fontsLoaded]);

  // Startup redirect: if they are in the middle of verifying mail, take them back there.
  useEffect(() => {
    if (onboardingLoading || authLoading || !fontsLoaded) return;

    const checkInitialRedirect = async () => {
      try {
        if (!isFirstTime && !isAuthenticated) {
          const email = await AsyncStorage.getItem("pendingVerificationEmail");
          if (email) {
            router.replace({
              pathname: "/(auth)/verify-mail",
              params: { email },
            });
          }
        }
      } catch (error) {
        console.log("Failed to check pending verification email:", error);
      } finally {
        setIsRedirectChecking(false);
      }
    };

    checkInitialRedirect();
  }, [onboardingLoading, authLoading, fontsLoaded, isFirstTime, isAuthenticated]);

  if (onboardingLoading || authLoading || !fontsLoaded || isRedirectChecking) {
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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isFirstTime ? (
        <Stack.Screen name="(onboarding)" />
      ) : !isAuthenticated ? (
        <Stack.Screen name="(app)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <OnboardingProvider>
        <StatusBar style="light" />
        <RootLayoutContent />
        <Toast />
      </OnboardingProvider>
    </QueryClientProvider>
  );
}
