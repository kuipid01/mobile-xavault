# Deposit Flow — Cancellation & Call Matrix

Scope: card deposit (Paystack checkout) end-to-end across **app** (`/Users/mac/dev/xavmo/app`),
**backend API** (`/Users/mac/dev/kui/xavault/internal`), and the **reconciliation worker**.

Related code:
- App: `hooks/verify-deposit.tsx` (state machine + persistence), `hooks/app/use-wallet-actions.tsx` (initiate),
  `components/general/deposit-payment-modal.tsx` (modal), `components/general/deposit-verification-banner.tsx`,
  `api/wallet.ts` (HTTP), `hooks/app/wallet.ts` (react-query).
- Backend: `wallets/service.go` (initiate / verify / dismiss / credit), `wallets/repository.go`,
  `wallets/handlers.go` + `wallets/routes.go`, `reconciliation/service.go` (polling worker),
  `webhooks/paystack_handler.go` (provider events).

---

## 1. Actors & states

### Backend deposit states (`wallet_deposits.status`)
| Status | Meaning |
|---|---|
| `pending` | Checkout created, not yet paid/confirmed. **Polled by the reconciliation worker.** |
| `success` | Wallet credited (webhook or verify path). Terminal. |
| `dismissed` | User cancelled from the app. Terminal for polling. |
| `expired` | Checkout link outlived its 24h TTL. Terminal for polling (added in this fix). |
| `amount_mismatch_flagged` | Verified amount did not match the quote. Terminal. |

### App-local states (`hooks/verify-deposit.tsx`)
```
idle ─▶ ready ─▶ checkout_opened ─▶ verifying ─▶ confirmed (done)
                          │                │
                          ▼                ▼
                 still_processing      needs_action / failed
                          │                │
                          ▼                ▼
                     (user dismisses at ANY state) ─▶ dismissed ─▶ idle (cleared)
expired ─▶ (start new payment) ─▶ checkout_opened
```

---

## 2. Happy-path call sequence

```
User taps Pay ──▶ POST /wallet/deposit/quote          (fee quote)
               ──▶ POST /wallet/deposit/initiate      (creates row status=pending,
                                                        returns authorization_url + reference)
               ──▶ startDepositVerification()         (app persists {reference, status:"ready"} in AsyncStorage)
               ──▶ WebBrowser.openBrowserAsync()      (Paystack checkout)
Return to app ──▶ AppState listener ──▶ POST /wallet/deposit/:reference/verify
                                             │          (backend asks Paystack)
                                             ├─ success ─▶ wallet credited, status=success, receipt shown
                                             └─ not yet ─▶ bounded retry: every 4s for 60s
                                                            ─▶ status=still_processing (modal offers retry)
Paystack webhook ──▶ charge.success ──▶ CreditWallet() (idempotent; credits exactly once)
```

---

## 3. Call matrix — "which calls happen when"

| # | State (app) | Backend row status | Call made? | Who calls | Purpose |
|---|---|---|---|---|---|
| 1 | `ready` (modal shown) | `pending` | `POST /deposit/:ref/dismiss` only when Dismiss pressed | app | cancel before checkout |
| 2 | `checkout_opened` (browser open) | `pending` | verify on return-to-foreground (bounded 60s) | app → backend → Paystack | confirm payment |
| 3 | `verifying` | `pending` | `POST /deposit/:ref/verify` repeatedly (4s × 15) | app | poll |
| 4 | `needs_action` / `failed` | `pending` | verify again on next foreground or "Check again" | app | retry |
| 5 | `still_processing` | `pending` | verify again on foreground / "Check again" | app | retry |
| 6 | `expired` | `pending` | `POST /deposit/initiate` (new ref) after dismissing old ref | app | restart |
| 7 | — | `pending` older than 15 min | provider verify every **5 min, forever** | reconciliation worker | catch missed webhooks |
| 8 | `dismissed` (after fix) | `dismissed` | **none** — worker query is `status='pending'` only | — | stop polling |

