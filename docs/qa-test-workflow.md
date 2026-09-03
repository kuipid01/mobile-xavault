# Xavault — Manual QA Test Workflow

Use this to manually test **every essential functionality** end-to-end before release. Each case
lists the real screen labels/buttons so you can confirm **what it feels like**, not just that it
"works". Tick ✅/❌ as you go and log failures in the Defect Log at the end.

Repos under test:
- App: `/Users/mac/dev/xavmo` (Expo RN)
- Backend API: `/Users/mac/dev/kui/xavault` (`internal/`), DB in docker

---

## 0. Environment setup

| Step | Command / Action |
|---|---|
| Start DB | `cd /Users/mac/dev/kui/xavault && docker compose up -d postgres` |
| Migrate | `make migrate-up` |
| Run API | `make run` (or `docker compose up -d` for full stack). API on `:8080`. |
| Run app | `cd /Users/mac/dev/xavmo && npm start` → open in Expo Go / simulator |
| Verify wiring | `.env` in `xavmo` must point at the API (e.g. `EXPO_PUBLIC_API_URL`), backend `.env` has Paystack **test** keys. |

**Use Paystack test mode.** Test card: `4084 0840 8408 4081`, any future expiry, any CVV, OTP `123456`.
Bank transfer deposits use Paystack dedicated-account test bank "test-bank" — transfers do not
really move money in test mode; use the API's refresh/webhook tooling (or `testsupport`) to simulate.

**Verification toolkit** (used throughout; swap table names as needed):

```bash
# Deposit rows
docker exec -it salary_vault_postgres psql -U salary_vault -d salary_vault \
  -c "SELECT reference, status, created_at FROM wallet_deposits ORDER BY created_at DESC LIMIT 5;"

# Subscription rows
docker exec -it salary_vault_postgres psql -U salary_vault -d salary_vault \
  -c "SELECT id, status, payment_reference FROM user_subscriptions ORDER BY created_at DESC LIMIT 5;"

# Withdrawal rows
docker exec -it salary_vault_postgres psql -U salary_vault -d salary_vault \
  -c "SELECT reference, status, provider_reference, created_at FROM withdrawals ORDER BY created_at DESC LIMIT 5;"

# API logs (polling + cancellation events)
docker compose logs -f api | grep -E "deposit_expired|withdrawal_expired|deposit_reconcile|withdrawal_reconcile|Dismiss|dismiss"
```

> A fresh test user with an active paid plan (or seeded subscription) is needed for deposit/plan
> volume limits and envelope tests. Use a second throwaway account for subscription tests.

---

## A. Onboarding & Authentication

| ID | Steps | Expected (and feel) |
|---|---|---|
| A1 | Fresh install → first launch | Splash → onboarding carousel. Swipe through pages; final CTA → auth. Smooth animations, no stuck states. |
| A2 | Register: fill name, email, **country**, **gender**, **DOB** | Picker fields open cleanly; validation errors inline on empty/underage/invalid email. Password rule hint shown. |
| A3 | Register → verify email | "Verify email" screen; email arrives (Brevo); tapping link (or re-send) completes; auto-advance to welcome. |
| A4 | Login: correct password | Home loads within a few seconds; wallet balance appears. |
| A5 | Login: wrong password (×2) | Clear error each time. Third wrong attempt with withdrawal PIN context → PIN lockout message (`ErrWithdrawalPinLocked`). |
| A6 | Forgot password → reset → login again | Email link works; new password enforced (strong-password rules); old password rejected afterwards. |
| A7 | Log out → app relaunch | Session is gone; landing on auth, not home. |

---

## B. Home dashboard

