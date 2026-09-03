import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useActiveSubscription, useCreateSubscription, useDismissSubscriptionPayment } from "./app/subscription";
import { trackEvent } from "../lib/analytics";

const DEBUG = true;
const PENDING_SUBSCRIPTION_KEY = "pending_subscription_verification";
const CHECKOUT_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export type SubscriptionPaymentStatus =
  | "idle"
  | "ready"
  | "checkout_opened"
  | "verifying"
  | "needs_action"
  | "confirmed"
  | "expired"
  | "dismissed";

type PendingSubscription = {
  planId: string;
  paymentUrl?: string | null;
  paymentReference?: string | null;
  initiatedAt: number;
  status?: SubscriptionPaymentStatus;
  lastCheckedAt?: number | null;
  verificationAttempts?: number;
  lastOpenedAt?: number | null;
};

type SubscriptionVerificationContextValue = {
  isVerifying: boolean;
  pendingPlanId: string | null;
  pendingPaymentUrl: string | null;
  pendingPaymentReference: string | null;
  pendingStatus: SubscriptionPaymentStatus;
  startVerification: (
    planId: string,
    paymentUrl?: string | null,
    paymentReference?: string | null
  ) => Promise<void>;
  continuePayment: () => Promise<boolean>;
  startNewPayment: () => Promise<boolean>;
  dismissPayment: () => Promise<void>;
  clearVerification: () => Promise<void>;
  checkStatus: (options?: { bounded?: boolean }) => Promise<boolean>;
};

const SubscriptionVerificationContext = createContext<
  SubscriptionVerificationContextValue | undefined
>(undefined);

const logDebug = (...args: unknown[]) => {
  if (DEBUG) console.log("[SubscriptionVerification]", ...args);
};

const isCheckoutExpired = (initiatedAt?: number | null) =>
  Boolean(initiatedAt && Date.now() - initiatedAt > CHECKOUT_LINK_TTL_MS);

