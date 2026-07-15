import AsyncStorage from "@react-native-async-storage/async-storage";

export type SubscriptionPromptTrigger =
  | "app_open"
  | "feature_limit_reached"
  | "premium_feature_click"
  | "wallet_action"
  | "salary_plan_created"
  | "subscription_expired"
  | "manual_upgrade_button";

export type SubscriptionReminderState = {
  skipCount: number;
  lastShownAt: number | null;
  lastSkippedAt: number | null;
  suppressUntil: number | null;
  lastTrigger: SubscriptionPromptTrigger | null;
};

export type PromptDecisionReason =
  | "allowed"
  | "manual_allowed"
  | "already_subscribed"
  | "suppressed"
  | "recently_shown"
  | "app_open_not_ready"
  | "session_already_shown"
  | "modal_already_open"
  | "payment_verification_active"
  | "sensitive_flow";

export type PromptDecision = {
  allowed: boolean;
  reason: PromptDecisionReason;
  suppressUntil?: number | null;
  nextAllowedAt?: number | null;
};

type PromptDecisionInput = {
  trigger: SubscriptionPromptTrigger;
  state: SubscriptionReminderState;
  now: number;
  isSubscribed: boolean;
  isModalOpen: boolean;
  isPaymentVerificationActive: boolean;
  hasShownThisSession: boolean;
  isSensitiveFlow?: boolean;
};

const SUBSCRIPTION_REMINDER_KEY = "subscription_reminder_state";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const DEFAULT_SUBSCRIPTION_REMINDER_STATE: SubscriptionReminderState = {
  skipCount: 0,
  lastShownAt: null,
  lastSkippedAt: null,
  suppressUntil: null,
  lastTrigger: null,
};

export function randomBetween(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs + 1));
}

export function getSkipBackoffMs(skipCount: number): number {
  if (skipCount <= 1) return randomBetween(12 * HOUR, 24 * HOUR);
  if (skipCount === 2) return randomBetween(2 * DAY, 3 * DAY);
  if (skipCount === 3) return randomBetween(5 * DAY, 7 * DAY);
  return randomBetween(10 * DAY, 14 * DAY);
}

export function getMinimumTimeBetweenPromptsMs(
  trigger: SubscriptionPromptTrigger
): number {
  switch (trigger) {
    case "app_open":
      return 7 * DAY;
    case "wallet_action":
    case "salary_plan_created":
      return 3 * DAY;
    case "subscription_expired":
      return 6 * HOUR;
    case "feature_limit_reached":
    case "premium_feature_click":
    case "manual_upgrade_button":
      return 0;
  }
}

export function shouldShowSubscriptionPrompt({
  trigger,
  state,
  now,
  isSubscribed,
  isModalOpen,
  isPaymentVerificationActive,
  hasShownThisSession,
  isSensitiveFlow = false,
}: PromptDecisionInput): PromptDecision {
  const isManual = trigger === "manual_upgrade_button";

  if (isSubscribed) return { allowed: false, reason: "already_subscribed" };

  if (isPaymentVerificationActive) {
    return { allowed: false, reason: "payment_verification_active" };
  }

  if (isSensitiveFlow && !isManual) {
    return { allowed: false, reason: "sensitive_flow" };
  }

  if (isModalOpen && !isManual) {
    return { allowed: false, reason: "modal_already_open" };
  }

  if (isManual) return { allowed: true, reason: "manual_allowed" };

  if (hasShownThisSession) {
    return { allowed: false, reason: "session_already_shown" };
  }

  if (
    trigger === "app_open" &&
    !state.lastShownAt &&
    !state.lastSkippedAt &&
    state.skipCount === 0
  ) {
    return { allowed: false, reason: "app_open_not_ready" };
  }

  const suppressUntil = state.suppressUntil ?? null;
  const isSuppressed = !!suppressUntil && suppressUntil > now;

  if (isSuppressed) {
    if (trigger !== "subscription_expired") {
      return {
        allowed: false,
        reason: "suppressed",
        suppressUntil,
        nextAllowedAt: suppressUntil,
      };
    }

    const recentlySkipped =
      !!state.lastSkippedAt && now - state.lastSkippedAt < 6 * HOUR;

    if (recentlySkipped) {
      return {
        allowed: false,
        reason: "suppressed",
        suppressUntil,
        nextAllowedAt: state.lastSkippedAt! + 6 * HOUR,
      };
    }
  }

  const minimumGap = getMinimumTimeBetweenPromptsMs(trigger);
  const nextAllowedAt = state.lastShownAt
    ? state.lastShownAt + minimumGap
    : null;

  if (nextAllowedAt && nextAllowedAt > now) {
    return {
      allowed: false,
      reason: "recently_shown",
      nextAllowedAt,
    };
  }

  return { allowed: true, reason: "allowed" };
}

export async function getSubscriptionReminderState(): Promise<SubscriptionReminderState> {
  try {
    const raw = await AsyncStorage.getItem(SUBSCRIPTION_REMINDER_KEY);
    if (!raw) return DEFAULT_SUBSCRIPTION_REMINDER_STATE;

    return {
      ...DEFAULT_SUBSCRIPTION_REMINDER_STATE,
      ...JSON.parse(raw),
    };
  } catch (error) {
    console.log("[SubscriptionPrompt] Failed to read reminder state", error);
    return DEFAULT_SUBSCRIPTION_REMINDER_STATE;
  }
}

export async function saveSubscriptionReminderState(
  state: SubscriptionReminderState
) {
  await AsyncStorage.setItem(SUBSCRIPTION_REMINDER_KEY, JSON.stringify(state));
}

export async function clearSubscriptionReminderState() {
  await AsyncStorage.removeItem(SUBSCRIPTION_REMINDER_KEY);
}

export async function recordSubscriptionPromptShown(
  trigger: SubscriptionPromptTrigger,
  now = Date.now()
) {
  const state = await getSubscriptionReminderState();
  await saveSubscriptionReminderState({
    ...state,
    lastShownAt: now,
    lastTrigger: trigger,
  });
}

export async function recordSubscriptionPromptSkipped(now = Date.now()) {
  const state = await getSubscriptionReminderState();
  const skipCount = state.skipCount + 1;
  const suppressUntil = now + getSkipBackoffMs(skipCount);

  await saveSubscriptionReminderState({
    ...state,
    skipCount,
    lastSkippedAt: now,
    suppressUntil,
  });

  return { skipCount, suppressUntil };
}
