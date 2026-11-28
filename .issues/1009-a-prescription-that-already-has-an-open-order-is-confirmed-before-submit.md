---
status: done
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

### 2026-11-28 — built (spec/1006-prescription-orders)

Done on stubs against the proposed contract v1.15; the shape guesses above must be reconciled when the BackOffice tickets ship. Code review of the branch (9 findings) fixed in df551341. Drives green at df551341: prescription 65/65, `callcenter-drive.mjs` 531/531 (duplicate-prescription 44/0 and order-type 39/0 on the fix branch). The live proof is ticket 1010.

### 2026-11-28 — Reconciled to BO pricing2 e1433bf00 (ticket 4488, branch ticket/1006-reconcile-bo)

1. **The pending answer — changed outcome word.** `200 { outcome: 'pendingConfirmation', documentNo: null, state }`, the
   state unchanged with `pendingConfirmation { kind: 'activePrescription', confirmToken, expiresInMs, detail }`. 🚩 The
   guessed `confirmationRequired` mattered: `submitAsk` returned null for any other outcome word, so the real ask would
   have shown *could not confirm* instead of the sheet. Fixed in the model, `submitAsk` (keyed on the outcome only) and
   the page.
2. **The existing order's number — confirmed.** `detail.documentNo`; the detail also carries `storeCode` and
   `documentDate` (`ActivePrescriptionDetail`), not drawn.
3. **The token — confirmed.** The same `POST CallCenterWeb/Submit { transactionId, requestId, confirmToken }`.
   `CONFIRM_TOKEN_STALE` (409) when the basket, plant, payable or prescription moved; `CONFIRM_TOKEN_INVALID` otherwise.
   The submit's `requestId` is not a ledger key (once-only is `OrderNo + DocumentType`), so re-sending the press's id
   is harmless. Drive scenario G covers the stale re-ask.
4. **Go back / Esc — confirmed**, nothing is persisted by the ask beyond the issued token.
5. **New:** the gate ignores the order's OWN minted order (a retried submit answers `alreadySubmitted`), and a check OMS
   cannot answer is `SUBMIT_UNAVAILABLE`, never a silent mint.

Drive `tools/callcenter-duplicate-prescription-drive.mjs`: 50/50.
