---
type: spec
status: ready
---

# 759 — A local fulfillment return on Document Details, behind its own guard

**This is the FRONTEND spec.** Its backend half is **BackOffice spec 3369**, in the sibling
BackOffice repo at `C:\Work\DMSCO\BackOffice`:

> [file:///C:/Work/DMSCO/BackOffice/.issues/3369-a-local-fulfillment-return-refunds-what-the-warehouse-confirms-spec.md](file:///C:/Work/DMSCO/BackOffice/.issues/3369-a-local-fulfillment-return-refunds-what-the-warehouse-confirms-spec.md)

**3369 is the normative owner of every server shape** (its §Wire). Everything under
[The wire, transcribed](#the-wire-transcribed) is a transcription. ⚠ **Drift rule** (as spec 289):
a `400` on a joining ticket's first live call is a drift report against 3369 — the spec is
corrected first, then this transcription, never the transcription alone.

Glossary: BackOffice `CONTEXT.md` — *Local fulfillment delivery (LF)*, *Local fulfillment return*,
*Not restocked*. Decision record: BackOffice ADR 0123.

## Problem Statement

An operator on Document Details looking at a **local fulfillment** delivery (type `LF`, store
`BZ03`) whose customer wants to send it back has no way to do it. The Return command (spec 289) is
gated on the bonded rail — `canReturn` is true only for a `BZ02` delivery — so on an LF delivery it
is disabled, and the only reason it can show is the bonded one. The business has agreed an LF
return cycle with Starlinks and is about to go live; the web is where it has to be raised.

The bonded dialog cannot simply be reused as-is: LF has no Refund-Only, a 5-working-day window,
one open return per delivery, a different fee (`FLFD`), its **own permission**, and a refund that
waits for the warehouse — so operators also need to *see* what the warehouse confirmed, find the
returns that are stuck, and force a refund when Starlinks never answers.

## Solution

- **The Return command on an LF delivery** is offered only to a user holding the new
  **LocalFulfillmentReturn 03** grant, enabled when the server says `canReturn`, and otherwise
  disabled with the server's own refusal (outside the window — showing the end date, nothing left,
  a return already open, not yet delivered).
- **The same Return dialog**, in an LF mode: no reason choice (Return-and-Refund is the only one,
  stated, not selectable), the `FLFD` fee tickable and unticked, the pickup address panel, the note.
  Nothing on the wire carries an amount — unchanged from 289.
- **An LF return panel** on the return delivery's Document Details: the warehouse watch — outcome,
  booked / collected / confirmed dates — and per line *asked · confirmed · refunded · restocked ·
  reason*.
- **Force refund** on that panel, offered only with the **LocalFulfillmentReturn 04** grant: enter
  the received quantity per line and a required reason; the server computes the money.
- **"LF returns needing action"** — a filter on the existing document list (unanswered,
  nothing received, short), behind the 03 grant.

Bonded returns look and behave exactly as today.

## User Stories

1. As an operator with the LF return grant, I want Return enabled on an LF delivery inside its
   window, so that I can raise the customer's return where I already am.
2. As an operator without the LF return grant, I want no Return command on an LF delivery, so that
   I am not offered what the server will refuse.
3. As an operator, I want a disabled Return to say why — and, for the window, until when it was
   open — so that I can answer the customer.
4. As an operator, I want the dialog to say plainly that the driver will collect and the refund
   follows the warehouse's check, so that I set the customer's expectation correctly.
5. As an operator, I want no Refund-Only choice on an LF return, so that I cannot refund before
   collection.
6. As an operator, I want the `FLFD` fee shown unticked with its amount, so that I refund it only
   when owed.
7. As an operator, I want quantities clamped between 1 and what remains, so that I cannot submit a
   return the server will refuse.
8. As an operator, I want a second press of Submit to create one return, so that a slow network
   never books two pickups.
9. As an operator, I want the LF return panel to show asked, confirmed, refunded and restocked per
   line, so that I can explain a partial refund.
10. As an operator, I want an *unanswered*, *nothing received* or *short* return to say so at the
    top of the panel, so that I know action is needed.
11. As an operator, I want a "needing action" filter on the document list, so that I can work the
    stuck LF returns as a queue.
12. As a privileged operator with the force-refund grant, I want a Force refund action on an open
    or stuck LF return, so that a customer is not left waiting on Starlinks.
13. As a privileged operator, I want to enter received quantities, never money, and a required
    reason, so that a forced refund follows the agreed rule and is explainable.
14. As a privileged operator, I want to see after forcing that the automatic refund is stopped, so
    that I trust the customer is paid once.
15. As an operator with only the create grant, I want no Force refund action, so that raising
    returns never implies releasing money.
16. As an Arabic-reading operator, I want every new label, refusal and outcome in Arabic and
    English, right-to-left where it should be, so that the screen reads as one product.

## Implementation Decisions

**F1 — The grant is read from the access probe, never inferred.** The access model gains two
booleans transcribed from 3369: may create LF returns (03) and may force-refund them (04, only
beside 03). The command, the panel and the filter read them. The server re-checks every call;
the client flag only hides what would be refused.

**F2 — The command gate gains an LF arm.** For an `LF` delivery: hidden without 03; otherwise
enabled iff the server's `canReturn`; disabled reason = the server's `returnRefusal` code mapped to
a `document` namespace key, with `returnWindowEndsOn` interpolated for the window refusal. The
bonded arm (289/290's three reasons) is unchanged and its tests stay green unchanged.

**F3 — One dialog, an LF mode.** The existing `ReturnDialog` and its pure helpers are reused. LF
mode: the reason fork is replaced by a one-line statement (Return-and-Refund, fixed); the submit
gate's "choose a reason" step is skipped in LF mode only; `refundableFees` offers `FLFD` (money from
the item-0 **`condAmount`**, never `condValue` — 289/293's silent-zero rule, unchanged). The request
builder still emits no amount; the whole-body walk test extends to an LF body.

**F4 — The LF return panel** is a section on Document Details for a return delivery whose forward
delivery is `LF`, fed by 3369's LF return detail read. Read-only, except Force refund (F5). Outcome
shown as a status chip with its meaning in words; dates in local wall-clock.

**F5 — Force refund** is a dialog on that panel: one row per line, received quantity 0..asked
(clamped), a required reason, a client-minted `requestId`. Disabled once the outcome is *refunded*
or *forced*. On success the panel re-reads and shows outcome *forced* with who and why.

**F6 — The needing-action filter** is a preset on the existing document list, fed by 3369's
needing-action read, showing reason and age. Hidden without 03.

**F7 — No flag.** The grant is the switch; nobody holds it on seed.

## The wire, transcribed

> Provenance: BackOffice spec 3369 §Wire, 2026-11-04. Not authoritative.

- Delivery read, for `LF`: `canReturn: boolean`, `returnRefusal: 'outsideWindow' | 'notDelivered' |
  'nothingRemaining' | 'returnOpen' | null`, `returnWindowEndsOn: string | null` (local date).
- `SdDocumentWeb/CreateReturn` — body unchanged from 289; for `LF` the reason is always the
  Return-and-Refund value. New named refusals: outside window, Refund-Only not allowed, return
  already open, LF grant missing.
- LF return detail — `GET LocalFulfillmentReturnWeb/Detail/{returnDeliveryNo}` (3376):
  `{ returnDeliveryNo, forwardDeliveryNo, returnOrderNo, outcome: 'open' | 'refunded' | 'short' |
  'nothing-received' | 'unanswered' | 'forced', bookedAt, collectedAt, confirmedAt, forcedBy,
  forcedReason, lines: [{ lineNumber, itemNumber, sku, quantityAsked, quantityConfirmed,
  quantityRefunded, returnedToStock: boolean, reasonName }] }`. Quantities are always numbers (`0`
  before the warehouse answers); unstamped dates are `null`. A return delivery with **no LF watch**
  (a bonded return) is a `400` envelope with code `SDD-02205` — not a 404, not `data: null`.
- LF returns needing action — `GET LocalFulfillmentReturnWeb/NeedingAction` (3376): rows of
  `{ returnDeliveryNo, forwardDeliveryNo, outcome, bookedAt, closedAt, reason, ageDays }`.
- Force refund — `POST LocalFulfillmentReturnWeb/ForceRefund` (3375):
  `{ returnDeliveryNo, lines: [{ itemNumber, receivedQuantity }], reason, requestId }`.
- Access probe (`SdDocumentWeb/Access`): `canCreateLocalFulfillmentReturn`,
  `canForceLocalFulfillmentReturnRefund`.

✅ Reconciled against the built doors by ticket 765 (2026-11-05). 3369 §Wire already said a
restocked **flag** and `nothing-received`; the drift was this transcription's alone (`askedQuantity`
→ `quantityAsked` …, `returnedToStock` a count → a flag, the not-an-LF-return answer, and the three
routes, which 3369 never named and this client had guessed under `SdDocumentWeb/`).

## Testing Decisions

- **Pure first** (precedents: `commands.test.ts`, `return-order.test.ts`): the LF command gate per
  refusal and per grant; the LF submit gate skipping the reason step; the request builder's
  whole-body no-amount walk on an LF body; force-refund row clamping and the required reason.
- **Component tests** with stubbed API: the dialog in LF mode shows no reason choice and an
  unticked `FLFD`; the panel renders each outcome; Force refund is absent without 04.
- **Bonded unchanged:** every existing 289-family test green without edits.
- **The joining ticket** calls the real door on dev/staging — the drift detector (289/295
  precedent) — and a manual walk with a granted and an ungranted user.

## Out of Scope

- Everything server-side — BackOffice 3369.
- The bonded return flow (289) — unchanged.
- The credit note — BackOffice 1444.
- A dedicated LF returns page (ruled: a list filter is enough for v1).
