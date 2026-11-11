---
status: done
spec: 759
blocked-by: 762
---

# 763 — Force refund by received quantity behind grant 04

## What to build

Spec 759 F5. A privileged operator holding **LocalFulfillmentReturn 04** sees **Force refund** on
the LF return panel, enters what was actually received, gives a reason, and the server pays.

- **One row per line:** received quantity clamped **0..asked**, defaulting to nothing typed (the
  operator states every line). **Never money** — the server computes it.
- **A required reason**; Submit stays disabled without one.
- **A client-minted `requestId`** per press; a retry of an unanswered press reuses its id, so a
  slow network forces once.
- **Absent without 04**; disabled with its reason once the outcome is `refunded` or `forced`.
- **On success** the panel re-reads and shows `forced` with who and why — the visible proof that
  the automatic refund is stopped.
- Refusals render through `apiErrorMessage`/`apiErrorCode` as business outcomes.

## Spine reach

api (force-refund post) · logic (pure row clamping, submit gate, request builder) · component (the
dialog, opened from 762's panel) · i18n (en + ar) · test (pure vitest + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `received quantity clamps to 0..asked` — negative, fractional, above-asked, blank · pure
- [x] `the submit gate needs every line stated and a reason` · pure
- [x] `the request body carries quantities, reason and requestId, and no amount` — whole-body walk · pure
- [x] `Force refund is absent without 04 and disabled on refunded/forced` · pure
- [x] `lf-return-drive` — force a stubbed `unanswered` return, double Submit posts one id, panel re-reads to `forced` with who and why · flow (Playwright)

## Boundaries

- Server door: BackOffice 3375, stubbed.
- 04 is read only beside 03 (760's rule).

## Done when

All Proof boxes are ticked, gates green.

## Blocked by

- 762 (the panel it lives on)

## Comments

**2026-11-04 — done** on `spec/759-lf-return` (a649e0a5, review fixes 5407d1ad; merged to main 015d7fac 2026-11-05, unpushed). ⚠ Guessed route `POST SdDocumentWeb/Delivery/{no}/LfReturn/ForceRefund`; body `{returnDeliveryNo, lines:[{itemNumber, receivedQuantity}], reason, requestId}`. An unanswered `requestId` is held per return delivery at module level, surviving a dialog close; it is dropped only on a server answer. Fractional quantities are truncated; blank = not stated. An unknown outcome disables Force refund (fail-closed). The hint reads "At most N", because the range reversed under RTL.
