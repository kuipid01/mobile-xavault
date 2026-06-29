import { OnboardingProvider } from "@/context/OnboardingContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "../api/auth";
import "../global.css";

const queryClient = new QueryClient();

export default function RootLayout() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [firstTime, setFirstTime] = useState<boolean | null>(null);

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

  if (loading || authLoading) {
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
          {firstTime ? (
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