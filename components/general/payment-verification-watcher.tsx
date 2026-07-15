import React from "react";
import { clearSubscriptionReminderState } from "../../hooks/subscription-reminder-storage";
import { resetSubscriptionPromptSessionState } from "../../hooks/use-subscription-prompt";
import { useSubscriptionVerificationContext } from "../../hooks/verify-sub";
import { trackEvent } from "../../lib/analytics";
import { ProcessingPaymentModal } from "./process-payment-modal";


/**
 * Mounted once at the app root (see special-modal-context.tsx). Reads
 * pending-verification state from AsyncStorage, so it resumes the
 * "confirming payment" modal automatically no matter which screen the
 * user is on when they return from Paystack — including after the
 * app was fully killed and relaunched.
 *
 * Individual screens/modals never render ProcessingPaymentModal
 * themselves anymore — they just call `startVerification(planId)`
 * right before opening the payment URL, and this takes it from there.
 */
export function PaymentVerificationWatcher() {
    const { isVerifying, checkStatus, clearVerification } =
        useSubscriptionVerificationContext();

    const handleConfirmed = async () => {
        await clearVerification();
        await clearSubscriptionReminderState();
        resetSubscriptionPromptSessionState();
    };

    const handleDismiss = async () => {
        trackEvent("subscription_verification_timeout");
        await clearVerification();
    };

    return (
        <ProcessingPaymentModal
            visible={isVerifying}
            checkStatus={checkStatus}
            onConfirmed={handleConfirmed}
            onDismiss={handleDismiss}
        />
    );
}
