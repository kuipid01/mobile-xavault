import { GlobalErrorPayload, registerGlobalErrorListener } from "@/lib/global-error";
import { useEffect, useState } from "react";
import { ErrorModal } from "./ui/ErrorModal";

export function GlobalErrorModal() {
  const [error, setError] = useState<GlobalErrorPayload | null>(null);

  useEffect(() => registerGlobalErrorListener(setError), []);

  return (
    <ErrorModal
      visible={error !== null}
      title={error?.title}
      message={error?.message || "Something went wrong."}
      supportReference={undefined}
      onClose={() => setError(null)}
    />
  );
}
