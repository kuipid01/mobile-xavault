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
import { useVerifyDeposit } from "./app/wallet";
import { trackEvent } from "@/lib/analytics";

const PENDING_DEPOSIT_KEY = "pending_deposit_verification";
const MAX_PENDING_AGE_MS = 24 * 60 * 60 * 1000;
const DEBUG = true;

export type DepositVerificationStatus =
  | "idle"
  | "initiated"
  | "verifying"
  | "confirmed"
  | "still_processing"
  | "failed"
  | "abandoned";

type PendingDeposit = {
  reference: string;
  amount: number;
  initiatedAt: number;
  status?: DepositVerificationStatus;
  lastCheckedAt?: number | null;
};

type ConfirmedDepositReceipt = {
  reference: string;
  amount: number;
  confirmedAt: number;
};

type DepositVerificationContextValue = {
  pendingReference: string | null;
  pendingAmount: number | null;
  pendingStatus: DepositVerificationStatus;
  lastCheckedAt: number | null;
  confirmedReceipt: ConfirmedDepositReceipt | null;
  isVerifyingDeposit: boolean;
  startDepositVerification: (reference: string, amount: number) => Promise<void>;
  verifyPendingDeposit: () => Promise<boolean>;
  clearDepositVerification: () => Promise<void>;
  dismissDepositReceipt: () => void;
  markDepositAbandoned: () => Promise<void>;
};

const DepositVerificationContext = createContext<
  DepositVerificationContextValue | undefined
>(undefined);

const logDebug = (...args: unknown[]) => {
  if (DEBUG) console.log("[DepositVerification]", ...args);
};

function useDepositVerificationState(): DepositVerificationContextValue {
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [pendingInitiatedAt, setPendingInitiatedAt] = useState<number | null>(null);
  const [pendingStatus, setPendingStatus] =
    useState<DepositVerificationStatus>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] =
    useState<ConfirmedDepositReceipt | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { mutateAsync: verifyDeposit } = useVerifyDeposit();
  const appState = useRef(AppState.currentState);

  const persistPendingDeposit = useCallback(async (payload: PendingDeposit) => {
    await AsyncStorage.setItem(PENDING_DEPOSIT_KEY, JSON.stringify(payload));
    setPendingReference(payload.reference);
    setPendingAmount(payload.amount);
    setPendingInitiatedAt(payload.initiatedAt);
    setPendingStatus(payload.status || "initiated");
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
        setPendingInitiatedAt(null);
        setPendingStatus("idle");
        setLastCheckedAt(null);
        return;
      }

      const parsed: PendingDeposit = JSON.parse(raw);
      const isExpired = Date.now() - parsed.initiatedAt > MAX_PENDING_AGE_MS;

      if (isExpired) {
        logDebug("Pending deposit is too old; clearing", parsed);
        await clearPendingDeposit();
        return;
      }

      logDebug("Loaded pending deposit", parsed);
      setPendingReference(parsed.reference);
      setPendingAmount(parsed.amount || null);
      setPendingInitiatedAt(parsed.initiatedAt);
      setPendingStatus(parsed.status || "initiated");
      setLastCheckedAt(parsed.lastCheckedAt || null);
    } catch (error) {
      logDebug("Could not load pending deposit; clearing", error);
      await clearDepositVerification();
    }
  }, [clearDepositVerification, clearPendingDeposit]);

  useEffect(() => {
    void loadPendingDeposit();
  }, [loadPendingDeposit]);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          void loadPendingDeposit();
        }

        appState.current = nextState;
      }
    );

    return () => sub.remove();
  }, [loadPendingDeposit]);

  const updatePendingStatus = useCallback(
    async (status: DepositVerificationStatus) => {
      const storedPending = await readStoredPendingDeposit();
      const reference = pendingReference || storedPending?.reference;
      const initiatedAt = pendingInitiatedAt || storedPending?.initiatedAt;
      const amount = pendingAmount || storedPending?.amount || 0;

      if (!reference || !initiatedAt) return;

      const nextPayload: PendingDeposit = {
        reference,
        amount,
        initiatedAt,
        status,
        lastCheckedAt: Date.now(),
      };

      await persistPendingDeposit(nextPayload);
    },
    [
      pendingAmount,
      pendingInitiatedAt,
      pendingReference,
      persistPendingDeposit,
      readStoredPendingDeposit,
    ]
  );

  const startDepositVerification = useCallback(async (reference: string, amount: number) => {
    const payload: PendingDeposit = {
      reference,
      amount,
      initiatedAt: Date.now(),
      status: "initiated",
      lastCheckedAt: null,
    };

    logDebug("Starting deposit verification", payload);
    trackEvent("deposit_started", {
      amount,
      reference,
    });
    await persistPendingDeposit(payload);
  }, [persistPendingDeposit]);

  const markDepositAbandoned = useCallback(async () => {
    const storedPending = await readStoredPendingDeposit();
    trackEvent("deposit_abandoned", {
      amount: pendingAmount || storedPending?.amount || 0,
      reference: pendingReference || storedPending?.reference || null,
    });
    await updatePendingStatus("abandoned");
  }, [
    pendingAmount,
    pendingReference,
    readStoredPendingDeposit,
    updatePendingStatus,
  ]);

  const verifyPendingDeposit = useCallback(async () => {
    if (isChecking) return false;

    const storedPending = pendingReference
      ? null
      : await readStoredPendingDeposit();
    const activeReference = pendingReference || storedPending?.reference;
    const activeInitiatedAt = pendingInitiatedAt || storedPending?.initiatedAt;

    if (!activeReference) return false;

    if (
      activeInitiatedAt &&
      Date.now() - activeInitiatedAt > MAX_PENDING_AGE_MS
    ) {
      await clearPendingDeposit();
      return false;
    }

    const activeAmount = pendingAmount || storedPending?.amount || 0;
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
      await updatePendingStatus(isStillProcessing ? "still_processing" : "failed");
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [
    clearPendingDeposit,
    isChecking,
    pendingInitiatedAt,
    pendingReference,
    readStoredPendingDeposit,
    verifyDeposit,
    updatePendingStatus,
  ]);

  return useMemo(
    () => ({
      pendingReference,
      pendingAmount,
      pendingStatus,
      lastCheckedAt,
      confirmedReceipt,
      isVerifyingDeposit: isChecking,
      startDepositVerification,
      verifyPendingDeposit,
      clearDepositVerification,
      dismissDepositReceipt,
      markDepositAbandoned,
    }),
    [
      clearDepositVerification,
      confirmedReceipt,
      dismissDepositReceipt,
      isChecking,
      lastCheckedAt,
      markDepositAbandoned,
      pendingAmount,
      pendingReference,
      pendingStatus,
      startDepositVerification,
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
  const { pendingReference, verifyPendingDeposit } =
    useDepositVerificationContext();

  useEffect(() => {
    if (!pendingReference) return;

    const timer = setTimeout(() => {
      void verifyPendingDeposit();
    }, 700);

    return () => clearTimeout(timer);
  }, [pendingReference, verifyPendingDeposit]);

  return null;
}
