---
status: open
spec: 766
blocked-by: 774, 753, BackOffice 3384
---

# 783 — Callout panels drill to the dispatch scorecard once the callout area is live

## What to build

Area 4 (callouts and donor requests) moves from unavailable to available through the model alone.
This ticket checks that move and adds the one area-specific drill:
- a callout point offers "See in the dispatch scorecard", which routes to the scorecard with the
  store or city and the period;
- donor measures offer no detail drill;
- Q11–Q13 render as views.

## Spine reach

component/route (drill target) · store/logic · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `area 4 flips from unavailable to available on a model change, with no code change` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)
- [ ] `a callout panel drills to the dispatch scorecard with the store and period` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Waits on oms-react 753 (the replica articles) and BackOffice 3384 (`C:\Work\DMSCO\BackOffice\.issues\3384-callout-and-donor-request-measures-answer-at-parity-with-the-dispatch-scorecard.md`).

## Done when

The drive proves both, and Q11–Q13 render on staging.

## Blocked by

[774](774-drilling-to-detail-from-a-store-or-city-opens-the-deliveries-list-already-filtered.md), [753](753-the-dba-adds-the-callout-and-donor-request-tables-to-the-replica-publication.md) (the replica articles), BackOffice 3384

## Open questions

Does the dispatch scorecard take store, city and period from its URL? If not, add that entry here, as 774 does for Deliveries.
