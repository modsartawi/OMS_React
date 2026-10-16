---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: —
---

# 501 — A marketer sees the campaigns list by state and opens a campaign's dashboard

## What to build

**Slice 0 of the rule-engine screens.** A new nav group **Campaigns** at `/campaigns/*` (new area
`features/campaigns/`). Its first leaf, **Campaigns**, lists rule campaigns with **state tiles and their
counts** (draft, waiting for approval, scheduled, running, expired, disabled), a search over the
campaign name (EN or AR), and the tiles act as the filter. Clicking a row opens that campaign's
**workspace** at `/campaigns/:id` on its **Dashboard**. The dashboard shows **Details** (name EN + AR,
features), **State**, and **Schedule** with "starts in N days" or "ends in N days", all in **local
time**, never UTC. The dashboard is read-only in this slice. The workspace has its side menu (Dashboard,
Rule builder, Coupons when the coupons feature is on, Versions, Settings ▸), and items whose ticket
hasn't landed are left out.

This slice sets the shared layer every later slice builds on:

- `core/rules/` holds the **provisional campaign model** (campaign, rule, condition/effect block,
  named filter by **id**, named value, schedule, audience, budget, features) taken from the prototype's
  `data.js` and ADR 0089. Filters are referenced by id from day one. `core/rules/api.ts` provides
  `list` and `get` over `@/core/api`. The model sits in `core/` because the simulator (514), Priority
  (513) and support (518, 519) read it too, and features never import features.
- The features are `features/campaigns/list/` and `features/campaigns/workspace/`. The workspace holds the
  dashboard and, later, the builder, settings, coupons and versions: one cluster sharing a campaign menu and a draft.

**The HQ contract (BackOffice 2758/2759) is not written yet.** Endpoint paths and shapes are provisional, and
the drive stubs them. Mark the model file `PROVISIONAL — re-point in 520` at its head.

Reference look: [Rule Campaign Builder](https://claude.ai/artifact/CjJjPf21oSSutgmr61w2F5)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\2734-rule-builder\workspace.js`: `CampaignsPage`,
`CampaignShell`, `Dashboard`; sample data in `data.js`), already in palette B.

## Spine reach

model/api (`core/rules`) · store/logic (state derivation, "starts in N days") · component/route (list,
workspace shell, dashboard; router + menu) · i18n (`campaign-list`, `campaign-workspace`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `campaignState_derivesScheduledRunningExpired_fromLocalNow` — the tile a campaign counts under, from its status + schedule at a local now · pure
- [ ] `scheduleRelative_saysStartsInNDays_inLocalDays` — "starts in 3 days" counts local calendar days across a UTC midnight · pure
- [ ] drive `tools/campaigns-drive.mjs` (stubbed): tiles + counts, tile filter, search, row → dashboard with Details/State/Schedule · flow

## Boundaries

New area, nav group and two i18n namespaces registered in `core/i18n.ts`. Provisional endpoints (list,
get), stubbed. No access probe yet (BackOffice 2759 seeds the Ua roles). An `ar` file is created for each new namespace
where the repo already keeps one.

## Done when

Typecheck, lint and vitest are green, and the drive opens a stubbed campaign's dashboard from the list.

## Blocked by

None — can start immediately.

## Open questions

- Ua access for the group: no permission exists until BackOffice 2759 seeds author/approver. Default: the group is
  visible to every user and fails closed on the server, and 520 adds the probe.
