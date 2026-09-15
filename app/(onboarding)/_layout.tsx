import { Stack } from 'expo-router';

/**
 * Route group for the first-time-user onboarding flow.
 *
 * `fade` keeps the splash -> welcome transitions feeling like one
 * continuous brand moment rather than hard screen swaps.
 */
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  );
}
