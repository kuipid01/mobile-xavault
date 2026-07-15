import React, { useCallback } from "react";
import { UserSubscription } from "../api/subscription";
import SubscriptionModal from "../components/modals/subsciption-moal";
import { useModal } from "../context/special-modal-context";
import { trackEvent } from "../lib/analytics";
import { useActiveSubscription } from "./app/subscription";
import {
  clearSubscriptionReminderState,
  getSubscriptionReminderState,
  recordSubscriptionPromptShown,
  recordSubscriptionPromptSkipped,
  shouldShowSubscriptionPrompt,
  SubscriptionPromptTrigger,
} from "./subscription-reminder-storage";
import { useSubscriptionVerificationContext } from "./verify-sub";

type MaybeShowPromptOptions = {
  isSensitiveFlow?: boolean;
};

let hasShownPromptThisSession = false;

export function resetSubscriptionPromptSessionState() {
  hasShownPromptThisSession = false;
}

const DEBUG = true;

const logPrompt = (...args: unknown[]) => {
  if (DEBUG) console.log("[SubscriptionPrompt]", ...args);
};

const isPaidActiveSubscription = (subscription?: UserSubscription | null) => {
  return (
    subscription?.status === "active" &&
    subscription?.plan?.Code !== "free" &&
    subscription?.plan_id !== "free"
  );
};

export function useSubscriptionPrompt() {
  const { isOpen, openModal } = useModal();
  const { isVerifying } = useSubscriptionVerificationContext();
  const { refetch } = useActiveSubscription({ enabled: false });

  const maybeShowSubscriptionPrompt = useCallback(
    async (
      trigger: SubscriptionPromptTrigger,
      options: MaybeShowPromptOptions = {}
    ): Promise<boolean> => {
      logPrompt("Checking prompt eligibility", { trigger, options });

      let activeSubscription: UserSubscription | undefined;

      try {
        const result = await refetch();
        activeSubscription = result.data;
      } catch (error) {
        logPrompt("Active subscription check failed; skipping prompt", error);
        return false;
      }

      const state = await getSubscriptionReminderState();
      const decision = shouldShowSubscriptionPrompt({
        trigger,
        state,
        now: Date.now(),
        isSubscribed: isPaidActiveSubscription(activeSubscription),
        isModalOpen: isOpen,
        isPaymentVerificationActive: isVerifying,
        hasShownThisSession: hasShownPromptThisSession,
        isSensitiveFlow: options.isSensitiveFlow,
      });

      if (!decision.allowed) {
        trackEvent("subscription_prompt_suppressed", {
          reason: decision.reason,
          trigger,
        });
        logPrompt("Prompt skipped", {
          trigger,
          reason: decision.reason,
          suppressUntil: decision.suppressUntil,
          nextAllowedAt: decision.nextAllowedAt,
          state,
        });
        return false;
      }

      await recordSubscriptionPromptShown(trigger);
      trackEvent("subscription_prompt_shown", {
        reason: decision.reason,
        trigger,
      });
      if (trigger !== "manual_upgrade_button") {
        hasShownPromptThisSession = true;
      }

      openModal(
        <SubscriptionModal
          title={getPromptTitle(trigger)}
          subtitle={getPromptSubtitle(trigger)}
          onSkip={async () => {
            const skipped = await recordSubscriptionPromptSkipped();
            trackEvent("subscription_prompt_skipped", {
              skip_count: skipped.skipCount,
              suppress_until: skipped.suppressUntil,
              trigger,
            });
            logPrompt("Prompt skipped by user", { trigger, ...skipped });
          }}
          onUpgradeStarted={() => {
            logPrompt("Upgrade payment started; reminder state unchanged", {
              trigger,
            });
          }}
          onSubscribed={async () => {
            await clearSubscriptionReminderState();
            resetSubscriptionPromptSessionState();
            trackEvent("subscription_verified", { trigger });
            logPrompt("Subscription confirmed; reminder state cleared", {
              trigger,
            });
          }}
        />,
        {
          onDismiss: async () => {
            const skipped = await recordSubscriptionPromptSkipped();
            trackEvent("subscription_prompt_skipped", {
              skip_count: skipped.skipCount,
              suppress_until: skipped.suppressUntil,
              trigger,
            });
            logPrompt("Prompt dismissed", { trigger, ...skipped });
          },
        }
      );

      logPrompt("Prompt shown", { trigger, reason: decision.reason });
      return true;
    },
    [isOpen, isVerifying, openModal, refetch]
  );

  return {
    maybeShowSubscriptionPrompt,
    clearSubscriptionReminderState,
  };
}

function getPromptTitle(trigger: SubscriptionPromptTrigger) {
  switch (trigger) {
    case "feature_limit_reached":
      return "You are close to your free limits";
    case "premium_feature_click":
      return "Unlock this with a paid plan";
    case "wallet_action":
      return "Make more room for your money plans";
    case "salary_plan_created":
      return "Automate more of your salary";
    case "subscription_expired":
      return "Your subscription has ended";
    case "manual_upgrade_button":
      return "Choose the plan that fits you";
    case "app_open":
      return "Get more from XAVAULT";
  }
}

function getPromptSubtitle(trigger: SubscriptionPromptTrigger) {
  switch (trigger) {
    case "feature_limit_reached":
      return "Upgrade when you are ready to add more locked plans, envelopes, and smarter controls.";
    case "premium_feature_click":
      return "Paid plans add salary split, analytics, shared envelopes, and higher limits.";
    case "wallet_action":
      return "A paid plan gives you higher monthly movement limits and more ways to organize funds.";
    case "salary_plan_created":
      return "Upgrade to split salary automatically and keep more goals running at once.";
    case "subscription_expired":
      return "Renew to keep your paid limits, analytics, and automation active.";
    case "manual_upgrade_button":
      return "Compare the available plans and pick the one that matches how you save.";
    case "app_open":
      return "More locked plans, envelopes, analytics, and salary tools are available when you need them.";
  }
}
