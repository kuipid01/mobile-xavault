import SubscriptionModal from "@/components/modals/subsciption-moal";
import { useModal } from "@/context/special-modal-context";
import { trackEvent } from "@/lib/analytics";
import { AxiosError } from "axios";
import { useCallback } from "react";

type LimitContext = "plan_create" | "plan_confirm" | "envelope_create" | "deposit";

type ApiErrorBody = {
  message?: string;
  error?: unknown;
};

type LimitModalOptions = {
  requiredVaultCapacityKobo?: number;
};

const limitCopy: Record<
  LimitContext,
  { title: string; subtitle: string; losses: string[] }
> = {
  plan_create: {
    title: "This plan will stay blocked",
    subtitle:
      "Your current subscription has no more plan slots. Upgrade to keep building this goal.",
    losses: [
      "You cannot create another spending plan right now.",
      "Any goal you planned to separate will stay mixed with wallet balance.",
      "You may need to cancel an existing plan or upgrade.",
    ],
  },
  plan_confirm: {
    title: "This funding amount is over your limit",
    subtitle:
      "Your current plan cannot lock this much money this month. Upgrade to continue funding without lowering the amount.",
    losses: [
      "This plan cannot be funded at the current amount.",
      "The money will remain spendable in your wallet.",
      "You will need to reduce the plan amount or wait until your limit resets.",
    ],
  },
  envelope_create: {
    title: "This envelope will stay blocked",
    subtitle:
      "This plan has reached the envelope limit for your subscription. Upgrade to keep separating this money.",
    losses: [
      "You cannot add another envelope to this plan right now.",
      "That category will stay untracked inside the wider plan.",
      "You may need to reuse an existing envelope or upgrade.",
    ],
  },
  deposit: {
    title: "Maximum transaction volume exceeded",
    subtitle:
      "This deposit is above what your current plan can hold. Upgrade to the fitting plan, or reduce the deposit amount.",
    losses: [
      "This deposit cannot enter your vault on the current plan.",
      "The money stays outside Xavault until you reduce the amount or upgrade.",
      "The suggested plan is the first tier that can fit this vault balance.",
    ],
  },
};

const errorText = (error: unknown) => {
  const axiosError = error as AxiosError<ApiErrorBody>;
  const body = axiosError.response?.data;
  return [
    body?.message,
    typeof body?.error === "string" ? body.error : undefined,
    error instanceof Error ? error.message : undefined,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export function isSubscriptionLimitError(error: unknown) {
  const axiosError = error as AxiosError<ApiErrorBody>;
  const status = axiosError.response?.status;
  const text = errorText(error);

  return (
    status === 403 &&
    (text.includes("subscription") ||
      text.includes("plan limit") ||
      text.includes("monthly plan volume limit") ||
      text.includes("monthly deposit limit") ||
      text.includes("maximum vault capacity"))
  );
}

export function useSubscriptionLimitModal() {
  const { openModal } = useModal();

  const showSubscriptionLimitModal = useCallback(
    (context: LimitContext, error?: unknown, options: LimitModalOptions = {}) => {
      if (error && !isSubscriptionLimitError(error)) {
        return false;
      }

      const copy = limitCopy[context];
      trackEvent("subscription_prompt_shown", {
        trigger: "feature_limit_reached",
        reason: context,
      });

      openModal(
        <SubscriptionModal
          title={copy.title}
          subtitle={copy.subtitle}
          variant="limit"
          blockedLosses={copy.losses}
          requiredVaultCapacityKobo={options.requiredVaultCapacityKobo}
          dismissLabel={context === "deposit" ? "Reduce amount" : undefined}
          onUpgradeStarted={() => {
            trackEvent("subscription_payment_started", { trigger: context });
          }}
        />
      );

      return true;
    },
    [openModal]
  );

  return { showSubscriptionLimitModal };
}
