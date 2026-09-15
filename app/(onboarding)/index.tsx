import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

/**
 * `/onboarding` — entry point of the first-time-user flow.
 *
 * All step logic (splash -> carousel) and the finish handoff to
 * `/(auth)/welcome` live in `OnboardingFlow`; this file only mounts it.
 */
export default function OnboardingIndex() {
  return <OnboardingFlow />;
}
