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
import * as WebBrowser from "expo-web-browser";

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
      const isExpired = isCheckoutExpired(parsed.initiatedAt);

      if (isExpired) {
        const expiredPayload = { ...parsed, status: "expired" as const };
        logDebug("Pending deposit checkout link expired", expiredPayload);
        await persistPendingDeposit(expiredPayload);
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
  }, [clearDepositVerification, persistPendingDeposit]);

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
        verificationAttempts: (storedPending?.verificationAttempts || 0) + 1,
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
      try {
        await dismissDeposit(reference);
      } catch (error) {
        logDebug("Could not dismiss deposit on backend", error);
      }
    }

    await clearPendingDeposit();
  }, [
    clearPendingDeposit,
    dismissDeposit,
    pendingAmount,
    pendingReference,
    readStoredPendingDeposit,
  ]);

  const verifyPendingDepositOnce = useCallback(async () => {
    if (isCheckingRef.current) return false;

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
    try {
      logDebug("Verifying pending deposit", activeReference);
      const result = await verifyDeposit(activeReference);
      const verifiedAmount = result.data?.deposit?.amount || activeAmount;

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
      await updatePendingStatus(isStillProcessing ? "needs_action" : "failed");
      return false;
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [
    clearPendingDeposit,
    pendingInitiatedAt,
    pendingAmount,
    pendingReference,
    readStoredPendingDeposit,
    verifyDeposit,
    updatePendingStatus,
  ]);

  const verifyPendingDeposit = useCallback(
    async (options: { bounded?: boolean } = {}) => {
      const confirmed = await verifyPendingDepositOnce();
      if (confirmed || !options.bounded) return confirmed;

      const startedAt = Date.now();
      const maxDurationMs = 18000;
      const intervalMs = 2500;

      while (Date.now() - startedAt < maxDurationMs) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        const retryConfirmed = await verifyPendingDepositOnce();
        if (retryConfirmed) return true;
      }

      await updatePendingStatus("needs_action");
      return false;
    },
    [updatePendingStatus, verifyPendingDepositOnce]
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

    await updatePendingStatus("checkout_opened", {
      lastOpenedAt: Date.now(),
    });

    await WebBrowser.openBrowserAsync(authorizationUrl);
    await verifyPendingDeposit({ bounded: true });
  }, [
    pendingAuthorizationUrl,
    pendingInitiatedAt,
    readStoredPendingDeposit,
    updatePendingStatus,
    verifyPendingDeposit,
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
    await WebBrowser.openBrowserAsync(authorizationUrl);
    await verifyPendingDeposit({ bounded: true });
  }, [
    dismissDeposit,
    initiateDeposit,
    quoteDeposit,
    pendingAmount,
    pendingReference,
    persistPendingDeposit,
    readStoredPendingDeposit,
    updatePendingStatus,
    verifyPendingDeposit,
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
            if (storedPending?.status === "checkout_opened") {
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
