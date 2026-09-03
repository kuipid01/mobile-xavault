#!/usr/bin/env bash
# DB state assertions + TTL backdating helpers for the cancellation suite.
# Usage:
#   db-assert.sh deposit-status REF        → prints status
#   db-assert.sh assert-deposit REF EXPECTED
#   db-assert.sh assert-sub REF EXPECTED
#   db-assert.sh assert-withdrawal REF EXPECTED
#   db-assert.sh assert-ledger-count REF EXPECTED
#   db-assert.sh backdate-deposit REF "25 hours"     → created_at = now()-interval
#   db-assert.sh backdate-withdrawal REF "49 hours"
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

cmd="${1:-}"; shift || true

deposit_ref_status() { psqlq "SELECT status FROM wallet_deposits WHERE reference='$1'"; }
sub_ref_status()     { psqlq "SELECT status FROM user_subscriptions WHERE payment_reference='$1'"; }
withdrawal_ref_status() { psqlq "SELECT status FROM withdrawals WHERE reference='$1' OR provider_reference='$1' ORDER BY created_at DESC LIMIT 1"; }

case "$cmd" in
  deposit-status)     deposit_ref_status "$1" ;;
  sub-status)         sub_ref_status "$1" ;;
  withdrawal-status)  withdrawal_ref_status "$1" ;;
  assert-deposit)
    actual="$(deposit_ref_status "$1")"; expected="$2"
    if [ "$actual" = "$expected" ]; then pass "deposit $1 → $expected"; else fail "deposit $1 → '$actual', want '$expected'"; exit 1; fi
    ;;
  assert-sub)
    actual="$(sub_ref_status "$1")"; expected="$2"
    if [ "$actual" = "$expected" ]; then pass "subscription $1 → $expected"; else fail "subscription $1 → '$actual', want '$expected'"; exit 1; fi
    ;;
  assert-withdrawal)
    actual="$(withdrawal_ref_status "$1")"; expected="$2"
    if [ "$actual" = "$expected" ]; then pass "withdrawal $1 → $expected"; else fail "withdrawal $1 → '$actual', want '$expected'"; exit 1; fi
    ;;
  assert-ledger-count)
    n="$(psqlq "SELECT COUNT(*) FROM wallet_ledgers WHERE reference='$1'")"
    if [ "$n" = "$2" ]; then pass "ledger '$1' entries = $2"; else fail "ledger '$1' entries = $n, want $2"; exit 1; fi
    ;;
  backdate-deposit)
    psql_e "UPDATE wallet_deposits SET created_at = now() - interval '$2' WHERE reference='$1'" >/dev/null
    pass "backdated deposit $1 by $2"
    ;;
  backdate-withdrawal)
    psql_e "UPDATE withdrawals SET created_at = now() - interval '$2' WHERE reference='$1'" >/dev/null
    pass "backdated withdrawal $1 by $2"
    ;;
  latest-deposit)
    # newest deposit reference created in the last 5 minutes (used to grab the
    # row the previous Maestro flow just initiated)
    psqlq "SELECT reference FROM wallet_deposits WHERE created_at > now() - interval '5 minutes' ORDER BY created_at DESC LIMIT 1"
    ;;
  latest-subscription)
    psqlq "SELECT payment_reference FROM user_subscriptions WHERE created_at > now() - interval '5 minutes' ORDER BY created_at DESC LIMIT 1"
    ;;
  latest-withdrawal)
    psqlq "SELECT reference FROM withdrawals WHERE created_at > now() - interval '5 minutes' ORDER BY created_at DESC LIMIT 1"
    ;;
  *)
    echo "unknown cmd: $cmd" >&2; exit 2 ;;
esac
