---
status: open
spec: 759
blocked-by: 761, 762, 763, 764, BO 3370, BO 3371, BO 3372, BO 3373, BO 3375, BO 3376
---

# 765 — The LF return screens call the real doors

## What to build

Everything before this ticket was built against stubs. This one points the LF return command,
dialog, panel, force refund and needing-action preset at a deployed SIS.Api carrying BackOffice
3370–3376, and walks them.

🔑 **This ticket is the drift detector** (295 precedent). Spec 759's §The wire is a
transcription. A `400` or a missing field on the first live call is a **drift report against
BackOffice spec 3369 §Wire** — 3369 is corrected first, then 759's transcription, then the code.
Never patch the TypeScript alone.

**First job:** read the shipped shapes of 3373 (delivery refusal fields) and 3376 (detail read,
needing-action read, probe flags) and match every spelling against 759.

**Then walk:**

- an ungranted user sees no Return on an LF delivery, no panel, no preset;
- a 03-only user raises a real LF return inside the window — one return behind a double Submit,
  `FLFD` unticked, no amount on the wire — and sees no Force refund;
- a delivery outside its window shows the refusal with its end date; a second return while one is
  open is refused;
- the panel shows the warehouse outcome as Starlinks confirms it (rides the 3377 staging smoke);
- a 03+04 user force-refunds an unanswered return and the panel shows `forced`; the automatic
  refund does not also pay;
- the needing-action preset lists that return before the force, and not after;
- an **RTL pass** on dialog, panel and preset in Arabic.

## Spine reach

api (live calls) · model (only if drift forces it) · test (the drives re-run live) · **and, on
drift, an edit to BackOffice spec 3369 first**

## Proof

- [x] `shapes confirmed` — every transcribed field matched; any mismatch written into 3369 first · manual
  *(2026-11-05, read against BackOffice source: `LocalFulfillmentReturnWebEndpoints.cs`,
  `LfReturnReads.cs`, `LfReturnForceRefundService.cs`, `SdDocumentHeaderModel` 3373 fields, the
  `SdDocumentWeb/Access` flags. 3369 needed no edit — its §Wire already said a restocked **flag** and
  `nothing-received`. The drift was 759's transcription + the client, corrected in that order:
  (1) the three routes were guessed under `SdDocumentWeb/` and live on `LocalFulfillmentReturnWeb/`
  (`Detail/{no}`, `NeedingAction`, `ForceRefund`) — SIS.Api's SPA fallback answered the guess with
  `index.html` at 200, which the panel showed as "Unexpected API error (HTTP 200)" on every return
  delivery for a 03 holder; (2) not-an-LF-return is `400 SDD-02205`, not 404 / `data:null`;
  (3) `askedQuantity`/`confirmedQuantity`/`refundedQuantity` → `quantityAsked`/`quantityConfirmed`/
  `quantityRefunded`; (4) `returnedToStock` is a boolean — the panel's Restocked column now reads
  Yes / Not restocked. Additive and not drawn: `returnDeliveryNo`, `forwardDeliveryNo`,
  `returnOrderNo`, `lineNumber`; on NeedingAction `closedAt`, `reason`, `ageDays`. Probe flags, 3373
  refusal codes and the force-refund body matched. Drives `lf-return-drive` 156/156 and
  `lf-returns-queue-drive` 22/22 re-run on the corrected stubs.)*
- [ ] `ungranted user sees nothing LF` · flow, live
  *(2026-11-05 read-only walk on STAGING `http://172.23.10.110:4321` as 14419, holding 03+04, after
  b5291886: bonded return 9000000017 → Detail answers `400 SDD-02205`, no panel, no banner (the
  original "HTTP 200" bug is gone); LF `8000008056` → Return disabled, "has not reached the customer
  yet" (`notDelivered`); LF `8000007074` → "The return window for this delivery closed on
  2026-09-27" (`outsideWindow`); the needing-action queue reads the real door: 0 rows, empty-state
  sentence. Staging has NO LF return at all (45 BZ03 deliveries: 42 notDelivered, 3 outsideWindow),
  so the panel and force refund are unwalked. ⚠ Staging's Starlinks says `Mintsoft fulfilment
  profile 'Domestic' is not configured` on every LF Create Order — a real LF return booked there
  would fail too; that is BackOffice config (3370/3377), not this client. No ungranted account yet.)*
- [ ] `a real LF return is created once` · flow, live
- [ ] `window and return-open refusals render` · flow, live
- [ ] `force refund pays once and the panel says forced` · flow, live
- [ ] `needing-action preset lists the stuck return` · flow, live
- [ ] `RTL pass` · manual

## Boundaries

- Never against production's live warehouse exchange without the owner present; staging with
  Starlinks is the target (3377).

## Done when

All Proof boxes are ticked, or each unticked one names what blocked it.

## Blocked by

- 761, 762, 763, 764
- BackOffice 3370, 3371, 3372, 3373, 3375, 3376 deployed to dev/staging