| ID | Steps | Expected (and feel) |
|---|---|---|
| B1 | Open Home | Balance cards render: Available vs Locked vs Ledger consistent (Available+Locked = Ledger). Pull-to-refresh spins and updates. |
| B2 | Tab bar: Home / Plan(s) / Profile | Switch tabs; each keeps scroll position; haptics on tab press (light). |
| B3 | Header actions | Deposit + Withdraw icons both open their bottom sheets. |
| B4 | Next-action card | Shows sensible prompt based on state (upgrade, deposit, confirm plan); tapping routes correctly. |
| B5 | Recent movements | Latest ledger entries visible with sign/format correct (+green/−). |

---

## C. Deposit — Card (Paystack checkout) ★

Entry points: Home header deposit icon, NextActionCard, VaultHealthCard.

| ID | Steps | Expected (and feel) |
|---|---|---|
| C1 | Open Deposit sheet → type amount | **Feel:** bottom sheet slides up, keyboard types, fee card appears ~0.5s after stopping typing (debounced quote). Shows "Amount: NGN X.00", processing fee, wallet credit, "You will pay". |
| C2 | Amount < NGN 500 | Inline red error "Minimum deposit is NGN 500"; Pay button disabled. |
| C3 | Amount > NGN 5,000,000 | Inline red error "Maximum deposit is…"; Pay disabled. |
| C4 | Amount 0 / cleared | Pay disabled; no quote. |
| C5 | Enter amount then tap backdrop/close | Alert "Discard deposit?" — Keep editing returns; Discard clears and closes. |
| C6 | Tap **Pay NGN X** with valid amount | Button shows brief "Processing…"; **feel:** deposit-payment modal appears: "Ready to pay" + card icon + Amount/Reference rows + "Continue payment" / "Cancel payment". |
| C7 | Tap **Continue payment** | Paystack checkout opens (in-app browser). |
| C8 | Complete payment (test card, OTP 123456) → auto-return | App foregrounds → modal shows "Checking payment" spinner ~a moment → **success toast "Deposit confirmed · Ref …"** → green banner receipt with Copy ref → wallet Available/Ledger increase by net credit. Check DB: `wallet_deposits.status = success`, ledger credit exists exactly once. |
| C9 | **Cancel in Paystack** (abandon) → return to app | Modal goes to "Payment not confirmed" with **Check again** + **Continue same payment** + **Cancel payment**. App must NOT loop forever: it stops after the bounded window and shows "Payment still processing" state instead. |
| C10 | From "Payment not confirmed": tap **Check again** | Brief "Checking payment" spinner then back to not-confirmed (no payment made). Feel: spinner ~1–4s, then calm state, no crash. |
| C11 | From not-confirmed: tap **Cancel payment** | Modal hides immediately. **Bug-fix check:** `POST /wallet/deposit/:reference/dismiss` fires; DB row = `dismissed`; **no further verify calls for that ref in API logs**; app never re-prompts. |
| C12 | Tap **Cancel payment while "Checking payment"** (auto-verify running) | **Bug-fix check:** button is enabled during the spinner (previously disabled). Pressing it hides the modal instantly, dismiss call fires, retries stop (see log "Dismissed during bounded retry; stopping"). |
| C13 | Android hardware back while modal open | Same as Cancel payment (dismiss call fires). |
| C14 | Force-kill the app right after tapping **Cancel payment**, then relaunch | **Bug-fix check:** no zombie modal; log "Completing interrupted deposit dismissal"; DB row ends `dismissed`; AsyncStorage cleared. |
| C15 | Initiate a payment, kill app mid-checkout, relaunch next day | Local state expired → modal shows "Payment link expired" → **Start new payment** quotes fresh reference and opens checkout. DB still `pending`; **reconciliation worker expires it after 24h** (`deposit_expired` log, status `expired`). |
| C16 | Start a deposit while a previous one is pending | Old reference is dismissed first (log "Could not dismiss expired deposit" only if it failed); new checkout opens with new reference. |
| C17 | Duplicate submit (double-tap Pay) | Idempotency key prevents duplicate Paystack charges — only one deposit row/ledger credit. |

