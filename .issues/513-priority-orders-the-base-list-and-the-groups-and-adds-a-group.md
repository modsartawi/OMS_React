---
status: done
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

- [x] `order_moveAcrossGroups_keepsEveryCampaignOnce` · pure — `src/features/campaigns/priority/order.test.ts` (14 tests: moves, groups, tidy, default names)
- [x] drive: move a campaign into a new group, set mode and scope, save (stubbed) · flow — `tools/priority-drive.mjs` 36/36 (stubbed `RuleCampaign/Order`; includes a refused save, the leave guard, delete and discard). `tools/campaigns-drive.mjs` still 450/450 after LeaveGuard graduated to core.

## Boundaries

Provisional order endpoints (BackOffice 2759), stubbed. Uses the menu leaf in the Campaigns group, and its own namespace
`campaign-priority`.

## Done when

The drive reorders campaigns across a new group and saves.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Outcome (2026-10-16)

Built on stubs. typecheck, lint (all four gates), `npm test` (322 files, 5408 tests) and build are green.
Rulings are in `.afk/HITL-513.md`: one estate-wide order; HQ places new campaigns; client-minted `new-N` group ids; up/down stays within a list and Move to goes between places; prototype defaults.
**Outstanding (not AFK):** the live door (ticket 520, BackOffice 2759) and owner sign-off on the Open-questions defaults.

