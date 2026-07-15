// Add to hooks/app/subscription.ts, alongside your other subscription hooks.
// Requires: npx expo install @react-native-async-storage/async-storage

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
import { useActiveSubscription } from "./app/subscription";
import { trackEvent } from "../lib/analytics";

// Toggle this flag to enable/disable console logs for this hook
const DEBUG = true;

const PENDING_SUBSCRIPTION_KEY = "pending_subscription_verification";
const MAX_PENDING_AGE_MS = 24 * 60 * 60 * 1000;

type PendingSubscription = {
    planId: string;
    initiatedAt: number;
};

type SubscriptionVerificationContextValue = {
    isVerifying: boolean;
    pendingPlanId: string | null;
    startVerification: (planId: string) => Promise<void>;
    clearVerification: () => Promise<void>;
    checkStatus: () => Promise<boolean>;
};

const SubscriptionVerificationContext = createContext<
    SubscriptionVerificationContextValue | undefined
>(undefined);

/**
 * Helper function to output formatted logs when DEBUG is true.
 */
const logDebug = (...args: any[]) => {
    if (DEBUG) {
        console.log("[useSubscriptionVerification]", ...args);
    }
};

/**
 * Tracks a subscription upgrade across the trip out to Paystack and
 * back. State lives in AsyncStorage (not React state) so it survives
 * the app being backgrounded, reloaded, or fully killed while the
 * user is on the payment page in an external browser.
 *
 * Usage:
 * - Call `startVerification(planId)` right before opening payment_url.
 * - Render <ProcessingPaymentModal visible={isVerifying} checkStatus={checkStatus} .../>
 * ONCE, at the app root (see PaymentVerificationWatcher below) —
 * not per-screen — so it resumes regardless of where the user
 * lands back in the app.
 */
function useSubscriptionVerificationState(): SubscriptionVerificationContextValue {
    const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
    const [pendingInitiatedAt, setPendingInitiatedAt] = useState<number | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const { refetch } = useActiveSubscription({ enabled: false });
    const appState = useRef(AppState.currentState);

    const readPending = useCallback(async () => {
        const raw = await AsyncStorage.getItem(PENDING_SUBSCRIPTION_KEY);
        if (!raw) return null;

        return JSON.parse(raw) as PendingSubscription;
    }, []);

    const clearVerification = useCallback(async () => {
        logDebug("Clearing pending verification state from AsyncStorage and React state.");
        await AsyncStorage.removeItem(PENDING_SUBSCRIPTION_KEY);
        setPendingPlanId(null);
        setPendingInitiatedAt(null);
    }, []);

    const loadPending = useCallback(async () => {
        logDebug("Loading pending subscription state from AsyncStorage...");
        try {
            const parsed = await readPending();
            if (parsed) {
                if (Date.now() - parsed.initiatedAt > MAX_PENDING_AGE_MS) {
                    logDebug("Pending subscription is too old; clearing", parsed);
                    await clearVerification();
                    return;
                }

                logDebug("Found pending subscription record:", parsed);
                setPendingPlanId(parsed.planId);
                setPendingInitiatedAt(parsed.initiatedAt);
            } else {
                logDebug("No pending subscription record found.");
                setPendingPlanId(null);
                setPendingInitiatedAt(null);
            }
        } catch (error) {
            logDebug("Corrupt/unreadable storage — resetting to null.", error);
            // Corrupt/unreadable storage — treat as "nothing pending"
            // rather than blocking the user with a stuck modal.
            setPendingPlanId(null);
        } finally {
            setHasLoaded(true);
        }
    }, [clearVerification, readPending]);

    // Covers: cold start / fresh mount after returning from the
    // payment browser (app was killed and relaunched).
    useEffect(() => {
        logDebug("Hook mounted (Cold Start / Fresh Mount). Initializing setup...");
        loadPending();
    }, [loadPending]);

    // Covers: app was only backgrounded (JS context survived) —
    // re-check the moment it comes back to the foreground.
    useEffect(() => {
        const sub = AppState.addEventListener(
            "change",
            (nextState: AppStateStatus) => {
                logDebug(`AppState changing: ${appState.current} -> ${nextState}`);
                if (
                    appState.current.match(/inactive|background/) &&
                    nextState === "active"
                ) {
                    logDebug("App returned to foreground. Re-checking verification state.");
                    loadPending();
                }
                appState.current = nextState;
            }
        );
        return () => {
            logDebug("Cleaning up AppState event listener.");
            sub.remove();
        };
    }, [loadPending]);

    const startVerification = useCallback(async (planId: string) => {
        logDebug(`Starting verification tracker for planId: ${planId}`);
        const payload: PendingSubscription = { planId, initiatedAt: Date.now() };
        await AsyncStorage.setItem(PENDING_SUBSCRIPTION_KEY, JSON.stringify(payload));
        setPendingPlanId(planId);
        setPendingInitiatedAt(payload.initiatedAt);
        trackEvent("subscription_payment_started", { plan_id: planId });
    }, []);

    const checkStatus = useCallback(async () => {
        const storedPending = pendingPlanId ? null : await readPending();
        const activePlanId = pendingPlanId || storedPending?.planId || null;
        const activeInitiatedAt = pendingInitiatedAt || storedPending?.initiatedAt || null;

        if (!activePlanId) {
            logDebug("checkStatus called, but no pendingPlanId is present. Skipping API call.");
            return false;
        }

        if (activeInitiatedAt && Date.now() - activeInitiatedAt > MAX_PENDING_AGE_MS) {
            await clearVerification();
            trackEvent("subscription_verification_timeout", {
                plan_id: activePlanId,
                reason: "expired_pending_record",
            });
            return false;
        }

        logDebug(`Checking payment verification status against API for planId: ${activePlanId}...`);
        try {
            const { data } = await refetch();
            logDebug("API refetch complete. Response data:", data);

            const isVerified = !!data && data.status === "active" && data.plan_id === activePlanId;
            logDebug(`Verification match result: ${isVerified}`);
            if (isVerified) {
                trackEvent("subscription_verified", { plan_id: activePlanId });
            }

            return isVerified;
        } catch (error) {
            logDebug("API refetch failed during checkStatus execution:", error);
            return false;
        }
    }, [
        clearVerification,
        pendingInitiatedAt,
        pendingPlanId,
        readPending,
        refetch,
    ]);

    const isVerifying = hasLoaded && !!pendingPlanId;
    logDebug(`Current state eval -> hasLoaded: ${hasLoaded}, pendingPlanId: ${pendingPlanId}, isVerifying: ${isVerifying}`);

    return useMemo(() => ({
        // `hasLoaded` prevents a one-frame flash of visible=true before
        // the initial AsyncStorage read resolves.
        isVerifying,
        pendingPlanId,
        startVerification,
        clearVerification,
        checkStatus,
    }), [checkStatus, clearVerification, isVerifying, pendingPlanId, startVerification]);
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
