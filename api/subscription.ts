import { api } from "./client";
import { ApiResponse } from "./types";

export type PlanCode = "free" | "lite" | "premium" | "power";

export type SubscriptionStatus =
  | "active"
  | "pending"
  | "cancelled"
  | "expired"
  | string;

export type SubscriptionPlan = {
  ID: string;
  Code: PlanCode;
  Name: string;
  PriceKobo: number;
  Currency: string;

  MaxMonthlyVolumeKobo: number;
  MaxLockedPlans: number;
  MaxFlexibleEnvelopes: number;
  MaxEmergencyVaults: number;

  FreeFlexibleWithdrawalsMonthly: number;
  FreeEmergencyWithdrawalsMonthly: number;

  HasSalarySplit: boolean;
  HasFullAnalytics: boolean;
  HasSharedEnvelopes: boolean;
  HasAdvancedRules: boolean;

  CreatedAt?: string;
  UpdatedAt?: string;
  DeletedAt?: string | null;
};

export type UserSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  provider?: string;
  provider_ref?: string;
  payment_reference?: string;
  cancel_at_period_end: boolean;
};

/**
 * Shape of the raw response from the Go API for an active subscription.
 * The backend struct (UserSubscription in Go) has no custom json tags,
 * so gorm/encoding-json defaults to PascalCase field names — same as
 * SubscriptionPlan already does (ID, Code, PriceKobo, etc).
 */
type RawUserSubscription = {
  ID: string;
  UserID: string;
  PlanID: string;
  Plan: SubscriptionPlan;
  Status: SubscriptionStatus;
  CurrentPeriodStart: string;
  CurrentPeriodEnd: string;
  Provider?: string;
  ProviderRef?: string;
  PaymentReference?: string;
  CancelAtPeriodEnd: boolean;
};

const normalizeUserSubscription = (
  raw: RawUserSubscription,
): UserSubscription => ({
  id: raw.ID,
  user_id: raw.UserID,
  plan_id: raw.PlanID,
  plan: raw.Plan,
  status: raw.Status,
  current_period_start: raw.CurrentPeriodStart,
  current_period_end: raw.CurrentPeriodEnd,
  provider: raw.Provider,
  provider_ref: raw.ProviderRef,
  payment_reference: raw.PaymentReference,
  cancel_at_period_end: raw.CancelAtPeriodEnd,
});

export type CreateSubscriptionPayload = {
  plan_id: string;
};

export type CreateSubscriptionResponse = {
  plan: SubscriptionPlan;
  payment_url: string;
  payment_reference: string;
};

export const FREE_SUBSCRIPTION: UserSubscription = {
  id: "free",
  user_id: "",
  plan_id: "free",
  status: "active",
  current_period_start: "",
  current_period_end: "",
  cancel_at_period_end: false,
  plan: {
    ID: "free",
    Code: "free",
    Name: "Free",
    PriceKobo: 0,
    Currency: "NGN",
    MaxMonthlyVolumeKobo: 5_000_000,
    MaxLockedPlans: 2,
    MaxFlexibleEnvelopes: 2,
    MaxEmergencyVaults: 1,
    FreeFlexibleWithdrawalsMonthly: 0,
    FreeEmergencyWithdrawalsMonthly: 0,
    HasSalarySplit: false,
    HasFullAnalytics: false,
    HasSharedEnvelopes: false,
    HasAdvancedRules: false,
  },
};

export const getSubscriptionPlans = async () => {
  const res = await api.get<ApiResponse<SubscriptionPlan[]>>(
    "/subscriptions/plans",
  );

  return res.data.data || [];
};

type ActiveSubscriptionResponse = {
  subscription: RawUserSubscription;
};

export const getActiveSubscription = async (): Promise<UserSubscription> => {
  try {
    const res = await api.get<ApiResponse<ActiveSubscriptionResponse>>(
      "/subscriptions/active",
      // A new/free user legitimately has no persisted paid subscription.
      // The API expresses that state as 404; handle it locally instead of
      // opening the application-wide failure modal.
      { suppressGlobalErrorModal: true } as any,
    );

    const raw = res.data.data?.subscription;

    return raw ? normalizeUserSubscription(raw) : FREE_SUBSCRIPTION;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return FREE_SUBSCRIPTION;
    }

    throw error;
  }
};

export const createSubscription = async (
  payload: CreateSubscriptionPayload,
) => {
  const res = await api.post<ApiResponse<CreateSubscriptionResponse>>(
    "/subscriptions",
    payload,
  );

  return res.data.data;
};
