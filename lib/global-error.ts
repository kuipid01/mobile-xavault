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

// Coalesce rapid-fire failures: when several requests fail at once (e.g. a
// 401 storm after a dead session, or a network blip hitting 5 screens in
// parallel), show ONE modal instead of stacking/re-popping endlessly.
const COALESCE_WINDOW_MS = 1500;

// A poller (e.g. the withdrawals 5s refetchInterval) can re-produce the SAME
// error forever. Suppressing identical payloads for a longer window is what
// makes the modal truly non-incessant; a NEW error always shows immediately.
const SAME_ERROR_SUPPRESS_MS = 60_000;

let lastPublishedAt = 0;
let lastPayloadKey: string | null = null;

const payloadKey = (payload: GlobalErrorPayload) =>
  `${payload.title}::${payload.message}`;

export const publishGlobalError = (payload: GlobalErrorPayload) => {
  const now = Date.now();
  const key = payloadKey(payload);

  if (
    key === lastPayloadKey &&
    now - lastPublishedAt < SAME_ERROR_SUPPRESS_MS
  ) {
    console.debug(
      "[GlobalError] suppressed repeating identical error:",
      payload.title,
    );
    return;
  }

  if (now - lastPublishedAt < COALESCE_WINDOW_MS) {
    console.debug(
      "[GlobalError] suppressed duplicate within coalesce window:",
      payload.title,
    );
    return;
  }

  lastPublishedAt = now;
  lastPayloadKey = key;
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
