---
status: done
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

- [x] `buildCreateReturnRequest carries ticked lines only, at their clamped quantities` · pure
- [x] `buildCreateReturnRequest carries fee types only` — the rate the screen displayed is nowhere in the body · pure
- [x] `submitGate summarises the fees as well as the lines` — spec [289](289-bonded-return-screen-spec.md) story 41 wants *3 lines · 1 fee*, and the bar reads lines only today. ⚠ **Carried forward from [293](293-the-fees-carry-back-only-when-ticked.md)**, which built the fee selection but left the gate's signature to the ticket that owns the finished submit bar (`.afk/HITL-293.md`); if this is not picked up here, the fee half of story 41 is dropped from the spec · pure
- [x] `buildCreateReturnRequest omits shippingAddress under RF` — even when the operator expanded and edited the address before switching reason · pure
- [x] `buildCreateReturnRequest includes the full address field set under RTRF` · pure
- [x] `buildCreateReturnRequest omits a blank note` · pure
- [x] `buildCreateReturnRequest puts no amount on the wire` — ⚠ a **whole-body** walk asserting that no key anywhere in the serialized request carries a price, discount, VAT, fee or total. The one test that catches money creeping back · pure
- [x] `return-dialog-drive.mjs` — a valid form posts once and reports success with the return number and the right what-happens-next clause for each reason · flow (Playwright)
- [x] `return-dialog-drive.mjs` — the dialog closes and the delivery beneath **reloads** · flow
- [x] `return-dialog-drive.mjs` — double-clicking Create Return posts **once** · flow
- [x] `return-dialog-drive.mjs` — a `replayed: true` answer renders as **plain success**, same number, with the already-received clause and no error styling · flow
- [x] `return-dialog-drive.mjs` — a refusal keeps the dialog open, the banner stays after the toast has gone, the machine code reads beside the sentence, and **every selection is still there** · flow

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

## Proof, as built

- **Pure — `return-order.test.ts`, 62 cases in this file (1976 across the suite), green.**
  `buildCreateReturnRequest` carries ticked lines at their clamped quantities (a cleared, zero or
  negative quantity lands at 1 rather than on the wire), fee **types** only and never a rate, omits
  `shippingAddress` under `RF` even after the address was expanded and edited, carries the whole
  eleven-field set under `RTRF`, and omits a blank or whitespace note. ⚠ The **whole-body walk**
  asserts two things at once: no key anywhere matches a money word, and every NUMBER in the
  serialized body is accounted for (two line numbers, two quantities, the delivery's GPS pair) — so
  a figure the client invented has nowhere to hide. `submitGate` now summarises *3 lines · 1 fee*
  through **two** keys, and never names a fee on a blocked bar.
- **Flow — `tools/return-dialog-drive.mjs` 97/97** (`npx vite --port 5199`, then
  `node tools/return-dialog-drive.mjs`). Sections 20–27 add: the fee half of the summary; a valid
  form posting **once** with the right what-happens-next clause under each reason; the dialog
  closing and the delivery beneath it **reloading** while the screen stays put; the posted body
  asserted field by field (no `shippingAddress` under `RF`, no note, no amount); a **double-click
  posting once** with the button disabled and Cancel held shut in flight; a `replayed: true` answer
  rendering as a **success** toast with the same number and the already-received clause; and a
  refusal keeping the dialog open with the banner **surviving the toast**, the machine code beside
  the sentence and every selection intact — then a retry carrying the **same** `requestId` and a
  reopening minting a new one.
- `npm run typecheck`, `npm run lint` and `npm run build` green; `tools/document-actions-drive.mjs`
  44/44 (no regression on the command bar).
- Two fixtures landed in `__fixtures__/return-create.ts` (`REFUSED_NOT_ELIGIBLE`,
  `DUPLICATE_REPLAY`, plus the plain `CREATED_RETURN` they are read against). ⚠ Shapes contractual,
  values not. The five captured payloads were **not touched**.

### Decisions worth carrying forward

- The §2 request/response types live in **`core/models/sd-document.ts`** under one provenance block;
  `ReturnReason` moved there and is re-exported from `return-order.ts`, and `PickupAddress` is now a
  type **alias** of `CreateReturnAddress` — so the draft cannot drift from the wire shape.
- The submit is guarded **twice**: `create.isPending` disables the button on the next render, and a
  `useRef` latch flips synchronously, so two clicks in one frame still post once.
- The refusal toast goes through `notify.apiError`, which reads the same sentence the banner shows.
- ⚠ Still open, and **not** this ticket's code: the district fallback 292 left can pair a chosen
  `districtCode` with a blank `cityCode`, which this ticket makes concrete — that pair now **posts**.
  Worth triaging before [295](295-the-screen-calls-the-real-door.md). Full log in `.afk/HITL-294.md`.

### Reviews

- **`/code-review` (high)** — one finding in this diff, **fixed**: `crypto.randomUUID()` is undefined
  outside a **secure context** and this app is served over plain http from IIS, so the dialog would
  have thrown as it opened and no `requestId` would ever be minted (localhost is a secure context, so
  no drive could catch it). Now `core/util/request-id.ts`, with three unit cases. The other two
  findings are in landed 291/292 code and stay recorded, not re-cut.
- **`/standards-review`** — **no hard rule violation** on the Standards axis. On the Spec axis, one
  real finding, **fixed**: the banner rendered every failure kind as a refusal, so a dropped
  connection was titled *The return was not created* — a claim the client cannot make, and precisely
  the lost-response case stories 46/47 are about. A refusal (`kind: 'business'`) keeps that title;
  anything else reads *The return may not have been created* and says a retry is safe **because the
  request key is kept**. Drive section 27b aborts the connection and proves it. Also applied:
  `pickedFeeTypes` now single-sources *which fees post* for both the bar and the body.
- Final gates: `return-dialog-drive.mjs` **100/100**, 1971 pure cases, typecheck + lint + build green.