**Cancel test-card memory:** use amounts ≥ NGN 500. After each card run confirm balance & transactions page row + ledger row exist exactly once.

---

## D. Deposit — Bank transfer (dedicated account)

| ID | Steps | Expected (and feel) |
|---|---|---|
| D1 | Deposit sheet with **no** account yet | Shows "Generate Account" CTA. Tap → "Creating…" → success toast "Transfer account ready". |
| D2 | With account present | Shows bank name, account number, account name, hint "1% processing fee capped at NGN 300", **Copy account** + **I have made transfer**. |
| D3 | Tap **Copy account** | Clipboard copy + success toast + haptic success. |
| D4 | Simulate an inbound transfer webhook for this account number | Wallet credits with net amount; deposit row `success` with provider `paystack_dedicated_account`; ledger `credit` entry; **exactly one credit even if webhook redelivered**. |
| D5 | Tap **I have made transfer** before webhook arrives | Wallet refreshes; if not yet credited, no false "success" — just updated balance/toast "Wallet refreshed". |

---

## E. Withdrawal ★ (wizard: Plan → Source → Amount → To → Review → PIN)

Entry: Home header withdraw icon. Progress bar shows current step name.

| ID | Steps | Expected (and feel) |
|---|---|---|
| E1 | Open withdraw sheet with no plans / no PIN | Flow routes you to create a plan first / set PIN; no dead-ends. |
| E2 | Plan step | Only plans you can withdraw from are selectable; balance shown per plan. |
| E3 | Source step | Choose **plan funds** vs a specific **envelope** (only if policy allows unboxing). |
| E4 | Amount step | Shows withdrawable balance, live fee breakdown (fee, levy, subsidy, total deduction, recipient amount), "can withdraw" state. Amount > balance blocked with clear message. |
| E5 | Destination step | Bank accounts / saved beneficiaries selectable; validation for wrong destination type. |
| E6 | Review step | Full summary: plan, source, amount, fees, recipient, free-withdrawal allowance applied flag. Back works step-by-step. |
| E7 | PIN step | Enter wrong PIN → inline error; right PIN → **confirm** → spinner "Withdrawing…". |
| E8 | Request succeeds | Toast + transactions screen shows row "Processing". DB: `status=pending/processing`, `provider_reference` set, funds still in locked balance (**no ledger debit yet**). |
| E9 | Provider completes (simulate `transfer.success` webhook) | Row becomes `paid`; **wallet debit ledger appears**; locked balance drops; free-withdrawal allowance marked used; transactions row "Completed". |
| E10 | Provider reverses a paid transfer (`transfer.reversed`) | Refund ledger entry; row `reversed`; balance restored. |
| E11 | Pending row → open its receipt → **Cancel withdrawal** (new) | Alert "Cancel withdrawal?" explains it stops checks. Confirm → toast "Withdrawal cancelled"; row shows Failed/Cancelled styling. **Bug-fix checks:** API log shows the cancel; DB `status=cancelled`; app stops its 5s auto-refresh (no new history polling in network logs); reconciliation worker no longer queries it. |
| E12 | Cancel when transfer already sent (row `processing`, has provider_reference) | **Feel:** honest error toast "…already processing…" (409) — no fake success. |
| E13 | Force-kill after request, relaunch | Row still shows pending/processing, app re-syncs from history, polling resumes until resolved. |
| E14 | Let a row sit unresolved > 48h | Worker marks it `failed` (`withdrawal_expired` log) and stops polling; allowance released; no balance change (nothing was debited). |
| E15 | Try to cancel the plan while a withdrawal is pending | Blocked with "Wait for the plan withdrawal to finish before cancelling it". After cancel/fail/paid, plan cancellation works again. |

---

## F. Plans (create → draft → confirm → run → cancel) ★

Tabs on Plans screen: Active / Draft / Completed / Cancelled.

