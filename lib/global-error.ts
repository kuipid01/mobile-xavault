export type GlobalErrorPayload = {
  title: string;
  message: string;
  supportReference?: string;
};

type GlobalErrorListener = (payload: GlobalErrorPayload) => void;

let listener: GlobalErrorListener | null = null;

export const registerGlobalErrorListener = (next: GlobalErrorListener) => {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
};

// Every error shows by default — the user must get feedback on every attempt
// (a wrong password pressed twice shows the modal twice). Suppression is
// OPT-IN per request via `suppressGlobalErrorModal` on the axios config, for
// sources whose failures are noise (pollers, fire-and-forget revokes,
// locally-handled checks). While a modal is already open, the modal component
// itself ignores an identical re-publish so it can't visibly flicker.
export const publishGlobalError = (payload: GlobalErrorPayload) => {
  listener?.(payload);
};

export const apiErrorPayload = (error: any): GlobalErrorPayload => {
  const response = error?.response;
  const url = String(error?.config?.url || "");
  const financial = /wallet|deposit|withdraw|subscription|payment|bank-account/i.test(url);
  const timedOut =
    error?.code === "ECONNABORTED" ||
    /timeout/i.test(String(error?.message || ""));
  const offline = !response && !timedOut;
  const supportReference =
    response?.data?.support_reference ||
    response?.headers?.["x-support-reference"] ||
    response?.headers?.["X-Support-Reference"];

  return {
    title:
      financial && timedOut
        ? "Transaction status is uncertain"
        : offline
          ? "You appear to be offline"
          : financial
            ? "Transaction could not be completed"
            : "Something went wrong",
    message:
      response?.data?.message ||
      (financial && timedOut
        ? "The request timed out. Do not submit it again yet—we’ll verify its status from your transaction history."
        : offline
          ? "Check your connection. Your request was not confirmed."
          : response
            ? "Please review your information and try again."
            : "Check your connection and try again."),
    supportReference: supportReference ? String(supportReference) : undefined,
  };
};
