import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** Internal steps of the first-time-user flow. */
type Step = "splash" | "onboarding";

/** AsyncStorage key marking that onboarding has been completed. */
const FIRST_TIME_USER_KEY = "firstTimeUser";

interface OnboardingContextType {
  /** Where the user currently is within the onboarding flow. */
  currentStep: Step;
  /** Move the user to another step of the flow. */
  setStep: (step: Step) => void;
  /**
   * True while onboarding has not been completed yet. `null` while the
   * stored flag is still being read from AsyncStorage.
   */
  isFirstTime: boolean | null;
  /** Mark onboarding as done: persists the flag and updates state. */
  completeOnboarding: () => Promise<void>;
  /** True until the stored flag has been read. */
  isLoading: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined,
);

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentStep, setStep] = useState<Step>("splash");
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Read the persisted flag once on mount to decide if this is a
  // first-time user. Errors are treated as "seen" so a corrupted store
  // can never trap a returning user in onboarding.
  useEffect(() => {
    const check = async () => {
      try {
        const value = await AsyncStorage.getItem(FIRST_TIME_USER_KEY);

        setIsFirstTime(value === null);
      } catch {
        setIsFirstTime(false);
      } finally {
        setIsLoading(false);
      }
    };

    void check();
  }, []);

  /**
   * Mark onboarding as complete.
   *
   * State is updated optimistically BEFORE the write resolves so anything
   * depending on `isFirstTime` (e.g. the root-layout redirect guard) reacts
   * in the same tick as the navigation away from onboarding — no waiting on
   * AsyncStorage, no window for flicker.
   */
  const completeOnboarding = useCallback(async () => {
    setIsFirstTime(false);

    try {
      await AsyncStorage.setItem(FIRST_TIME_USER_KEY, "done");
    } catch {
      // Best effort: next launch will show onboarding again, which is
      // preferable to blocking the user here.
    }
  }, []);

  const value = useMemo(
    () => ({ currentStep, setStep, isFirstTime, completeOnboarding, isLoading }),
    [currentStep, isFirstTime, completeOnboarding, isLoading],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }

  return context;
}
