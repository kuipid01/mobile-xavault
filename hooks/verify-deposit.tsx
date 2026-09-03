import AsyncStorage from "@react-native-async-storage/async-storage";
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
import Toast from "react-native-toast-message";
import { useDismissDeposit, useInitiateDeposit, useQuoteDeposit, useVerifyDeposit } from "./app/wallet";
import { trackEvent } from "@/lib/analytics";

const PENDING_DEPOSIT_KEY = "pending_deposit_verification";
const CHECKOUT_LINK_TTL_MS = 24 * 60 * 60 * 1000;
const DEBUG = true;

export type DepositVerificationStatus =
  | "idle"
  | "ready"
  | "checkout_opened"
  | "verifying"
  | "needs_action"
  | "confirmed"
  | "still_processing"
  | "failed"
  | "expired"
  | "dismissed";

type PendingDeposit = {
  reference: string;
  amount: number;
  authorizationUrl?: string | null;
  idempotencyKey?: string | null;
  initiatedAt: number;
  status?: DepositVerificationStatus;
  lastCheckedAt?: number | null;
  verificationAttempts?: number;
  lastOpenedAt?: number | null;
};

type ConfirmedDepositReceipt = {
  reference: string;
  amount: number;
  confirmedAt: number;
};

type DepositVerificationContextValue = {
  pendingReference: string | null;
  pendingAmount: number | null;
  pendingAuthorizationUrl: string | null;
  pendingStatus: DepositVerificationStatus;
  lastCheckedAt: number | null;
  confirmedReceipt: ConfirmedDepositReceipt | null;
  checkoutUrl: string | null;
  closeCheckout: () => void;
  isVerifyingDeposit: boolean;
  startDepositVerification: (
    reference: string,
    amount: number,
    authorizationUrl?: string | null,
    idempotencyKey?: string | null
  ) => Promise<void>;
  continueDepositPayment: () => Promise<void>;
  startNewDepositPayment: () => Promise<void>;
  verifyPendingDeposit: (options?: { bounded?: boolean }) => Promise<boolean>;
  clearDepositVerification: () => Promise<void>;
  dismissDepositReceipt: () => void;
  dismissPendingDeposit: () => Promise<void>;
};

const DepositVerificationContext = createContext<
  DepositVerificationContextValue | undefined
>(undefined);

const logDebug = (...args: unknown[]) => {
  if (DEBUG) console.log("[DepositVerification]", ...args);
};

const createIdempotencyKey = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const isCheckoutExpired = (initiatedAt?: number | null) =>
  Boolean(initiatedAt && Date.now() - initiatedAt > CHECKOUT_LINK_TTL_MS);

