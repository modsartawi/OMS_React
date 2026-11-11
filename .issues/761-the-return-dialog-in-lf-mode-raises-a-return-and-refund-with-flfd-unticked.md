---
status: done
spec: 759
blocked-by: 760
---

# 761 — The Return dialog in LF mode raises a Return-and-Refund with FLFD unticked

## What to build

Spec 759 F3. Pressing Return on an LF delivery opens the **same** Return dialog in an LF mode, and
Submit creates one LF return through `SdDocumentWeb/CreateReturn`.

- **No reason fork.** Return-and-Refund is the only LF reason: a one-line statement replaces the
  choice — the driver collects, and the refund follows the warehouse's check. Refund-Only cannot be
  picked, by construction.
- **The submit gate skips "choose a reason"** in LF mode only; the bonded gate is unchanged.
- **The `FLFD` fee** is offered unticked, its money from the item-0 **`condAmount`** (never
  `condValue` — 289/293's silent-zero rule). The pickup address panel and the note behave as today.
- **No amount on the wire.** The request builder's whole-body walk test extends to an LF body.
- Quantities clamp 1..remaining and a second Submit replays one `requestId` — both inherited from
  289; prove they hold in LF mode.
- The new LF named refusals (outside window, Refund-Only not allowed, return already open, LF grant
  missing) render through `apiErrorMessage`/`apiErrorCode` in the dialog's banner, as business
  outcomes.

## Spine reach

logic (`return-order.ts`: LF mode on the submit gate, `FLFD` in `refundableFees`, the builder) ·
component (`ReturnDialog` LF mode) · i18n (statement + refusal keys, en + ar) · test (pure vitest +
the return drive)

## Proof (→ `tdd` red-green cycles)

- [x] `submitGate in LF mode opens without a reason` — and the bonded gate still demands one · pure
- [x] `refundableFees offers FLFD at its condAmount` — a `condValue`-only row is not a zero fee · pure
- [x] `buildCreateReturnRequest on an LF draft carries the Return-and-Refund reason` · pure
- [x] `the whole-body walk finds no amount on an LF body` · pure
- [x] `return-drive` — stubbed LF delivery: no reason choice, the statement shown, `FLFD` unticked with its amount, double Submit posts one `requestId`, each LF refusal renders its banner · flow (Playwright)
- [x] `the 289-family tests pass unchanged` · pure

## Boundaries

- Server door: BackOffice 3370 (create) + 3373 (refusals), stubbed.
- One dialog — no `LfReturnDialog` fork. If the mode switch makes the component hard to read,
  extract the reason area, not the dialog.

## Done when

All Proof boxes are ticked, gates green.

## Blocked by

- 760 (the LF command must be enabled to open the dialog)

## Comments

**2026-11-04 — done** on `spec/759-lf-return` (e9c72931; merged to main 015d7fac 2026-11-05, unpushed). `lf-return-dialog-drive` 40/40, `return-dialog-drive` 105/105, 289 tests unedited. Decisions (overrulable): LF fee list offers only item-0 `FLFD`, by type whatever its category; the builder forces `RTRF` on an LF draft; refusal banners show the server's own sentence + code (codes in the drive are invented until BO 3373 fixes them); a 403 revokes the grant of the mode being raised. The ar file had no `returnDocument` block before this, so the bonded dialog still falls back to English.
