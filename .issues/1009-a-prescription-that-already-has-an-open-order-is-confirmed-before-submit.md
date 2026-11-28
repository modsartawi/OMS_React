---
status: open
spec: 1006
blocked-by: 1008, BackOffice 4488
---

# 1009: A prescription that already has an open order is confirmed before submit

Client half of spec 1006, decision **D5**.

## What to build

`pendingConfirmation.kind: activePrescription` is a modal, like `belowAtp` (spec 160: *both kinds are modal*).

- **The modal:** *"This prescription already has an open order, {{documentNo}}. Place another one?"*, with
  the buttons *Go back* and *Place anyway*.
- *Place anyway* re-sends submit with the `confirmToken`.
- *Go back* leaves the order open and unchanged.
- The modal follows the console keyboard grammar (ticket 153): Esc is *Go back*, and Enter does not confirm by
  default.

## Proof

- [x] vitest on the modal's copy (en and ar), and on its token being sent once.
- [x] A console test: a stubbed `activePrescription` opens the modal; *Place anyway* submits with the token;
  *Go back* sends nothing.
- [x] typecheck, vitest, lint.

## Comments

**2026-11-28, built against the proposed v1.15 with stubs (BackOffice 4488 open).** Pure module
`src/features/callcenter/console/active-prescription.ts` (+ `active-prescription.test.ts`, 12 cases, en and
ar): `submitAsk` reads the ask off a submit answer, `activePrescriptionCopy` words the sheet (the order
number isolated whole with `fsi`), and `placeAnyway` is the send-once rule. The body is
`ActivePrescriptionConfirm.tsx` on the unchanged `ConfirmSheet` (marker `activePrescription`, no focusable
body, so *Go back* stays the first focused button and Enter goes back). The page reads the ask **before**
`readSubmitResult`, so a pending answer is never drawn as placed; a `confirmationRequired` answer it cannot
state (no token) shows `submit.notConfirmable` on the receipt and places nothing. *Place anyway* is guarded
by a synchronous ref as well as `isPending`, so a double click sends the token once. Drive
`tools/callcenter-duplicate-prescription-drive.mjs`: 33/33 (en and ar). Regression: 1007's drive 39/39,
1008's 56/56, `callcenter-drive.mjs` (belowAtp and submit) 531/531.

**Contract guesses to reconcile when BO 4488 ships:**
1. **The submit answer when a confirmation is pending.** `200` with
   `{ outcome: 'confirmationRequired', documentNo: null, state }`, the state **unchanged** and carrying
   `pendingConfirmation: { kind: 'activePrescription', confirmToken, expiresInMs, detail }` — §5's rule on
   submit's own result, read off `state.pendingConfirmation` as `belowAtp` is. Typed as
   `SubmitConfirmationRequired` / `SubmitAnswer` in `core/models/callcenter.ts`. The client keys on the
   `pendingConfirmation`, not the outcome word; if BO uses another outcome word the ask still opens.
2. **The existing order's number.** `detail.documentNo` (the name `SubmitResult` already uses). If the
   detail names none, the sheet still asks, without a number (`activePrescription.bodyNoNumber`).
3. **How the token goes back.** The same verb, `POST CallCenterWeb/Submit { transactionId, requestId,
   confirmToken }`, with the **same** `requestId` as the press that raised the ask (law 3) — as `addItem`
   sends its `belowAtp` token. `CONFIRM_TOKEN_STALE` / `CONFIRM_TOKEN_INVALID` re-send once without the
   token and re-ask with the re-issue notice, as the add and the rebind do.
4. **Go back / Esc** send nothing; the next *Place order* is a new press with a new `requestId`.