function useDepositVerificationState(): DepositVerificationContextValue {
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [pendingAuthorizationUrl, setPendingAuthorizationUrl] =
    useState<string | null>(null);
  // URL of the Paystack checkout currently shown in the in-app WebView.
  // Null when no checkout is open. Deliberately NOT persisted: after a
  // relaunch the checkout is re-opened from the stored authorizationUrl.
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [pendingInitiatedAt, setPendingInitiatedAt] = useState<number | null>(null);
  const [pendingStatus, setPendingStatus] =
    useState<DepositVerificationStatus>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] =
    useState<ConfirmedDepositReceipt | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { mutateAsync: verifyDeposit } = useVerifyDeposit();
  const { mutateAsync: dismissDeposit } = useDismissDeposit();
  const { mutateAsync: initiateDeposit } = useInitiateDeposit();
  const { mutateAsync: quoteDeposit } = useQuoteDeposit();
  const appState = useRef(AppState.currentState);
  const isCheckingRef = useRef(false);
  const isDismissingRef = useRef(false);

  const persistPendingDeposit = useCallback(async (payload: PendingDeposit) => {
    await AsyncStorage.setItem(PENDING_DEPOSIT_KEY, JSON.stringify(payload));
    setPendingReference(payload.reference);
    setPendingAmount(payload.amount);
    setPendingAuthorizationUrl(payload.authorizationUrl || null);
    setPendingInitiatedAt(payload.initiatedAt);
    setPendingStatus(payload.status || "ready");
    setLastCheckedAt(payload.lastCheckedAt || null);
  }, []);

  const readStoredPendingDeposit = useCallback(async () => {
    const raw = await AsyncStorage.getItem(PENDING_DEPOSIT_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as PendingDeposit;
  }, []);

  const clearPendingDeposit = useCallback(async () => {
    logDebug("Clearing pending deposit");
    await AsyncStorage.removeItem(PENDING_DEPOSIT_KEY);
    setPendingReference(null);
    setPendingAmount(null);
    setPendingAuthorizationUrl(null);
    setPendingInitiatedAt(null);
    setPendingStatus("idle");
    setLastCheckedAt(null);
  }, []);

  const clearDepositVerification = useCallback(async () => {
    await clearPendingDeposit();
    setConfirmedReceipt(null);
  }, [clearPendingDeposit]);

  const dismissDepositReceipt = useCallback(() => {
    setConfirmedReceipt(null);
  }, []);

  const loadPendingDeposit = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_DEPOSIT_KEY);
      if (!raw) {
        setPendingReference(null);
        setPendingAmount(null);
        setPendingAuthorizationUrl(null);
        setPendingInitiatedAt(null);
        setPendingStatus("idle");
        setLastCheckedAt(null);
        return;
      }

      const parsed: PendingDeposit = JSON.parse(raw);

      // Bug fix: the app was killed while a dismissal was in flight, so the
      // backend may never have been told to cancel the deposit and would keep
      // polling Paystack for an abandoned payment. Retry the backend dismissal
      // now, then clean up local state.
      if (parsed.status === "dismissed") {
        logDebug("Completing interrupted deposit dismissal", parsed);
        try {
          await dismissDeposit(parsed.reference);
        } catch (error) {
          logDebug("Could not complete interrupted dismissal on backend", error);
        }
        await clearPendingDeposit();
        return;
      }

      const isExpired = isCheckoutExpired(parsed.initiatedAt);

      if (isExpired) {
        const expiredPayload = { ...parsed, status: "expired" as const };
        logDebug("Pending deposit checkout link expired", expiredPayload);
        await persistPendingDeposit(expiredPayload);
        return;
      }

      // Bug fix: If the app was killed during a verify call, status is stuck
      // as "verifying". Recover by resetting to the last known checkout state
      // so the modal / AppState listener can handle it normally.
      if (parsed.status === "verifying") {
        const recoveredPayload = { ...parsed, status: "checkout_opened" as const };
        logDebug("Recovering stuck 'verifying' status to 'checkout_opened'", recoveredPayload);
        await persistPendingDeposit(recoveredPayload);
        return;
      }

      logDebug("Loaded pending deposit", parsed);
      setPendingReference(parsed.reference);
      setPendingAmount(parsed.amount || null);
      setPendingAuthorizationUrl(parsed.authorizationUrl || null);
      setPendingInitiatedAt(parsed.initiatedAt);
      setPendingStatus(parsed.status || "ready");
      setLastCheckedAt(parsed.lastCheckedAt || null);
    } catch (error) {
      logDebug("Could not load pending deposit; clearing", error);
      await clearDepositVerification();
    }
  }, [clearDepositVerification, dismissDeposit, persistPendingDeposit]);

  useEffect(() => {
    void loadPendingDeposit();
  }, [loadPendingDeposit]);

  const updatePendingStatus = useCallback(
    async (
      status: DepositVerificationStatus,
      extra: Partial<PendingDeposit> = {}
    ) => {
      const storedPending = await readStoredPendingDeposit();
      const reference = pendingReference || storedPending?.reference;
      const initiatedAt = pendingInitiatedAt || storedPending?.initiatedAt;
      const amount = pendingAmount || storedPending?.amount || 0;
      const authorizationUrl =
        pendingAuthorizationUrl || storedPending?.authorizationUrl || null;

      if (!reference || !initiatedAt) return;

      const nextPayload: PendingDeposit = {
        ...storedPending,
        reference,
        amount,
        authorizationUrl,
        initiatedAt,
        status,
        lastCheckedAt: Date.now(),
        ...extra,
      };

      await persistPendingDeposit(nextPayload);
    },
    [
      pendingAmount,
      pendingAuthorizationUrl,
      pendingInitiatedAt,
      pendingReference,
      persistPendingDeposit,
      readStoredPendingDeposit,
    ]
  );

  const closeCheckout = useCallback(() => {
    setCheckoutUrl(null);
  }, []);

  // Close the in-app checkout whenever the deposit reaches a terminal state
  // (confirmed / dismissed / expired) or the pending deposit is cleared, so
  // the checkout never lingers over a completed payment.
  useEffect(() => {
    if (
      pendingStatus === "confirmed" ||
      pendingStatus === "dismissed" ||
      pendingStatus === "expired" ||
      pendingReference === null
    ) {
      setCheckoutUrl(null);
    }
  }, [pendingReference, pendingStatus]);

  const startDepositVerification = useCallback(
    async (
      reference: string,
      amount: number,
      authorizationUrl?: string | null,
      idempotencyKey?: string | null
    ) => {
      const payload: PendingDeposit = {
        reference,
        amount,
        authorizationUrl: authorizationUrl || null,
        idempotencyKey: idempotencyKey || null,
        initiatedAt: Date.now(),
        status: "ready",
        lastCheckedAt: null,
        verificationAttempts: 0,
        lastOpenedAt: null,
      };

      logDebug("Starting deposit verification", payload);
      trackEvent("deposit_started", {
        amount,
        reference,
      });
      // Bug fix: clear any stale receipt from a previous deposit.
      setConfirmedReceipt(null);
      await persistPendingDeposit(payload);
    },
    [persistPendingDeposit]
  );

  const dismissPendingDeposit = useCallback(async () => {
    const storedPending = await readStoredPendingDeposit();
    const reference = pendingReference || storedPending?.reference;
    trackEvent("deposit_abandoned", {
      amount: pendingAmount || storedPending?.amount || 0,
      reference: reference || null,
    });

    if (reference) {
      isDismissingRef.current = true;
      // Bug fix: persist the "dismissed" marker FIRST so the modal hides
      // immediately and a crash or network failure mid-dismiss never leaves
      // a pending deposit that keeps being polled. If the backend call fails,
      // loadPendingDeposit retries it on the next launch.
      await updatePendingStatus("dismissed");
      try {
        await dismissDeposit(reference);
      } catch (error) {
        logDebug("Could not dismiss deposit on backend; will retry on next launch", error);
      } finally {
        isDismissingRef.current = false;
      }
    }

    // Bug fix: clear any stale receipt from a previous deposit so it
    // doesn't flash alongside the next deposit's modal.
    setConfirmedReceipt(null);
    await clearPendingDeposit();
  }, [
    clearPendingDeposit,
    dismissDeposit,
    pendingAmount,
    pendingReference,
    readStoredPendingDeposit,
    updatePendingStatus,
  ]);

  const verifyPendingDepositOnce = useCallback(async () => {
    if (isCheckingRef.current) return false;
    // Bug fix: never fire a verification while the user is dismissing; the
    // payment has been (or is being) cancelled.
    if (isDismissingRef.current) return false;

    const storedPending = pendingReference
      ? null
      : await readStoredPendingDeposit();
    const activeReference = pendingReference || storedPending?.reference;
    const activeInitiatedAt = pendingInitiatedAt || storedPending?.initiatedAt;

    if (!activeReference) return false;

    if (
      activeInitiatedAt &&
      isCheckoutExpired(activeInitiatedAt)
    ) {
      await updatePendingStatus("expired");
      return false;
    }

    const activeAmount = pendingAmount || storedPending?.amount || 0;
    isCheckingRef.current = true;
    setIsChecking(true);
    setPendingStatus("verifying");
    // Bug fix: increment verificationAttempts here (actual API call)
    // rather than inside updatePendingStatus which fires on every
    // status transition.
    const prevAttempts = (storedPending?.verificationAttempts || 0) + 1;
    try {
      logDebug("Verifying pending deposit", activeReference);
      const result = await verifyDeposit(activeReference);
      const verifiedAmount = result.data?.deposit?.amount || activeAmount;

      // Bug fix: persist verificationAttempts correctly before clearing.
      const storedAfterCheck = await readStoredPendingDeposit();
      if (storedAfterCheck) {
        await persistPendingDeposit({
          ...storedAfterCheck,
          verificationAttempts: prevAttempts,
        });
      }

      setPendingStatus("confirmed");
      setConfirmedReceipt({
        reference: activeReference,
        amount: verifiedAmount,
        confirmedAt: Date.now(),
      });
      trackEvent("deposit_verified", {
        amount: verifiedAmount,
        reference: activeReference,
      });
      await clearPendingDeposit();
      Toast.show({
        type: "success",
        text1: "Deposit confirmed",
        text2: `Ref ${activeReference}`,
      });
      return true;
    } catch (error) {
      logDebug("Deposit is not confirmed yet", error);
      const apiError =
        (error as any)?.response?.data?.error ||
        (error as any)?.response?.data?.message ||
        (error as any)?.message;
      const isStillProcessing =
        apiError === "deposit_not_verified" ||
        String(apiError || "").toLowerCase().includes("not verified");

      trackEvent(
        isStillProcessing ? "deposit_still_processing" : "deposit_failed",
        {
          amount: activeAmount,
          error: String(apiError || "unknown"),
          reference: activeReference,
        }
      );
      await updatePendingStatus(isStillProcessing ? "needs_action" : "failed", {
        verificationAttempts: prevAttempts,
      });
      return false;
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  },    [
    clearPendingDeposit,
    persistPendingDeposit,
    pendingInitiatedAt,
    pendingAmount,
    pendingReference,
    readStoredPendingDeposit,
    verifyDeposit,
    updatePendingStatus,
  ]
  );

  const verifyPendingDeposit = useCallback(
    async (options: { bounded?: boolean } = {}) => {
      const confirmed = await verifyPendingDepositOnce();
      if (confirmed || !options.bounded) return confirmed;

      // Give the payment time to propagate on the backend.
      // Typical Paystack webhooks take 5-30s after the user completes payment.
      const startedAt = Date.now();
      const maxDurationMs = 60000;
      const intervalMs = 4000;

      while (Date.now() - startedAt < maxDurationMs) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));

        // Bug fix: if the user dismissed while we were retrying, bail out
        // early instead of burning cycles on a null reference.
        if (isDismissingRef.current) {
          logDebug("Dismissed during bounded retry; stopping");
          return false;
        }
        if (!pendingReference) {
          const stored = await readStoredPendingDeposit();
          if (!stored?.reference) {
            logDebug("Pending deposit cleared during bounded retry; stopping");
            return false;
          }
        }

        const retryConfirmed = await verifyPendingDepositOnce();
        if (retryConfirmed) return true;
      }

      // After the retry window, mark as still_processing rather than failed,
      // so the user sees a non-alarming state and can manually verify again.
      await updatePendingStatus("still_processing");
      return false;
    },
    [pendingReference, readStoredPendingDeposit, updatePendingStatus, verifyPendingDepositOnce]
  );

  const continueDepositPayment = useCallback(async () => {
    const storedPending = await readStoredPendingDeposit();
    const authorizationUrl =
      pendingAuthorizationUrl || storedPending?.authorizationUrl || null;
    const activeInitiatedAt = pendingInitiatedAt || storedPending?.initiatedAt;

    if (isCheckoutExpired(activeInitiatedAt)) {
      await updatePendingStatus("expired");
      Toast.show({
        type: "info",
        text1: "Payment link expired",
        text2: "Start a new payment to continue.",
      });
      return;
    }

    if (!authorizationUrl) {
      await updatePendingStatus("needs_action");
      Toast.show({
        type: "error",
        text1: "Payment link unavailable",
        text2: "Start a new deposit to continue.",
      });
      return;
    }

    // Open the Paystack checkout inside the app instead of in an external
    // browser tab. A custom tab belongs to Chrome's process and the OS can
    // destroy it while the user is away paying (e.g. bank transfer via Opay),
    // which made the checkout page "disappear". The in-app WebView lives in
    // this app's process, so it survives backgrounding and the same checkout
    // can be reopened at any time.
    await updatePendingStatus("checkout_opened", {
      lastOpenedAt: Date.now(),
    });
    setCheckoutUrl(authorizationUrl);
    // Completion is detected by the checkout WebView redirecting to our
    // callback URL; verification also runs when the user returns from a
    // banking app (AppState listener) or taps "Check again".
  }, [
    pendingAuthorizationUrl,
    pendingInitiatedAt,
    readStoredPendingDeposit,
    updatePendingStatus,
  ]);

  const startNewDepositPayment = useCallback(async () => {
    const storedPending = await readStoredPendingDeposit();
    const amount = pendingAmount || storedPending?.amount || 0;
    const oldReference = pendingReference || storedPending?.reference || null;

    if (!amount) {
      await updatePendingStatus("needs_action");
      Toast.show({
        type: "error",
        text1: "Amount unavailable",
        text2: "Start the deposit again from your wallet.",
      });
      return;
    }

    if (oldReference) {
      try {
        await dismissDeposit(oldReference);
      } catch (error) {
        logDebug("Could not dismiss expired deposit on backend", error);
      }
    }

    const idempotencyKey = createIdempotencyKey();
    const quote = await quoteDeposit(amount);
    if (!quote?.quote_id) throw new Error("Could not refresh deposit fee quote");
    const response = await initiateDeposit({
      amount,
      quote_id: quote.quote_id,
      idempotency_key: idempotencyKey,
    });
    const authorizationUrl =
      response?.authorization_url || response?.data?.authorization_url;
    const reference = response?.reference || response?.data?.reference;

    if (!authorizationUrl || !reference) {
      await updatePendingStatus("needs_action");
      Toast.show({
        type: "error",
        text1: "Payment link unavailable",
        text2: "Please try starting the deposit again.",
      });
      return;
    }

    const payload: PendingDeposit = {
      reference,
      amount,
      authorizationUrl,
      idempotencyKey,
      initiatedAt: Date.now(),
      status: "checkout_opened",
      lastCheckedAt: null,
      verificationAttempts: 0,
      lastOpenedAt: Date.now(),
    };

    await persistPendingDeposit(payload);
    trackEvent("deposit_payment_restarted", {
      amount,
      old_reference: oldReference,
      reference,
    });
    // Show the new checkout in the in-app WebView (see continueDepositPayment).
    setCheckoutUrl(authorizationUrl);
    // Completion is detected by the checkout WebView redirecting to our
    // callback URL, or when the user returns from a banking app.
  }, [
    dismissDeposit,
    initiateDeposit,
    quoteDeposit,
    pendingAmount,
    pendingReference,
    persistPendingDeposit,
    readStoredPendingDeposit,
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
            await loadPendingDeposit();
            const storedPending = await readStoredPendingDeposit();
            const status = storedPending?.status;
            // Verify when returning from checkout, or if the user left during a
            // still_processing / needs_action state (they may have gone back
            // to complete payment).
            if (
              status === "checkout_opened" ||
              status === "still_processing" ||
              status === "needs_action"
            ) {
              void verifyPendingDeposit({ bounded: true });
            }
          })();
        }

        appState.current = nextState;
      }
    );

    return () => sub.remove();
  }, [loadPendingDeposit, readStoredPendingDeposit, verifyPendingDeposit]);

  return useMemo(
    () => ({
      pendingReference,
      pendingAmount,
      pendingAuthorizationUrl,
      pendingStatus,
      lastCheckedAt,
      confirmedReceipt,
      checkoutUrl,
      closeCheckout,
      isVerifyingDeposit: isChecking,
      startDepositVerification,
      continueDepositPayment,
      startNewDepositPayment,
      verifyPendingDeposit,
      clearDepositVerification,
      dismissDepositReceipt,
      dismissPendingDeposit,
    }),
    [
      clearDepositVerification,
      checkoutUrl,
      closeCheckout,
      confirmedReceipt,
      continueDepositPayment,
      dismissDepositReceipt,
      dismissPendingDeposit,
      isChecking,
      lastCheckedAt,
      pendingAuthorizationUrl,
      pendingAmount,
      pendingReference,
      pendingStatus,
      startDepositVerification,
      startNewDepositPayment,
      verifyPendingDeposit,
    ]
  );
}

export function DepositVerificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useDepositVerificationState();

  return (
    <DepositVerificationContext.Provider value={value}>
      {children}
    </DepositVerificationContext.Provider>
  );
}

export function useDepositVerificationContext() {
  const context = useContext(DepositVerificationContext);

  if (!context) {
    throw new Error(
      "useDepositVerificationContext must be used within DepositVerificationProvider"
    );
  }

  return context;
}

export function DepositVerificationWatcher() {
  return null;
}