### Cancellation (Dismiss) paths — BEFORE this fix
| Trigger | API call to mark cancelled in DB | Result when call fails |
|---|---|---|
| Dismiss button on modal | ✅ `POST /deposit/:ref/dismiss` | ❌ silently swallowed → row stays `pending` → **worker polls Paystack every 5 min forever** |
| Android back (`onRequestClose`) | ✅ same | ❌ same as above |
| Dismiss **while auto-verifying** (`verifying`) | ❌ **button was disabled** — user trapped until 60s loop ends | — |
| App killed mid-dismiss | ❌ local state cleared only on next launch | ❌ row stays `pending` forever; worker keeps polling |
| Row never cancelled (crash before dismiss) | ❌ no path | ❌ `pending` forever, no TTL anywhere |

**Root cause of "keeps checking":** cancellation was only best-effort fire-and-forget.
Any failed/interrupted dismissal left the row `pending`, and the reconciliation worker
has **no TTL** — it asks Paystack about every stale `pending` row on every run, forever.
There was also no way to dismiss while a verification loop was running.

---

## 4. What the fix changes

| # | Layer | Change |
|---|---|---|
| 1 | App | `dismissPendingDeposit` now persists `status:"dismissed"` **before** calling the API → modal hides instantly, crash-safe. |
| 2 | App | Dismiss no longer disabled while verifying — "Cancel payment" works in every state. |
| 3 | App | On launch, a stored `status:"dismissed"` retries the backend dismiss then clears (recovers an interrupted dismissal). |
| 4 | App | `isDismissingRef` guard stops any in-flight bounded verify from continuing after dismissal. |
| 5 | Backend | `VerifyDeposit` no longer hits Paystack for `dismissed` / `expired` rows (returns `deposit_not_verified`). |
| 6 | Backend | New `WalletService.ExpireStaleDeposit` + 24h TTL in `ReconcileStuck`: stale `pending` rows are marked `expired` instead of polled forever. |
| 7 | Backend | Webhook crediting (`CreditWalletTx`) intentionally unchanged — if the user actually paid, they still get credited even after dismiss. |

### Cancellation paths — AFTER fix
| Trigger | Marked in DB? | Polling stops? |
|---|---|---|
| Dismiss button (any state) | ✅ `dismissed` | ✅ immediately (row no longer `pending`) |
| Dismiss while verifying | ✅ `dismissed` | ✅ in-flight loop bails via `isDismissingRef` |
| Dismiss API call fails | ✅ retried on next launch | ✅ eventually — worker TTL expires the row after 24h regardless |
| App killed mid-dismiss | ✅ retried on next launch | ✅ eventually — worker TTL expiry |
| Nothing at all (user walks away) | ✅ `expired` after 24h (worker) | ✅ worker stops polling |

---

## 5. State-transition diagram (dismissal focus)

```
                    ┌────────────────────────────────────────────────┐
                    │                  USER DISMISSES                 │
                    │  (any app state: ready / checkout_opened /     │
                    │   verifying / needs_action / still_processing) │
                    └──────────────────────┬─────────────────────────┘
                                           ▼
                    app: persist status="dismissed" (crash-safe)
                                           ▼
                    app: POST /deposit/:ref/dismiss ──failed──▶ retried on next launch
                                           │ success
                                           ▼
                    backend: status = "dismissed"   (worker query excludes it)
                                           │
                                           ▼
                    app: clear AsyncStorage → idle (modal gone)
                                           │
        ┌──────────────────────────────────┴──────────────────────────┐
        │                                                        (no dismiss ever fired) │
        │                                                  backend: 24h TTL in ReconcileStuck │
        │                                                  ──▶ status = "expired", polling stops │
        └──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Plan & envelope flows (audit notes)

- **Plan cancel** (`spending_plans/service.go::CancelPlan`) is transactional and guards all terminal
  states: draft cancellation, flexible-policy refunds (fee = `calculatePlanCancellationFee`), locked
  plans blocked, pending withdrawals blocked. Wallet + ledger updates happen inside the tx with row locks.
- **Envelope service** (`envelope/svc.go`) creates/updates/deletes envelopes with date + policy
  validation (`validateCreateEnvelopeRequest`, `isValidEnvelopeUnboxedPolicy`).
- **App plan hooks** (`hooks/app/plans.ts`) invalidate plan + wallet caches on confirm/cancel, which
  keeps balances consistent after a cancellation.
- No critical e2e bugs found in the plan/envelope flows on this pass; the deposit cancellation gap
  above was the main money-flow issue. See `audit` notes in the conversation for follow-ups
  (bounded-verify UX copy, worker TTL config, tests for expiry).