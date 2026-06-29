import React, { createContext, useContext, useState } from 'react';

type Step = 'splash' | 'onboarding' | 'welcome' | 'login' | 'register';

interface OnboardingContextType {
  currentStep: Step;
  setStep: (step: Step) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setStep] = useState<Step>('splash');

  return (
    <OnboardingContext.Provider value={{ currentStep, setStep }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
}
