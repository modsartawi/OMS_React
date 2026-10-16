---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 518 — Support lists sessions, reads one's events, cart and campaigns, and cancels it with the rollback shown

## What to build

**Campaigns ▸ Sessions** (new feature `features/campaigns/sessions/`) lists customer sessions by **store, date
(local) and status**, and can look one up by **sale id**. A session's detail has three tabs:

- **Events:** every call (moment, requestId, cartVersion, reply), holds, journal movements, budget events
  and refusals;
- **Cart items:** each line with its effects and its unit allocation;
- **Campaigns:** each campaign's outcome, so "why didn't I get the offer" has an answer.

**Cancel session**, shown only to support holding the permission, asks for confirmation and then shows the **rollback**: budgets
released, coupon uses refunded, created codes disabled, points reversed.

## Spine reach

model/api (list, lookup, cancel) · logic (event timeline shaping) · component (list, detail tabs, cancel
dialog) · i18n (`rule-sessions`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `sessionTimeline_ordersCallsAndMovements_byLocalTime` · pure
- [ ] drive: filter by store/date/status → detail tabs → cancel shows the rollback (stubbed) · flow

## Boundaries

Provisional endpoints + a new Ua permission (BackOffice 2760), stubbed. A server message inside an event is passed through as data in
`<bdi>`.

## Done when

The drive opens a session's three tabs and cancels it with the rollback shown.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)
