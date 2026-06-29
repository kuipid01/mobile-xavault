import { OnboardingProvider } from "@/context/OnboardingContext";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
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

export default function RootLayout() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  const [loading, setLoading] = useState(true);
  const [firstTime, setFirstTime] = useState<boolean | null>(null);

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

  useEffect(() => {
    const check = async () => {
      try {
        const value = await AsyncStorage.getItem("firstTimeUser");
        setFirstTime(value === null);
      } catch (error) {
        console.log("Failed to check first time user:", error);
        setFirstTime(false);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  if (loading || authLoading || !fontsLoaded) {
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
    <QueryClientProvider client={queryClient}>
      <OnboardingProvider>
        <StatusBar style="light" />

        <Stack screenOptions={{ headerShown: false }}>
          {!firstTime ? (
            <Stack.Screen name="(onboarding)" />
          ) : isAuthenticated ? (
            <Stack.Screen name="(app)" />
          ) : (
            <Stack.Screen name="(auth)" />
          )}
        </Stack>

        <Toast />
      </OnboardingProvider>
    </QueryClientProvider>
  );
}
