#!/usr/bin/env bash
# End-to-end suite: drives the app with Maestro, simulates provider events and
# asserts DB state — mirroring docs/qa-test-workflow.md suites C/E/H/J.
#
# Requirements: backend + DB up (docker), simulator with the app installed,
# seeded QA account (see common.sh), Maestro on PATH.
#
#   bash maestro/scripts/run-suite.sh            # everything
#   bash maestro/scripts/run-suite.sh deposit    # one scenario
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
db() { bash "$SCRIPT_DIR/db-assert.sh" "$@"; }
sim() { bash "$SCRIPT_DIR/webhook-sim.sh" "$@"; }

export APP_ID="${APP_ID:-host.exp.Exponent}"
if [ "${SKIP_MAESTRO:-0}" != "1" ] && ! command -v maestro >/dev/null 2>&1; then
  echo "maestro not found (see README)" >&2
  exit 2
fi

# ── helpers ─────────────────────────────────────────────────────────────────
m() { step "MAESTRO $1"; maestro_run "$1"; }

run_deposit() {
  m 10_deposit_cancel.yaml
  ref="$(db latest-deposit)"
  step "Assert deposit $ref → dismissed (J1)"
  db assert-deposit "$ref" dismissed

  m 11_deposit_complete.yaml                       # initiate & pause at Ready to pay
  ref="$(db latest-deposit)"
  step "Simulate charge.success for deposit $ref (C8)"
  sim deposit-success "$ref"
  db assert-deposit "$ref" success
  db assert-ledger-count "$ref" 1
  m 12_deposit_verify.yaml
}

run_subscription() {
  m 20_subscription_cancel.yaml
  ref="$(db latest-subscription)"
  step "Assert subscription $ref → canceled (J4)"
  db assert-sub "$ref" canceled

  m 21_subscription_activate.yaml                  # initiate + cancel again
  ref="$(db latest-subscription)"
  step "Simulate charge.success for canceled subscription $ref (J5)"
  sim subscription-success "$ref"
  db assert-sub "$ref" active
}

run_withdrawal() {
  m 30_withdrawal_wizard.yaml
  ref="$(db latest-withdrawal)"
  step "Simulate transfer.success for $ref then assert paid (E9)"
  sim transfer-success "$ref"
  db assert-withdrawal "$ref" paid
  db assert-ledger-count "$ref" 1
  m 31_withdrawal_verify.yaml
}

run_plans()     { m 40_plan_draft_crud.yaml; }
run_envelopes() { m 50_envelope_crud.yaml; }

run_ttl() {
  # J3/J7: backdate rows past their TTLs and let the reconciliation worker
  # expire them (worker interval is 5 min; wait below, or trigger the worker).
  ref="$(db latest-deposit)"
  step "Backdate deposit $ref past the 24h TTL (J3)"
  db backdate-deposit "$ref" "25 hours"
  refw="$(db latest-withdrawal)"
  step "Backdate withdrawal $refw past the 48h TTL (J7)"
  db backdate-withdrawal "$refw" "49 hours"
  echo "Waiting for the reconciliation worker… (interval is 5 min)"
  sleep 320
  db assert-deposit "$ref" expired
  db assert-withdrawal "$refw" failed
}

# ── dispatch ────────────────────────────────────────────────────────────────
case "${1:-all}" in
  all)          run_deposit; run_subscription; run_withdrawal; run_plans; run_envelopes ;;
  deposit)      run_deposit ;;
  subscription) run_subscription ;;
  withdrawal)   run_withdrawal ;;
  plans)        run_plans ;;
  envelopes)    run_envelopes ;;
  ttl)          run_ttl ;;
  *)            echo "unknown scenario: ${1:-} (all|deposit|subscription|withdrawal|plans|envelopes|ttl)" >&2; exit 2 ;;
esac

step "Suite '${1:-all}' finished"
