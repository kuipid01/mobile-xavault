import AsyncStorage from "@react-native-async-storage/async-storage";

export const AUTH_FLOW_KEY = "authFlow";
export const REGISTRATION_DRAFT_KEY = "authRegistrationDraft";
export const PENDING_EMAIL_KEY = "pendingVerificationEmail";

export type RegistrationAuthFlowStep =
  | "email_otp_sent"
  | "email_verified"
  | "details"
  | "pin";

export type AuthFlow = {
  kind: "register";
  email: string;
  step: RegistrationAuthFlowStep;
  updatedAt: string;
};

export const createRegistrationFlow = (
  email: string,
  step: RegistrationAuthFlowStep,
): AuthFlow => ({
  kind: "register",
  email: email.trim().toLowerCase(),
  step,
  updatedAt: new Date().toISOString(),
});

export const saveAuthFlow = (flow: AuthFlow) =>
  AsyncStorage.setItem(AUTH_FLOW_KEY, JSON.stringify(flow));

export const loadAuthFlow = async (): Promise<AuthFlow | null> => {
  const savedFlow = await AsyncStorage.getItem(AUTH_FLOW_KEY);
  if (!savedFlow) return null;

  try {
    const flow = JSON.parse(savedFlow) as Partial<AuthFlow>;
    if (flow.kind !== "register" || !flow.email || !flow.step) return null;
    return flow as AuthFlow;
  } catch {
    return null;
  }
};

export const clearRegistrationFlow = () =>
  AsyncStorage.multiRemove([
    AUTH_FLOW_KEY,
    REGISTRATION_DRAFT_KEY,
    PENDING_EMAIL_KEY,
  ]);
