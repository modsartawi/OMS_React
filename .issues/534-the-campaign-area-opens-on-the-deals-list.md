---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-deals-brief.md
blocked-by: — (live: BackOffice 2846)
---

# 534 — The campaign area opens on the Deals list

## What to build

**Slice 0 of deals** (BackOffice ADR 0097, tickets 2846–2847, brief 2848, the brief's D1). `/campaigns` stops being
one flat list of every week's ~560 campaigns and becomes the list of **deals**: one row per weekly flyer or ad-hoc
offer set. **The brief is the contract; read it whole before starting**, and the door-by-door shapes in
`C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md` § "HQ contract: deals (2846-2847)". Its
"rules the screens live by" are decided: deal / campaign / rule are the words (never "batch", "week", "promotion",
"offer group"), an uploaded deal owns its campaigns and a hand-made one is a label, grouping writes no version, budgets
are per campaign, `windowUntil` is inclusive.

The owner picked variant 1 (drill-down pages) of the prototype in BackOffice
`.scratch/proto/deal-campaign-rules-navigation/index.html` (key `1`), on the throwaway branch
`proto/deal-campaign-rules-navigation`.

- **Model** `core/models/rule-deal.ts`, field for field from the contract: the deal summary (`Deals/List`), the
  campaign row and page (`Deals/Campaigns`), the record and the assignment (535–536 use them). `state`
  (`live|pending|ended|disabled`), `origin` (`upload|manual`), `uploadState` and the row `status`
  (`Published|Disabled|Pending`) are string unions plus `string`, so an unlisted value still parses. The row's
  optional `dealCode` and `budgets` and the page's optional `withBudget` are BO ask J (BackOffice 2855): typed
  optional now.
- **Feature** `features/campaigns/deals/` (namespace `campaign-deals`, registered in `core/i18n.ts`, EN only like
  the area's other namespaces), `api.ts` with `list()` → `Rules/Authoring/Deals/List`.
- **`/campaigns` is the Deals list** (the route's component changes; `CampaignListPage` stops being it — 535 retires
  the rest of it):
  - one row per deal in the reply's order: `dealCode` with `nameEn` / `nameAr` (the code alone when both are
    empty), kind **Uploaded** / **Hand-made** from `origin`, window (inclusive days, `formatRange`), `campaignCount`,
    `skuCount`, a **state badge** (an unlisted state renders as `disabled`), `liveVersionNo` when live, and for an
    uploaded deal `revision`, `uploadState`, `uploadedBy`, `approvedBy`;
  - the **no-deal row** last (`dealCode: null`), labelled "No deal", opening `/campaigns/no-deal`;
  - a row opens `/campaigns/deals/:dealCode` (535 builds the page; a placeholder until then);
  - action **Upload a deal** → `/campaigns/upload` (530). **New deal** is 536's.
- **Menu:** the leaf that reads "Campaigns" reads **Deals** and keeps owning `/campaigns/*`.
- **Grants:** no probe. A bare 403 reads "You do not have access to this action", never an empty list.

## Spine reach

model (`core/models/rule-deal.ts`) · api (feature `api.ts`) · logic (deal row view: badge, kind, window, the no-deal
label) · route + menu + page · i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [ ] `dealRowView`: each of the four states gives its badge and an unknown one gives `disabled`; `upload` / `manual` give their kind; the no-deal row reads "No deal" and links `/campaigns/no-deal`; empty names show the code alone (vitest)
- [ ] `windowDays` (or the shared helper): a deal's `windowUntil` is shown as sent, the inclusive last day; a null window shows none (vitest)
- [ ] `tools/campaign-deals-drive.mjs`, LTR and RTL, against a stub serving `Deals/List` with a live, a pending, an ended, a disabled and a hand-made deal plus the no-deal row, and a bare 403: the badges, the order, the no-deal row last, Upload a deal's link, the 403 message
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: `Rules/Authoring/Deals/List` (BackOffice 2846, built). Stubbed until 538.
- New namespace `campaign-deals`; `/campaigns`'s component changes; the menu leaf's label changes.

## Done when

The Proof boxes are ticked: on the running app (stubbed), `/campaigns` lists the deals with their state and the
no-deal row, and a row opens its deal's address.

## Blocked by

—

## Open questions

- The old list's state tiles (drafts / scheduled / running / expired / disabled across every campaign) have no place
  in variant 1. Default: they go with the flat list. Overrulable.