function useSubscriptionVerificationState(): SubscriptionVerificationContextValue {
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [pendingPaymentUrl, setPendingPaymentUrl] = useState<string | null>(null);
  const [pendingPaymentReference, setPendingPaymentReference] =
    useState<string | null>(null);
  const [pendingInitiatedAt, setPendingInitiatedAt] = useState<number | null>(null);
  const [pendingStatus, setPendingStatus] =
    useState<SubscriptionPaymentStatus>("idle");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const isCheckingRef = useRef(false);
  const isDismissingRef = useRef(false);
  const appState = useRef(AppState.currentState);
  const { refetch } = useActiveSubscription({ enabled: false });
  const { mutateAsync: createSubscription } = useCreateSubscription();
  const { mutateAsync: dismissSubscription } = useDismissSubscriptionPayment();

  const readPending = useCallback(async () => {
    const raw = await AsyncStorage.getItem(PENDING_SUBSCRIPTION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingSubscription;
  }, []);

  const persistPending = useCallback(async (payload: PendingSubscription) => {
    await AsyncStorage.setItem(PENDING_SUBSCRIPTION_KEY, JSON.stringify(payload));
    setPendingPlanId(payload.planId);
    setPendingPaymentUrl(payload.paymentUrl || null);
    setPendingPaymentReference(payload.paymentReference || null);
    setPendingInitiatedAt(payload.initiatedAt);
    setPendingStatus(payload.status || "ready");
  }, []);

  const clearVerification = useCallback(async () => {
    logDebug("Clearing pending subscription payment state");
    await AsyncStorage.removeItem(PENDING_SUBSCRIPTION_KEY);
    setPendingPlanId(null);
    setPendingPaymentUrl(null);
    setPendingPaymentReference(null);
    setPendingInitiatedAt(null);
    setPendingStatus("idle");
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const parsed = await readPending();
      if (!parsed) {
        await clearVerification();
        return;
      }

      // Bug fix: the app was killed while a dismissal was in flight, so the
      // backend may never have been told to cancel the payment. Retry the
      // backend dismissal now, then clean up local state.
      if (parsed.status === "dismissed") {
        logDebug("Completing interrupted subscription dismissal", parsed);
        if (parsed.paymentReference) {
          try {
            await dismissSubscription(parsed.paymentReference);
          } catch (error) {
            logDebug("Could not complete interrupted dismissal on backend", error);
          }
        }
        await clearVerification();
        return;
      }

      if (isCheckoutExpired(parsed.initiatedAt)) {
        await persistPending({ ...parsed, status: "expired" });
        trackEvent("subscription_verification_timeout", {
          plan_id: parsed.planId,
          reason: "expired_checkout_link",
        });
        return;
      }

      setPendingPlanId(parsed.planId);
      setPendingPaymentUrl(parsed.paymentUrl || null);
      setPendingPaymentReference(parsed.paymentReference || null);
      setPendingInitiatedAt(parsed.initiatedAt);
      setPendingStatus(parsed.status || "ready");
    } catch (error) {
      logDebug("Could not load pending subscription payment", error);
      await clearVerification();
    } finally {
      setHasLoaded(true);
    }
  }, [clearVerification, dismissSubscription, persistPending, readPending]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const updatePendingStatus = useCallback(
    async (
      status: SubscriptionPaymentStatus,
      extra: Partial<PendingSubscription> = {}
    ) => {
      const stored = await readPending();
      const planId = pendingPlanId || stored?.planId;
      const initiatedAt = pendingInitiatedAt || stored?.initiatedAt;
      if (!planId || !initiatedAt) return;

      await persistPending({
        ...stored,
        planId,
        paymentUrl: pendingPaymentUrl || stored?.paymentUrl || null,
        paymentReference:
          pendingPaymentReference || stored?.paymentReference || null,
        initiatedAt,
        status,
        lastCheckedAt: Date.now(),
        verificationAttempts: (stored?.verificationAttempts || 0) + 1,
        ...extra,
      });
    },
    [
      pendingInitiatedAt,
      pendingPaymentReference,
      pendingPaymentUrl,
      pendingPlanId,
      persistPending,
      readPending,
    ]
  );

  const startVerification = useCallback(
    async (
      planId: string,
      paymentUrl?: string | null,
      paymentReference?: string | null
    ) => {
      const payload: PendingSubscription = {
        planId,
        paymentUrl: paymentUrl || null,
        paymentReference: paymentReference || null,
        initiatedAt: Date.now(),
        status: "ready",
        lastCheckedAt: null,
        verificationAttempts: 0,
        lastOpenedAt: null,
      };

      await persistPending(payload);
      trackEvent("subscription_payment_started", {
        plan_id: planId,
        payment_reference: paymentReference || null,
      });
    },
    [persistPending]
  );

  const checkStatusOnce = useCallback(async () => {
    if (isCheckingRef.current) return false;
    // Bug fix: never fire a check while the user is dismissing; the payment
    // has been (or is being) cancelled.
    if (isDismissingRef.current) return false;

    const stored = pendingPlanId ? null : await readPending();
    const activePlanId = pendingPlanId || stored?.planId || null;
    const activeInitiatedAt = pendingInitiatedAt || stored?.initiatedAt || null;

    if (!activePlanId) return false;

    if (isCheckoutExpired(activeInitiatedAt)) {
      await updatePendingStatus("expired");
      trackEvent("subscription_verification_timeout", {
        plan_id: activePlanId,
        reason: "expired_checkout_link",
      });
      return false;
    }

    isCheckingRef.current = true;
    setIsChecking(true);
    setPendingStatus("verifying");

    try {
      const { data } = await refetch();
      const verified =
        !!data && data.status === "active" && data.plan_id === activePlanId;

      if (verified) {
        trackEvent("subscription_verified", { plan_id: activePlanId });
        setPendingStatus("confirmed");
        await clearVerification();
        return true;
      }

      await updatePendingStatus("needs_action");
      return false;
    } catch (error) {
      logDebug("Subscription verification check failed", error);
      await updatePendingStatus("needs_action");
      return false;
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [
    clearVerification,
    pendingInitiatedAt,
    pendingPlanId,
    readPending,
    refetch,
    updatePendingStatus,
  ]);

  const checkStatus = useCallback(
    async (options: { bounded?: boolean } = {}) => {
      const confirmed = await checkStatusOnce();
      if (confirmed || !options.bounded) return confirmed;

      const startedAt = Date.now();
      const maxDurationMs = 18000;
      const intervalMs = 2500;

      while (Date.now() - startedAt < maxDurationMs) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));

        // Bug fix: if the user dismissed while we were retrying, bail out
        // early instead of keeping the subscription check running.
        if (isDismissingRef.current) {
          logDebug("Dismissed during bounded retry; stopping");
          return false;
        }
        const stored = await readPending();
        if (!stored?.planId) {
          logDebug("Pending subscription cleared during bounded retry; stopping");
          return false;
        }
        const retryConfirmed = await checkStatusOnce();
        if (retryConfirmed) return true;
      }

      await updatePendingStatus("needs_action");
      return false;
    },
    [checkStatusOnce, readPending, updatePendingStatus]
  );

  const continuePayment = useCallback(async () => {
    const stored = await readPending();
    const paymentUrl = pendingPaymentUrl || stored?.paymentUrl || null;
    const activeInitiatedAt = pendingInitiatedAt || stored?.initiatedAt || null;

    if (isCheckoutExpired(activeInitiatedAt)) {
      await updatePendingStatus("expired");
      return false;
    }

    if (!paymentUrl) {
      await updatePendingStatus("needs_action");
      return false;
    }

    await updatePendingStatus("checkout_opened", {
      lastOpenedAt: Date.now(),
    });
    await WebBrowser.openBrowserAsync(paymentUrl);
    return checkStatus({ bounded: true });
  }, [
    checkStatus,
    pendingInitiatedAt,
    pendingPaymentUrl,
    readPending,
    updatePendingStatus,
  ]);

  const startNewPayment = useCallback(async () => {
    const stored = await readPending();
    const planId = pendingPlanId || stored?.planId || null;

    if (!planId) return false;

    const response = await createSubscription({ plan_id: planId });
    const paymentUrl = response?.payment_url || null;
    const paymentReference = response?.payment_reference || null;

    if (!paymentUrl) {
      await updatePendingStatus("needs_action");
      return false;
    }

    await persistPending({
      planId,
      paymentUrl,
      paymentReference,
      initiatedAt: Date.now(),
      status: "checkout_opened",
      lastCheckedAt: null,
      verificationAttempts: 0,
      lastOpenedAt: Date.now(),
    });
    trackEvent("subscription_payment_restarted", {
      plan_id: planId,
      payment_reference: paymentReference,
    });
    await WebBrowser.openBrowserAsync(paymentUrl);
    return checkStatus({ bounded: true });
  }, [
    checkStatus,
    createSubscription,
    pendingPlanId,
    persistPending,
    readPending,
    updatePendingStatus,
  ]);

  const dismissPayment = useCallback(async () => {
    const stored = await readPending();
    const planId = pendingPlanId || stored?.planId || null;
    const reference =
      pendingPaymentReference || stored?.paymentReference || null;
    trackEvent("subscription_prompt_skipped", {
      trigger: "subscription_payment",
      plan_id: planId,
    });

    if (planId && reference) {
      isDismissingRef.current = true;
      // Bug fix: persist the "dismissed" marker FIRST so the modal hides
      // immediately and a crash or network failure mid-dismiss never leaves
      // a pending payment that keeps being checked. If the backend call
      // fails, loadPending retries it on the next launch.
      await updatePendingStatus("dismissed");
      try {
        await dismissSubscription(reference);
      } catch (error) {
        logDebug("Could not dismiss subscription payment on backend; will retry on next launch", error);
      } finally {
        isDismissingRef.current = false;
      }
    }

    await clearVerification();
  }, [
    clearVerification,
    dismissSubscription,
    pendingPaymentReference,
    pendingPlanId,
    readPending,
    updatePendingStatus,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          void (async () => {
            await loadPending();
            const stored = await readPending();
            if (stored?.status === "checkout_opened") {
              void checkStatus({ bounded: true });
            }
          })();
        }

        appState.current = nextState;
      }
    );

    return () => sub.remove();
  }, [checkStatus, loadPending, readPending]);

  return useMemo(
    () => ({
      isVerifying:
        hasLoaded &&
        !!pendingPlanId &&
        pendingStatus !== "idle" &&
        pendingStatus !== "dismissed",
      pendingPlanId,
      pendingPaymentUrl,
      pendingPaymentReference,
      pendingStatus: isChecking ? "verifying" : pendingStatus,
      startVerification,
      continuePayment,
      startNewPayment,
      dismissPayment,
      clearVerification,
      checkStatus,
    }),
    [
      checkStatus,
      clearVerification,
      continuePayment,
      dismissPayment,
      hasLoaded,
      isChecking,
      pendingPaymentReference,
      pendingPaymentUrl,
      pendingPlanId,
      pendingStatus,
      startNewPayment,
      startVerification,
    ]
  );
}

export function SubscriptionVerificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useSubscriptionVerificationState();

  return (
    <SubscriptionVerificationContext.Provider value={value}>
      {children}
    </SubscriptionVerificationContext.Provider>
  );
}

export function useSubscriptionVerificationContext() {
  const context = useContext(SubscriptionVerificationContext);

  if (!context) {
    throw new Error(
      "useSubscriptionVerificationContext must be used within SubscriptionVerificationProvider"
    );
  }

  return context;
}

export const useSubscriptionVerification = useSubscriptionVerificationContext;
