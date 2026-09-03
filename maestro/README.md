# Maestro E2E Suite (xacvault)

Automated end-to-end flows for the mobile app, converted from `docs/qa-test-workflow.md`.
Covers: **deposits (card), withdrawals, plans, envelopes, subscriptions** and the
**cancellation regression suite** (dismiss must stop all polling, in DB and in logs).

## How the suite is split

Money flows in this app have two halves:

1. **UI half (Maestro)** — tap through the real screens, initiate payments, press
   "Cancel payment", confirm dialogs, check the transaction receipt.
2. **Provider half (scripts)** — Paystack checkout/transfers cannot be reliably driven by
   Maestro (in-app browser + OTP), so provider outcomes are **simulated** by posting a
   correctly-HMAC-signed webhook (`scripts/webhook-sim.sh`) to the running API, exactly as
   Paystack would. Rows are inspected with `scripts/db-assert.sh` (psql into the docker DB).

The full sequence for a scenario is:

```
maestro test flow_that_initiates   →   scripts/simulate the provider event   →   maestro test flow_that_verifies
```

`scripts/run-suite.sh` wires these together end-to-end.

## Prerequisites

| Thing | How |
|---|---|
| Backend + DB running | `cd /Users/mac/dev/kui/xavault && docker compose up -d && make migrate-up && make run` (API on `:8080`, Paystack **test** keys in backend `.env`). |
| App on a simulator/device | `cd /Users/mac/dev/xavmo && npm start`; install **Expo Go** or a dev build. `EXPO_PUBLIC_API_URL` must reach the API from the device. |
| Maestro | `curl -Ls "https://get.maestro.mobile.dev" | bash` — then `maestro --version`. |
| Seeded QA user | An account with: an **active subscription**, **available balance > 0**, an **active funded plan** with at least one envelope, a **withdrawal PIN** and a **bank destination**. See `scripts/db-assert.sh --seed-qa` help; otherwise create via the app UI once and reuse the session. |

## Running

```bash
cd /Users/mac/dev/xavmo/maestro

# 1) env
export APP_ID="host.exp.Exponent"            # Expo Go
# export APP_ID="com.kuipid.xacvault"        # dev build
export QA_EMAIL="qa@example.com"
export QA_PASSWORD="..."

# 2) single flow (after logging in once via 00_bootstrap)
maestro test --env APP_ID="$APP_ID" --env QA_EMAIL="$QA_EMAIL" --env QA_PASSWORD="$QA_PASSWORD" flows/

# 3) or the orchestrated suite (initiates → simulates provider → asserts DB)
bash scripts/run-suite.sh
```

## Flow index

| Flow | Covers | Tier |
|---|---|---|
| `flows/00_bootstrap_login.yaml` | launch + conditional login | — |
| `flows/10_deposit_cancel.yaml` | initiate card deposit → **Cancel payment** regression (J1/J2) | 1 (run-ready) |
| `flows/11_deposit_complete.yaml` | initiate deposit, then provider success is simulated by script; asserts receipt state | 2 |
| `flows/20_subscription_cancel.yaml` | upgrade → **Cancel payment** regression (J4) | 1 |
| `flows/21_subscription_activate.yaml` | subscription initiation + simulated activation (J5) | 2 |
| `flows/30_withdrawal.yaml` | 6-step withdrawal wizard; cancel attempt on already-processing row (E12) | 2 |
| `flows/40_plan_draft_crud.yaml` | plan draft create/cancel | 2 |
| `flows/50_envelope_crud.yaml` | envelope create on an active plan | 2 |

**Tier 1** flows are deterministic against a seeded account.
**Tier 2** flows navigate multi-step wizards; the structure is correct but row labels
(the exact plan/envelope/bank names to tap) must be set to your seeded data — each has a
`# TUNE:` comment. Keep seeded data names in `scripts/common.sh` (`QA_PLAN_NAME` etc.) so the
flows can reference them.

## What is intentionally NOT automated

- Paystack card checkout + OTP, bank-transfer inbound money, and real transfers.
  These are provider-owned UI; outcomes are simulated via webhooks instead (see above),
  which is what the backend itself trusts in production.
- Biometrics and OS permission dialogs (do once manually).

## Troubleshooting

- `Sign In` never appears on launch: your simulator still has a session; run
  `maestro test flows/00_bootstrap_login.yaml --env ...` — it skips login when already in.
- Text not found on a wizard step: it changed copy — update the flow, or switch the element to a
  `testID` (core money CTAs already have stable ids: `deposit-submit`, `deposit-cancel`,
  `deposit-primary`, `deposit-check-again`, `subscription-cancel`, `subscription-primary`,
  `subscription-check-again`, `withdraw-cta`, `upgrade-primary-cta`, `cancel-withdrawal`).
- Webhook sim returns 400 "Invalid signature": backend `.env` `PAYSTACK_SECRET_KEY` differs from
  the one `scripts/common.sh` loads — keep them in sync.
- `psql` fails: start the DB (`docker compose up -d postgres`) and pass `DB_NAME`/`DB_USER` if you
  override them.
