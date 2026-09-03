#!/usr/bin/env bash
# Simulate a Paystack webhook exactly as Paystack would send it (HMAC-SHA512
# over the raw body with PAYSTACK_SECRET_KEY, X-Paystack-Signature header).
# Usage:
#   webhook-sim.sh deposit-success REFERENCE [amount_kobo]
#   webhook-sim.sh subscription-success REFERENCE
#   webhook-sim.sh transfer-success REFERENCE
#   webhook-sim.sh transfer-failed REFERENCE [reason]
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

event="${1:-}"; ref="${2:-}"
[ -n "$event" ] && [ -n "$ref" ] || { echo "usage: webhook-sim.sh <event> <reference> [amount|reason]" >&2; exit 2; }

case "$event" in
  deposit-success)
    amount="${3:-$(psqlq "SELECT amount FROM wallet_deposits WHERE reference='$ref'")}"
    data="{\"id\":1,\"amount\":${amount},\"reference\":\"${ref}\",\"status\":\"success\",\"currency\":\"NGN\",\"customer\":{\"email\":\"qa@xavault.app\"},\"dedicated_account\":{\"account_number\":\"\"},\"metadata\":{\"is_subscription\":false,\"plan_id\":\"\",\"user_id\":\"\"}}"
    evt="charge.success"
    ;;
  subscription-success)
    # read the pending/canceled subscription row to rebuild metadata + price
    read -r user_id plan_id amount < <(psqlq "SELECT us.user_id::text, us.plan_id::text, sp.price_kobo FROM user_subscriptions us JOIN subscription_plans sp ON sp.id = us.plan_id WHERE us.payment_reference='$ref' LIMIT 1")
    data="{\"id\":1,\"amount\":${amount},\"reference\":\"${ref}\",\"status\":\"success\",\"currency\":\"NGN\",\"customer\":{\"email\":\"qa@xavault.app\"},\"dedicated_account\":{\"account_number\":\"\"},\"metadata\":{\"is_subscription\":true,\"plan_id\":\"${plan_id}\",\"user_id\":\"${user_id}\"}}"
    evt="charge.success"
    ;;
  transfer-success)
    amount="${3:-$(psqlq "SELECT amount FROM withdrawals WHERE reference='$ref' OR provider_reference='$ref' LIMIT 1")}"
    data="{\"id\":1,\"reference\":\"${ref}\",\"status\":\"success\",\"reason\":\"\",\"transfer_code\":\"TRF_${ref}\",\"amount\":${amount},\"currency\":\"NGN\"}"
    evt="transfer.success"
    ;;
  transfer-failed)
    amount="${3:-$(psqlq "SELECT amount FROM withdrawals WHERE reference='$ref' OR provider_reference='$ref' LIMIT 1")}"
    reason="${3:-transfer failed}"
    data="{\"id\":1,\"reference\":\"${ref}\",\"status\":\"failed\",\"reason\":\"${reason}\",\"transfer_code\":\"TRF_${ref}\",\"amount\":${amount},\"currency\":\"NGN\"}"
    evt="transfer.failed"
    ;;
  *)
    echo "unknown event: $event" >&2; exit 2 ;;
esac

payload="{\"event\":\"${evt}\",\"data\":${data}}"
sig="$(printf '%s' "$payload" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" -hex | awk '{print $2}')"

step "POST $evt → $API_BASE/webhooks/paystack (ref=$ref)"
resp="$(curl -s -o /tmp/webhook-sim-$$.out -w '%{http_code}' \
  -X POST "$API_BASE/webhooks/paystack" \
  -H 'Content-Type: application/json' \
  -H "X-Paystack-Signature: $sig" \
  -d "$payload")"
cat /tmp/webhook-sim-$$.out; rm -f /tmp/webhook-sim-$$.out
echo
[ "$resp" = "200" ] || { fail "webhook rejected (HTTP $resp)"; exit 1; }
pass "webhook accepted"
