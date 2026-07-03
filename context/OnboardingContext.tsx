import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Step = 'splash' | 'onboarding' | 'welcome' | 'login' | 'register';

interface OnboardingContextType {
  currentStep: Step;
  setStep: (step: Step) => void;
  isFirstTime: boolean | null;
  completeOnboarding: () => Promise<void>;
  isLoading: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setStep] = useState<Step>('splash');
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const value = await AsyncStorage.getItem('firstTimeUser');
        setIsFirstTime(value === null);
      } catch (error) {
        console.log('Failed to check onboarding state:', error);
        setIsFirstTime(false);
      } finally {
        setIsLoading(false);
      }
    };
    check();
  }, []);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('firstTimeUser', 'done');
      setIsFirstTime(false);
    } catch (error) {
      console.log('Failed to set onboarding state:', error);
    }
  };

  return (
    <OnboardingContext.Provider value={{ currentStep, setStep, isFirstTime, completeOnboarding, isLoading }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
}