| ID | Steps | Expected (and feel) |
|---|---|---|
| F1 | Create plan: name, amount, start & end date, **unboxed-balance policy** (Flexible vs Locked-until-end) | Validation inline; dates sane (start < end); plan appears under **Draft** tab. |
| F2 | Edit a draft (amount/dates/policy change) | Updates persist; list reflects immediately. |
| F3 | Preview a draft | Preview screen shows allocation, fees, end summary; **confirm** disabled until accepted (accepted_preview flag). |
| F4 | Confirm plan | Money locks: Available decreases, Locked increases, Ledger unchanged; plan → Active; ledger `lock` entry exists. **Feel:** confirm button loading, then success state and navigates to plan detail. |
| F5 | Locked policy plan → try withdraw mid-term | Blocked (locked until plan ends) with clear message. |
| F6 | Flexible policy plan → withdraw some | Allowed within withdrawable amount; allowance/fees applied. |
| F7 | Plan reaches end date | Becomes Completed (auto-unlock logic) — funds available. |
| F8 | Cancel a **draft** plan | Moved to Cancelled tab; nothing moved. |
| F9 | Cancel an **active flexible** plan (after partial withdrawal) | Refund = remaining funds − cancellation fee; unlock + fee ledger entries; plan Cancelled with reason; balances correct. |
| F10 | Cancel an **active locked** plan | Blocked: "This plan is locked and cannot be cancelled early". |
| F11 | Cancel while a withdrawal is pending | Blocked (see E15). |
| F12 | Plan with envelope allocations (bulk create envelopes) → detail | Envelope list, per-envelope balances, timeline tracking all render; totals equal plan amount. |

---

## G. Envelopes

| ID | Steps | Expected (and feel) |
|---|---|---|
| G1 | Create envelope on an active plan | Name/date/amount validation; date within plan window; policy validation (`flexible` / `locked_until_plan_ends`). Appears in list with balance. |
| G2 | Edit envelope (amount/date) | Updates reflect in plan totals; locked-envelope rules enforced. |
| G3 | Delete envelope | Confirm dialog; deleted only if no locked funds / rules allow; totals rebalance. |
| G4 | Bulk create envelopes screen | Add several rows at once, per-row validation, submit creates all; partial errors surface per row. |
| G5 | Envelope detail | Balance, timeline, and withdrawal entry point for that envelope only. |
| G6 | Withdraw from a locked envelope before its end date | Blocked with clear reason. After end date → allowed. |

---

## H. Subscription & upgrade

| ID | Steps | Expected (and feel) |
|---|---|---|
| H1 | Plans/upgrade screen (Home → upgrade CTA or Profile) | Shows current plan vs paid tiers; recommended upgrade highlighted ("Not sure?" default). |
| H2 | Tap **upgrade** on a paid tier | Paystack checkout opens with subscription reference `SUB_…`. |
| H3 | Complete payment | Active-subscription refetch shows new tier; limits unlock (bigger vault capacity). Check DB `user_subscriptions.status = active`. |
| H4 | Abandon checkout → return | Watcher modal "Upgrade not confirmed" with Verify again / Continue same payment / **Cancel payment**. |
| H5 | Tap **Cancel payment** (subscription) | **Bug-fix check:** modal hides; `POST /subscriptions/payment/:reference/dismiss` fires; DB row `status=canceled`; app stops bounded checks; no re-prompt. |
| H6 | **Cancel while "Checking payment"** | **Bug-fix check:** button enabled mid-spinner; cancel works (same as C12). |
| H7 | Dismiss, then complete the same Paystack payment anyway (webhook) | **Bug-fix check:** webhook still activates — `user_subscriptions.status=active` even though it was canceled. Subscription works; user not double-charged or stuck. |
| H8 | Kill app mid-checkout, relaunch | Watcher restores correct state (ready/checkout/expired); no stuck "verifying" (recovery logic). |
| H9 | Start upgrade while already subscribed | Server rejects (only higher tier allowed) — graceful message. |
| H10 | Deposit while at plan capacity (e.g. free tier limit) | "Upgrade" limit modal appears with required capacity context; dismiss → no deposit created. |

