---
status: done
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

- [x] `campaignState_derivesScheduledRunningExpired_fromLocalNow` — the tile a campaign counts under, from its status + schedule at a local now · pure
- [x] `scheduleRelative_saysStartsInNDays_inLocalDays` — "starts in 3 days" counts local calendar days across a UTC midnight · pure
- [x] drive `tools/campaigns-drive.mjs` (stubbed): tiles + counts, tile filter, search, row → dashboard with Details/State/Schedule · flow

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

## Comments

**Done 2026-10-16 (AFK).** Built against PROVISIONAL shapes because no HQ contract has been written yet (the brief still has no contract section). Ticket 520 re-points two files: `src/core/models/rule-campaign.ts` and `src/core/rules/api.ts` (`GET RuleCampaign/Campaigns`, `GET RuleCampaign/Campaigns/{id}`).

- **Shared layer:** `core/rules/campaign-state.ts` (pure, used by both features). It derives the state from the stored `status` (draft · waitingForApproval · live · disabled) and the schedule at a local now. It also holds `scheduleRelative`, `daysBetween`, `campaignPath`, the state severities and lifecycle order, and `CampaignStateBadge`. Filters are referenced by id in the model from day one.
- **List** (`features/campaigns/list`): seven tiles (All plus six states) that act as the filter, and a search over the EN name, AR name and code. Both are kept in the URL (`?state=&q=`). The AG Grid has both names, code, state (sorted in lifecycle order), local start/end days, and who created the campaign. A row click or the name link opens `/campaigns/:id`.
- **Workspace** (`features/campaigns/workspace`): a shell with the campaign's side menu, showing Dashboard only because no other page has landed (Coupons is wired to appear only when the coupons feature is on). The shell reads the campaign once and passes it to its pages through the outlet context. The Dashboard shows Details, State and Schedule, read-only, in local days ("Starts in 3 days", "Ends in N days", "Ended today", "No time limit").
- **Wiring:** a new **Campaigns** nav group after Pricing, ungated by ruling; routes `campaigns` and `campaigns/:id` (index = dashboard); namespaces `campaign-list` and `campaign-workspace`, English only by ruling, with no `ar` files.
- **Proof:** the two named tests, which together hold 15 cases in `src/core/rules/campaign-state.test.ts`, with TZ pinned to Asia/Riyadh so the "across a UTC midnight" cases test something on any machine. Also `list-filter.test.ts` (4 tests) and `src/layout/menu-campaigns.test.ts` (4). The drive `tools/campaigns-drive.mjs` uses the prototype's sample campaigns plus three campaigns added for states the samples lack (`tools/campaigns-fixtures.mjs`), with the browser in Asia/Riyadh and a fixed clock. It passes **47/47** on port 5199. The gates were green: typecheck, `npm test` (304 files, 5267 tests), lint (all four gates), and build.
- **Reviews:** `/code-review` and `/standards-review` were both run. Fixed: a disabled campaign was read as live in the Schedule headline; an unknown status is now a draft; state sorts in lifecycle order; an empty EN name shows Untitled; the loading check uses `isPending`; the grid and the tiles now share one clock; the weekday list is isolated; AR names use `<bdi>` with automatic direction; and the path helper and severity map are shared. Left as is: "To campaigns" goes to a bare `/campaigns` (browser Back keeps the filters), and the CONTEXT.md glossary has no "rule campaign" entry yet (`/domain-modeling`).
- **Decisions** are logged in `.afk/HITL-501.md`: until is exclusive, "Would start" when not live, the search also matches the code, and the features have no `api.ts`.
- **Outstanding (not AFK's):** a live-door check (ticket 520); the owner sign-off on the Open-questions default (ungated group, which has been taken); an eyeball of the Arabic rendering of the EN + AR pairs.

