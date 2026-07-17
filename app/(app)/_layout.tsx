import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="upgrade-plan" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="my-profile" />
      <Stack.Screen name="payment-settings" />
      <Stack.Screen name="login-settings" />
      <Stack.Screen name="security-questions" />
      <Stack.Screen name="feedback-suggestions" />
      <Stack.Screen name="subscription-debug" />
    </Stack>
  );
}