---

## I. Profile & settings

| ID | Steps | Expected |
|---|---|---|
| I1 | My Profile: update name/phone/etc | Saved; reflects on next load. |
| I2 | Change email | Verification email flow to new address; old session behavior sane. |
| I3 | Security questions | Set/update; answers persisted; used to reset PIN if offered. |
| I4 | Payment settings | Bank accounts + beneficiary management (add/remove/default). |
| I5 | Login settings / biometrics | Enable biometric → next cold login offers it; wrong fallback to password. |
| I6 | Withdrawal PIN set/change | Works; PIN policy enforced. |
| I7 | Feedback & suggestions | Submits; success toast. |

---

## J. Cancellation regression suite (the recent fixes) ★

Run these last, against a DB you can inspect. This is the "does it stop checking" suite.

| ID | Scenario | Steps | Pass = |
|---|---|---|---|
| J1 | Deposit dismiss stops backend polling | Initiate card deposit → **Cancel payment** → wait 2 worker cycles (10 min) or check logs now | DB `wallet_deposits.status='dismissed'`; no `deposit_reconcile_provider_error` / verify for ref; log shows dismiss. |
| J2 | Deposit dismiss interrupted (kill app) | Initiate → tap cancel → kill instantly → relaunch | Modal does not reappear; log "Completing interrupted deposit dismissal"; DB `dismissed`. |
| J3 | Deposit abandoned forever | Initiate → never pay, never dismiss → wait past 24h (or backdate a row) | Worker sets `status='expired'`; log `deposit_expired`; polling stops. |
| J4 | Subscription dismiss stops checking | Upgrade → **Cancel payment** | DB `user_subscriptions.status='canceled'`; no further `/subscriptions/active` bounded polling for it in app logs. |
| J5 | Subscription canceled-then-paid still activates | Cancel payment → complete Paystack anyway → webhook | `user_subscriptions.status='active'`; no "already final" errors in API logs. |
| J6 | Withdrawal cancel stops 5s app polling | Request withdrawal (pending, pre-provider state via test tooling) → **Cancel withdrawal** in receipt | DB `status='cancelled'`; app network log shows history polling stops; worker no longer includes it. |
| J7 | Withdrawal TTL | Backdate a `pending` row > 48h → run worker | `status='failed'`; log `withdrawal_expired`; allowance released if reserved. |
| J8 | Late success after TTL/cancel is still honored | Backdate a withdrawal to `failed`, then send `transfer.success` for its reference | Row becomes `paid` **with** a wallet debit ledger (no double-credit of funds). |

---

## K. Quick regression matrix (smoke)

| Area | Check | Result |
|---|---|---|
| App boots | No red screen; error boundary not triggered | |
| Wallet math | Available + Locked = Ledger after every test above | |
| Ledger integrity | Every success deposit = exactly 1 credit; every paid withdrawal = exactly 1 debit; cancels/reversals have refunds where due | |
| Toasts | Success/error toasts appear once (no double-toast on deposits) | |
| No zombie modals | Only one verification modal/banner at a time; receipts clear before next deposit | |
| Pull-to-refresh | Home + Transactions refresh balances/ledger/history | |
| Offline | Kill network: graceful error toast, no crash; retry after restore | |
| Kill/relaunch | Every wizard restores to a sane state (no stuck "verifying") | |

---

## Defect log

| # | Date | Area | Test ID | Steps to reproduce | Expected | Actual | Severity |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |

Severity: 🔴 Blocker · 🟠 High · 🟡 Medium · 🔵 Low

## Result summary

```
Total tests run:     ___
Passed:              ___
Failed:              ___
Blockers open:       ___
Signed off:          ___  (date)
```
