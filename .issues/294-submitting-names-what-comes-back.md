---
status: open
spec: 289
blocked-by: 292, 293
---

# 294 — Submitting names what comes back and never how much

## What to build

The dialog becomes a create door. It builds the §2 body from what the operator ticked, posts it, and
reports the three things that can come back.

**The request builder** — screen state → a `CreateReturnRequest`. This is the single most valuable
piece of code in the wave, because it is the one place a client-supplied amount could reappear:

- ticked lines only, each with its clamped quantity;
- ticked fee **types** only — which fee carries back, **never how much**;
- `shippingAddress` **omitted entirely** under `RF`, independently of what the panel did, so the
  panel and the payload cannot disagree;
- a blank note omitted;
- ⚠ **not one field carrying an amount** — no price, discount, VAT, fee or total, in either
  direction. A client-supplied refund figure is **structurally impossible** rather than validated
  against. Line money stays on screen as read-only context and never on the wire.

**`requestId` is minted once per dialog opening, not per submit**, and kept across retries. That is
what makes the key work: a double-click, a lost response and a manual retry after a network failure
all carry the same key and replay onto the same return. A fresh key per press would create a second
one — precisely the failure the key exists to prevent. Cancelling and reopening mints a new one; a
deliberate new attempt is a new request.

**The three outcomes:**

- **Success** — a toast carrying the new return number and what happens next: *the courier will be
  asked to collect* under `RTRF`, *refund only, no collection is booked* under `RF`. The dialog
  closes and the delivery beneath it **reloads**, so the screen you return to shows the newly
  consumed quantities. **The screen stays put** — it does not navigate to the created return; whether
  Document Details can open an `ORRT` at all is unverified, and the toast carries the number either
  way.
- **Replay** (`replayed: true`) — **the same toast**, with one extra clause saying the request had
  already been received and this is the same return, not a second one. It is a **success**. Showing
  an error about a return that *was* created is the confusing half of the problem the key solves.
- **Refusal** — a toast **and a banner inside the dialog that stays**, carrying the server's own
  sentence with the machine code beside it. ⚠ **The dialog stays open with every selection intact**:
  a refusal the operator can act on must not cost them the form.

**One confirmation, and it is the submit button.** The dialog *is* the confirmation — the same rule
`ChangeStoreDialog` follows. No pre-confirm. Submit is disabled and the dialog held open while the
request is in flight, so impatience cannot fire it twice.

## Spine reach

model (the §2 request/response types, transcribed) · api (`documentApi.createReturn`) · logic
(`return-order.ts`'s request builder) · component (the mutation, the three outcome paths, the banner)
· i18n (the success/replay/refusal copy) · test (pure vitest + the drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `buildCreateReturnRequest carries ticked lines only, at their clamped quantities` · pure
- [ ] `buildCreateReturnRequest carries fee types only` — the rate the screen displayed is nowhere in the body · pure
- [ ] `submitGate summarises the fees as well as the lines` — spec [289](289-bonded-return-screen-spec.md) story 41 wants *3 lines · 1 fee*, and the bar reads lines only today. ⚠ **Carried forward from [293](293-the-fees-carry-back-only-when-ticked.md)**, which built the fee selection but left the gate's signature to the ticket that owns the finished submit bar (`.afk/HITL-293.md`); if this is not picked up here, the fee half of story 41 is dropped from the spec · pure
- [ ] `buildCreateReturnRequest omits shippingAddress under RF` — even when the operator expanded and edited the address before switching reason · pure
- [ ] `buildCreateReturnRequest includes the full address field set under RTRF` · pure
- [ ] `buildCreateReturnRequest omits a blank note` · pure
- [ ] `buildCreateReturnRequest puts no amount on the wire` — ⚠ a **whole-body** walk asserting that no key anywhere in the serialized request carries a price, discount, VAT, fee or total. The one test that catches money creeping back · pure
- [ ] `return-dialog-drive.mjs` — a valid form posts once and reports success with the return number and the right what-happens-next clause for each reason · flow (Playwright)
- [ ] `return-dialog-drive.mjs` — the dialog closes and the delivery beneath **reloads** · flow
- [ ] `return-dialog-drive.mjs` — double-clicking Create Return posts **once** · flow
- [ ] `return-dialog-drive.mjs` — a `replayed: true` answer renders as **plain success**, same number, with the already-received clause and no error styling · flow
- [ ] `return-dialog-drive.mjs` — a refusal keeps the dialog open, the banner stays after the toast has gone, the machine code reads beside the sentence, and **every selection is still there** · flow

## Boundaries

- **New endpoint consumed:** `POST SdDocumentWeb/CreateReturn`, through `@/core/api` like everything
  else (`.claude/rules/api-envelope.md`). Driven against **fixtures**, not a live door — that is
  [295](295-the-screen-calls-the-real-door.md).
- **Refusals are guardrail refusals**, read through `apiErrorMessage` / `apiErrorCode`. ⚠ **The screen
  branches on no code at all** — it renders whichever one it is given. Spec 1283 §8 mints two
  (a store-not-eligible and a quantity refusal) and calls their values build detail; do not hard-code
  either.
- **401 is not this screen's to handle** — `handle401` already clears the session, toasts once and
  redirects.
- Two fixtures land here: `refused-not-eligible` (the `400` envelope with `errors[0].errorCode`) and
  `duplicate-replay` (a `200` `CreatedReturnModel` with `replayed: true`). ⚠ **Shapes are
  contractual; values are not.**
- The §2 types are **transcribed** from BackOffice spec 1283 under the single provenance line already
  in spec [289](289-bonded-return-screen-spec.md). This repo does not own them and does not get to
  change them.
- `core/services/confirm` is **not** used on this path.
- `core/ui/ErrorBanner` already renders the banner shape and takes children — no new component.

## Done when

A return is created end to end in the running app against the fixtures, with all three outcomes
behaving as described; the pure suite and `return-dialog-drive.mjs` are green; `npm run typecheck`
and `npm run lint` pass.

## Blocked by

[292](292-the-reason-decides-whether-an-address-is-asked-for.md) — the reason and the address the body
carries.
[293](293-the-fees-carry-back-only-when-ticked.md) — the fee types the body carries.
