import { PaystackWebView, isCancelledRedirect } from "./paystack-webview";
import { useDepositVerificationContext } from "@/hooks/verify-deposit";
import { useCallback } from "react";

// Deposit-specific policy on top of the shared Paystack checkout WebView:
// close the deposit checkout state, then verify the pending deposit (bounded)
// unless a terminal redirect already handled it. A customer cancel just
// returns to the payment prompt — the pending deposit stays intact.
export function PaystackCheckoutLayer() {
  const {
    checkoutUrl,
    closeCheckout,
    verifyPendingDeposit,
  } = useDepositVerificationContext();

  const handleTerminalRedirect = useCallback(
    (url: string) => {
      closeCheckout();
      if (isCancelledRedirect(url)) return;
      // Success callback (payment completed) or the close sentinel (e.g. a
      // 3DS flow just ended): close the checkout and let the backend decide
      // whether the payment went through.
      void verifyPendingDeposit({ bounded: true });
    },
    [closeCheckout, verifyPendingDeposit]
  );

  const handleClose = useCallback(
    ({ terminalHandled }: { terminalHandled: boolean }) => {
      closeCheckout();
      if (!terminalHandled) {
        // Manual close (X button / Android back): the AppState listener only
        // fires on background→active transitions, so a user who pays and
        // closes the checkout without leaving the app would otherwise sit on
        // "Payment not confirmed" forever. Verify on close unless a terminal
        // redirect already did.
        void verifyPendingDeposit({ bounded: true });
      }
    },
    [closeCheckout, verifyPendingDeposit]
  );

  if (!checkoutUrl) return null;

  return (
    <PaystackWebView
      checkoutUrl={checkoutUrl}
      onClose={handleClose}
      onTerminalRedirect={handleTerminalRedirect}
    />
  );
}
