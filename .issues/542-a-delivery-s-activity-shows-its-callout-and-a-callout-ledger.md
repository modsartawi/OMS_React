---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2952-competed-delivery-callout-spec.md
blocked-by: — (live: BackOffice 2964)
---

# 542 — A delivery's Activity shows its callout, and a Callout sub-tab holds the ledger

## What to build

**The callout timeline** for BackOffice spec 2952. Brief: the spec's `## Comments` → "oms-react hand-off", point 2;
decision `C:\Work\DMSCO\BackOffice\.issues\2950-the-oms-react-dispatch-visibility-screens.md` `## Answer` point 2
(timeline = variant A + C); prototype `C:\Work\DMSCO\BackOffice\.scratch\proto\2950-dispatch-visibility-screens\index.html`.

- **Model** `core/models/delivery-callout.ts` from BackOffice `DispatchBoardModels.cs`:
  `DeliveryCalloutHistory { asOf, deliveryNumber, callouts[] }`, each callout a `DispatchCallout` (541's shape;
  share it) plus `events[] { kind, party, staff, register, eventAt, detail, bidId }`. No callout → an empty list.
- **Door** `GET SdDocumentWeb/Delivery/{deliveryNo}/Callout`, on the existing Delivery details gate (`GatedByDetail`).
  No new screen, no new grant.
- **Moments in `ActivitySpine`:** a new callout moment kind beside the donor moments (`core/oms/donor-moments.ts`
  pattern), merged into `core/oms/timeline-feed.ts` by time:
  - callout-level `kind`s: `Opened`, `Take`, `Pass`, `Withdraw`, `Unanswered` (the fallback), `LockReleased`
    (detail = reason + note), `FallbackFailed`;
  - bid-level `kind`s: `Delivered`, `Shown`, `BidOpened` (the till opened the sheet; `Opened` is the callout opening),
    `Dismissed`, and the fallback store's `FallbackDelivered|Shown|Opened|Dismissed`;
  - awarded-elsewhere / passed / expired / withdrawn / lock-released stay **distinct**; an expired bid shows its
    `ignoreReason` (`NotReached`, `ReachedNotShownNobodySignedIn`, `ReachedNotShownOldBuild`, `ShownNotOpened`,
    `OpenedNotAnswered`);
  - a "now" line while the callout is open;
  - a delivery that was **not competed** (`NOT_OPENED`) shows one moment with its reason (`NoGps`, `NoCandidates`,
    `OneCandidate`, `StockLeftFewerThanTwo`, …).
- **Callout sub-tab** under Activity (only when the delivery has a callout): the one-row-per-bid ledger (store, km,
  ATP at offer, tills online / signed in, the four moments, answer + staff + register, outcome) and the raw event
  log in order, for disputes.

## Spine reach

model · api · logic (event → moment mapping, ledger rows) · Activity spine + sub-tab · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [ ] moment mapping: every `kind` above gives its moment; `Opened` vs `BidOpened` are told apart; lost /
      passed / expired / withdrawn / lock-released give distinct moments; an unknown `kind` still renders; a
      `NOT_OPENED` callout gives one moment with its reason (vitest)
- [ ] feed merge: callout and donor moments interleave by time with the existing feed (vitest)
- [ ] drive script, LTR and RTL, against a stub serving the door for a taken, a fell-back, a released and a
      not-competed delivery, and an empty list: the spine, the sub-tab shown only with a callout, the ledger, the log
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 2964 (built and merged on `pricing2`); stubbed until deployed with the owner's SQL
  (`Modules/Sd/Sql/056`, `Modules/Callouts/Sql/001`).
- Read only. Release lock lives on the board (541) and on Delivery details' actions (below).

## Done when

The Proof boxes are ticked: on the running app (stubbed), a competed delivery's Activity tells its callout story and
the Callout sub-tab holds the bid ledger and the raw log.

## Blocked by

— (live: BackOffice 2964 deployed)

## Open questions

- BackOffice 2951 also puts **Release lock on Delivery details** (shown only on a locked delivery, same
  `DispatchBoard` Execute grant, same `POST DispatchBoard/ReleaseLock`). Default: build it here as a Delivery
  details action reusing 541's release dialog, once 541 has landed; overrulable into its own ticket.
