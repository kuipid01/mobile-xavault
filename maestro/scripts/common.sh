#!/usr/bin/env bash
# Shared environment + DB helpers for the Maestro suite.
set -euo pipefail

# --- Paths ------------------------------------------------------------------
MAESTRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$(cd "$MAESTRO_DIR/.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-/Users/mac/dev/kui/xavault}"

# --- API --------------------------------------------------------------------
API_BASE="${API_BASE:-http://localhost:8080/api/v1}"

# --- Backend env (PAYSTACK_SECRET_KEY for webhook HMAC, DB creds) -----------
if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$BACKEND_DIR/.env"
  set +a
fi

DB_CONTAINER="${DB_CONTAINER:-salary_vault_postgres}"
DB_USER="${DB_USER:-salary_vault}"
DB_NAME="${DB_NAME:-salary_vault}"

psqlq() { # psqlq "SQL" → single value, no header
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1"
}
psql_e() { # psql_e "SQL" → full result set
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# --- Seeded QA data (TUNE to your QA account) -------------------------------
# These names are referenced by the tier-2 flows. Keep in sync with whatever
# you create/register for the QA user.
QA_EMAIL="${QA_EMAIL:-qa@example.com}"
QA_PASSWORD="${QA_PASSWORD:-ChangeMe123!}"
QA_PLAN_NAME="${QA_PLAN_NAME:-QA Test Plan}"
QA_SOURCE_LABEL="${QA_SOURCE_LABEL:-Plan balance}"
QA_DESTINATION_NAME="${QA_DESTINATION_NAME:-QA Bank Account}"
QA_WITHDRAW_PIN="${QA_WITHDRAW_PIN:-1234}"
QA_WITHDRAW_AMOUNT="${QA_WITHDRAW_AMOUNT:-5000}"
QA_ENVELOPE_NAME="${QA_ENVELOPE_NAME:-QA Envelope}"
QA_ENVELOPE_AMOUNT="${QA_ENVELOPE_AMOUNT:-2000}"
# TUNE: input hints/placeholders in the current wizard UIs
QA_AMOUNT_HINT="${QA_AMOUNT_HINT:-0}"
QA_PIN_HINT="${QA_PIN_HINT:-Enter PIN}"
QA_PLAN_NAME_INPUT="${QA_PLAN_NAME_INPUT:-Plan name}"
QA_PLAN_AMOUNT_INPUT="${QA_PLAN_AMOUNT_INPUT:-0}"
QA_ENVELOPE_NAME_INPUT="${QA_ENVELOPE_NAME_INPUT:-Envelope name}"
QA_ENVELOPE_AMOUNT_INPUT="${QA_ENVELOPE_AMOUNT_INPUT:-0}"

# --- Logging ----------------------------------------------------------------
step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
pass() { printf '\033[1;32mPASS\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31mFAIL\033[0m %s\n' "$*"; }

maestro_run() { # maestro_run flow.yaml
  (cd "$MAESTRO_DIR" && maestro test \
    --env APP_ID="${APP_ID:-host.exp.Exponent}" \
    --env QA_EMAIL="$QA_EMAIL" \
    --env QA_PASSWORD="$QA_PASSWORD" \
    --env QA_PLAN_NAME="$QA_PLAN_NAME" \
    --env QA_SOURCE_LABEL="$QA_SOURCE_LABEL" \
    --env QA_DESTINATION_NAME="$QA_DESTINATION_NAME" \
    --env QA_WITHDRAW_AMOUNT="$QA_WITHDRAW_AMOUNT" \
    --env QA_AMOUNT_HINT="$QA_AMOUNT_HINT" \
    --env QA_PIN_HINT="$QA_PIN_HINT" \
    --env QA_WITHDRAW_PIN="$QA_WITHDRAW_PIN" \
    --env QA_ENVELOPE_NAME="$QA_ENVELOPE_NAME" \
    --env QA_ENVELOPE_AMOUNT="$QA_ENVELOPE_AMOUNT" \
    --env QA_PLAN_NAME_INPUT="$QA_PLAN_NAME_INPUT" \
    --env QA_PLAN_AMOUNT_INPUT="$QA_PLAN_AMOUNT_INPUT" \
    --env QA_ENVELOPE_NAME_INPUT="$QA_ENVELOPE_NAME_INPUT" \
    --env QA_ENVELOPE_AMOUNT_INPUT="$QA_ENVELOPE_AMOUNT_INPUT" \
    "flows/$1")
}
