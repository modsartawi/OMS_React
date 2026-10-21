---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-promotions-brief.md
blocked-by: 534 (live: BackOffice 2846)
---

# 535 — A promotion's page lists its campaigns, paged and filtered on the server

> Rewritten by ticket 539 (2026-10-21) to BackOffice 2862's words: promotion, `promotionCode`, `Rules/Authoring/Promotions/*`,
> `RULES_PROMOTION_*`. No scope changed.

## What to build

The brief's D2. A promotion's campaigns on their own page, paged and filtered by HQ (`Rules/Authoring/Promotions/Campaigns`),
and the end of the composed campaigns list. Contract: the 2848 brief § "a promotion's page" and § "What this retires", and
the 2737 brief's `Promotions/Campaigns` row.

- **Routes** `/campaigns/promotions/:promotionCode` and `/campaigns/no-promotion` (static leaves beside `campaigns/:id`, which
  react-router ranks above the param), one page component; the no-promotion page sends `promotionCode: null`.
- **Header** from the promotion's row of 534's `Promotions/List` query (there is no single-promotion door): code, both names, kind,
  window, state badge, `liveVersionNo`, `note` (and `uploadNote` when it differs).
- **Tiles:** campaigns (`campaignCount`, with "+N pending" when the unfiltered `total` is larger: a pending
  re-upload's new campaigns are rows but not yet in the promotion's counts), SKUs (`skuCount`), generated Arabic names (the page's `generatedNames`),
  and **with a budget** only when the page answers `withBudget` (BO ask J, BackOffice 2855); hidden otherwise.
- **Filters, all in the URL** (`?q=&mechanic=&status=&page=`): a search box → `q` (id and both names, Arabic works);
  **mechanic chips** from `mechanics` (every key, `builder` included) plus "All"; a **status** filter
  (`Published`, `Disabled`, `Pending`). A changed filter goes back to page 1.
- **The table**, AG Grid, paged on the server (`pageSize` 50; `total` drives the pager): `id`, `nameEn` / `nameAr`
  with a "generated" badge on `nameArGenerated`, `mechanic`, `skuCount`, **`ruleCount`**, window (inclusive),
  `status`. A row opens `/campaigns/:id` **with the list context** (`?promotion=<code>&q=&mechanic=&status=&page=`; 537
  reads it).
- **An uploaded promotion:** **Re-upload** (→ `/campaigns/upload`) and **Its upload** (→ `/campaigns/uploads/:promotionCode`,
  532). No assign, unassign or delete.
- **The no-promotion page:** **New campaign** (`CreateCampaignDialog`) and **From a template** (`FromTemplate`) move here
  from the old list. Above the table, the **drafts never published**: the `Drafts/List` rows with
  `publishedVersionNo` 0 (as `composeCampaignList` reads it today), shown as "Draft, never published". They are in
  no promotion until published and cannot be assigned before.
- **A 404 `RULES_PROMOTION_NOT_FOUND`** (a stale link) says so and links back to `/campaigns`.
- **Retire 524's composition:** `composeCampaignList` and `ruleCampaignApi.list()` / `ruleCampaignsQuery` go, with
  `CampaignListPage`, `list/columns.tsx` and `list-filter.ts`. Their other readers stop reading the composed list:
  `CreateCampaignDialog`, `FromTemplate` and `CopyCampaignDialog` drop the id pre-check and rely on HQ's 409
  `RULES_CAMPAIGN_EXISTS` (already shown). `PriorityPage` keeps its state badges and feature chips, which neither
  `Order.campaigns` nor `Promotions/Campaigns` answers: the composition moves into `features/campaigns/priority/` as its
  own reader (no longer the area's list). The mutations that
  invalidated `ruleCampaignsQuery` invalidate the promotions queries instead.

## Spine reach

api (feature `api.ts`: `campaigns(query)`) · logic (URL ↔ query, chip view, never-published drafts) · route + pages
· list removal across `core/rules` and `features/campaigns/{list,priority,workspace}` · i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [ ] `promotionQueryFromUrl` / `urlFromPromotionQuery`: round-trip; a changed filter resets `page` to 1; `no-promotion` sends `promotionCode: null` (vitest)
- [ ] `mechanicChips`: every `mechanics` key becomes a chip with its count, `builder` and unknown keys included, plus "All" with the sum (vitest)
- [ ] `neverPublishedDrafts`: a draft with `publishedVersionNo` > 0 is not listed; one with 0 is (vitest)
- [ ] `tools/campaign-promotions-drive.mjs` gains: a 560-campaign promotion paged, a mechanic chip and a status filter narrowing it, an Arabic search, Back restoring the filters, an uploaded promotion's Re-upload / Its upload links, the no-promotion page's New campaign and a never-published draft, a stale promotion link's 404. LTR and RTL
- [ ] The campaigns drive (`tools/campaigns-drive.mjs`) re-cut where it read the flat list, with reasons in this ticket
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green; no reader of the composed list left outside Priority

## Boundaries

- Doors: `Promotions/Campaigns` (BackOffice 2846), `Drafts/List` (2759). Stubbed until 538.
- Removes the flat campaigns list; its composition survives only as Priority's reader.
- `/campaigns/no-promotion` is a static leaf, so it shadows a campaign whose id is literally `no-promotion` (ids allow it). Accepted: no
  campaign carries that id today; if one ever does, its workspace is unreachable until it is copied to another id.

## Done when

The Proof boxes are ticked: on the running app (stubbed), a promotion opens on its campaigns, filters and pages on the
server, and no screen composes the campaigns list any more.

## Blocked by

[534](534-the-campaign-area-opens-on-the-promotions-list.md)

## Open questions

- **The id pre-check goes.** Create, Copy and From a template no longer warn about a taken id before sending; HQ's 409
  `RULES_CAMPAIGN_EXISTS` does. Default, overrulable: rebuilding the whole list in the browser (`{ all: true }` paged
  at 200) to keep the pre-check costs one read per 200 campaigns of every promotion ever kept, growing each week.
