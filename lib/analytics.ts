import Constants from "expo-constants";
import { Platform } from "react-native";

type AnalyticsEventName =
  | "home_viewed"
  | "transactions_opened"
  | "transaction_detail_opened"
  | "vault_health_viewed"
  | "plan_milestone_seen"
  | "deposit_opened"
  | "deposit_started"
  | "deposit_checkout_opened"
  | "deposit_verified"
  | "deposit_still_processing"
  | "deposit_failed"
  | "deposit_abandoned"
  | "deposit_transfer_refresh"
  | "withdrawal_opened"
  | "withdrawal_source_selected"
  | "withdrawal_destination_selected"
  | "withdrawal_reviewed"
  | "withdrawal_pin_entered"
  | "withdrawal_completed"
  | "withdrawal_failed"
  | "withdrawal_abandoned"
  | "subscription_prompt_shown"
  | "subscription_prompt_skipped"
  | "subscription_payment_started"
  | "subscription_verified"
  | "subscription_verification_timeout"
  | "subscription_prompt_suppressed";

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const DEBUG_ANALYTICS = true;

const appVersion =
  Constants.expoConfig?.version ||
  Constants.manifest2?.extra?.expoClient?.version ||
  "unknown";

export function trackEvent(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {}
) {
  if (!DEBUG_ANALYTICS) return;

  console.log("[Analytics]", name, {
    ...properties,
    app_version: appVersion,
    platform: Platform.OS,
    timestamp: new Date().toISOString(),
  });
}
