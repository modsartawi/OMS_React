---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-promotions-brief.md
blocked-by: — (live: BackOffice 2846)
---

# 534 — The campaign area opens on the Promotions list

> Rewritten by ticket 539 (2026-10-21) to BackOffice 2862's words: promotion, `promotionCode`, `Rules/Authoring/Promotions/*`,
> `RULES_PROMOTION_*`. No scope changed.

## What to build

**Slice 0 of promotions** (BackOffice ADR 0097, tickets 2846–2847, brief 2848, the brief's D1). `/campaigns` stops being
one flat list of every campaign (~560 a weekly flyer) and becomes the list of **promotions**: one row per weekly flyer or ad-hoc
offer set. **The brief is the contract; read it whole before starting**, and the door-by-door shapes in
`C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md` § "HQ contract: promotions (2846-2847)". Its
"rules the screens live by" are decided: promotion / campaign / rule are the words (never "batch", "week", "offer
group", nor the word BackOffice 2862 retired; "promotion" alone never means one campaign or a bonus buy), an uploaded
promotion owns its campaigns and a hand-made one is a label, grouping writes no version, budgets are per campaign,
`windowUntil` is inclusive. This promotion is the rule engine's (`RulePromotion…` where a bare `Promotion` could be
confused); the bonus-buy engine's `BbyPromotion`, `features/*bby*` and every "applied" or "web" promotion are a
different concept and are not touched.

The owner picked variant 1 (drill-down pages, key `1`) of the navigation prototype the 2848 brief names; the brief
gives its folder under BackOffice `.scratch/proto/` and its throwaway `proto/` branch.

- **Model** `core/models/rule-promotion.ts`, field for field from the contract: the promotion summary (`Promotions/List`), the
  campaign row and page (`Promotions/Campaigns`), the record and the assignment (535–536 use them). `state`
  (`live|pending|ended|disabled`), `origin` (`upload|manual`), `uploadState` and the row `status`
  (`Published|Disabled|Pending`) are string unions plus `string`, so an unlisted value still parses. The row's
  optional `promotionCode` and `budgets` and the page's optional `withBudget` are BO ask J (BackOffice 2855): typed
  optional now.
- **Feature** `features/campaigns/promotions/` (namespace `campaign-promotions`, registered in `core/i18n.ts`, EN only like
  the area's other namespaces), `api.ts` with `list()` → `Rules/Authoring/Promotions/List`.
- **`/campaigns` is the Promotions list** (the route's component changes; `CampaignListPage` stops being it — 535 retires
  the rest of it):
  - one row per promotion in the reply's order: `promotionCode` with `nameEn` / `nameAr` (the code alone when both are
    empty), kind **Uploaded** / **Hand-made** from `origin`, window (inclusive days, `formatRange`), `campaignCount`,
    `skuCount`, a **state badge** (an unlisted state renders as `disabled`), `liveVersionNo` when live, and for an
    uploaded promotion `revision`, `uploadState`, `uploadedBy`, `approvedBy`;
  - the **no-promotion row** last, told by `promotionCode: null` (never by `origin`: a row whose code is neither a record nor an
    upload comes with `origin: null` and gets no kind), labelled "No promotion", opening `/campaigns/no-promotion`;
  - a row opens `/campaigns/promotions/:promotionCode` (535 builds the page; a placeholder until then);
  - action **Upload a promotion** → `/campaigns/upload` (530). **New promotion** is 536's.
- **Menu:** the leaf that reads "Campaigns" reads **Promotions** and keeps owning `/campaigns/*`.
- **Grants:** no probe. A bare 403 reads "You do not have access to this action", never an empty list.

## Spine reach

model (`core/models/rule-promotion.ts`) · api (feature `api.ts`) · logic (promotion row view: badge, kind, window, the no-promotion
label) · route + menu + page · i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [x] `promotionRowView`: each of the four states gives its badge and an unknown one gives `disabled`; `upload` / `manual` give their kind; the no-promotion row (by `promotionCode: null`) reads "No promotion" and links `/campaigns/no-promotion`; a row with a `promotionCode` and `origin: null` has no kind; empty names show the code alone (vitest)
- [x] `windowDays` (or the shared helper): a promotion's `windowUntil` is shown as sent, the inclusive last day; a null window shows none (vitest)
- [x] `tools/campaign-promotions-drive.mjs`, LTR and RTL, against a stub serving `Promotions/List` with a live, a pending, an ended, a disabled and a hand-made promotion plus the no-promotion row, and a bare 403: the badges, the order, the no-promotion row last, Upload a promotion's link, the 403 message
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: `Rules/Authoring/Promotions/List` (BackOffice 2846, built). Stubbed until 538.
- New namespace `campaign-promotions`; `/campaigns`'s component changes; the menu leaf's label changes.

## Done when

The Proof boxes are ticked: on the running app (stubbed), `/campaigns` lists the promotions with their state and the
no-promotion row, and a row opens its promotion's address.

## Blocked by

—

## Open questions

- The old list's state tiles (drafts / scheduled / running / expired / disabled across every campaign) have no place
  in variant 1. Default: they go with the flat list. Overrulable.

## Comments

**2026-10-21, built (AFK).** Done when holds on the stubbed app.

- Proof: `src/features/campaigns/promotions/promotion-row.test.ts` (the badge for each of the four states and an
  unknown one, kind from origin, the no-promotion row by `promotionCode: null`, a stray code with `origin: null`
  has no kind, the code alone with empty names, the live version only when live, the upload facts, the window
  inclusive and none when null); `windowDays` / `dayOf` graduated to `src/core/rules/wire-days.ts` (the upload
  screens import it; their tests moved to `wire-days.test.ts`, none deleted). `tools/campaign-promotions-drive.mjs`
  **82/82, LTR + RTL**, stubbed `Promotions/List` on the real envelope (live, pending, ended, disabled, hand-made, a
  stray code with an unlisted state, the no-promotion row; a bare 403). `tools/campaign-uploads-drive.mjs` still
  272/272. typecheck, lint (4 gates), `npm test` (5711) and build green.
- `/campaigns/promotions/:promotionCode` and `/campaigns/no-promotion` are a placeholder for 535: the promotion's
  header from its List row, a stale code's "no such promotion", the bare 403's message, the way back.
- The menu leaf's key is `campaign-list:menu.promotions` ("Promotions"); `promotions` and `no-promotion` are reserved
  campaign ids; CONTEXT.md gains the rule engine's **Promotion** beside the bonus-buy one.
- **Left for 535 (by this ticket's split):** `CampaignListPage` is unrouted but still in the tree, so New campaign /
  From a template have no entry point until 535 moves them to the no-promotion page; `tools/campaigns-drive.mjs`
  stops at its first flat-list check (`waitRows` on `/campaigns`), which 535 re-cuts; the promotions query is not yet
  invalidated by an upload's Activate (it refetches on mount). **Left for 537:** the workspace's "To campaigns" back
  link still goes to `/campaigns`.
- Open question ruled by its default: the old list's state tiles went with the flat list.
- Decisions in `.afk/HITL-534.md`. Outstanding (not this ticket's): the live walk is 538.

