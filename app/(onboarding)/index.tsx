import { useOnboarding } from '@/context/OnboardingContext';
import { SplashScreen } from '@/components/SplashScreen';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { router } from 'expo-router';

// When the user completes onboarding, mark them as not first-time
// and send to auth flow via router
export default function OnboardingIndex() {
  const { currentStep, completeOnboarding } = useOnboarding();

  // Override WelcomeAuthScreen behaviour: after onboarding is done,
  // record the flag and navigate to auth group
  if (currentStep === 'splash') return <SplashScreen />;
  if (currentStep === 'onboarding') return <OnboardingScreen />;

  // 'welcome' step — finish onboarding, mark done and redirect
  const finish = async () => {
    await completeOnboarding();
    router.replace('/(auth)/welcome');
  };

  // Trigger redirect immediately when welcome step is reached
  finish();
  return null;
}
