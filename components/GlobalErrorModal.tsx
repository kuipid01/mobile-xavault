import {
  GlobalErrorPayload,
  registerGlobalErrorListener,
} from "@/lib/global-error";
import { useEffect, useState } from "react";
import { ErrorModal } from "./ui/ErrorModal";

export function GlobalErrorModal() {
  const [error, setError] = useState<GlobalErrorPayload | null>(null);

  useEffect(() => {
    // Ignore a new publish that is identical to the error ALREADY on screen —
    // otherwise an open modal visibly "re-pops" (flickers) every time a
    // repeating poller re-produces the same failure.
    return registerGlobalErrorListener((payload) => {
      setError((prev) =>
        prev &&
        prev.title === payload.title &&
        prev.message === payload.message &&
        prev.supportReference === payload.supportReference
          ? prev
          : payload,
      );
    });
  }, []);

  return (
    <ErrorModal
      visible={error !== null}
      title={error?.title}
      message={error?.message || "Something went wrong."}
      supportReference={error?.supportReference}
      onClose={() => setError(null)}
    />
  );
}
