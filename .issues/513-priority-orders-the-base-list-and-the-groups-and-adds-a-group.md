---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 513 — Priority orders the base list and the groups, and adds a group

## What to build

**Campaigns ▸ Priority** (new feature `features/campaigns/priority/`) shows the evaluation order (ADR 0090):
the **stackable base list**, then flat **groups**, each with its **mode** (stackable, first that yields,
highest discount) and **scope** (session, item). Campaigns move **up / down** within and between them,
and **Add group** creates one. The order is saved as a draft and publishes with the next version (BackOffice 2759). An
explainer line says that groups always cascade.

## Spine reach

model/api (order get / save) · logic (move up / down / across, add group) · component (page) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `order_moveAcrossGroups_keepsEveryCampaignOnce` · pure
- [ ] drive: move a campaign into a new group, set mode and scope, save (stubbed) · flow

## Boundaries

Provisional order endpoints (BackOffice 2759), stubbed. Uses the menu leaf in the Campaigns group, and its own namespace
`campaign-priority`.

## Done when

The drive reorders campaigns across a new group and saves.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)
