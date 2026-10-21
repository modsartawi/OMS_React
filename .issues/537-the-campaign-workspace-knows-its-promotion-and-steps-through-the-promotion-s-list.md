---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-promotions-brief.md
blocked-by: 535 (BO ask J: BackOffice 2855, for a direct link only)
---

# 537 — The campaign workspace knows its promotion and steps through the promotion's list

> Rewritten by ticket 539 (2026-10-21) to BackOffice 2862's words: promotion, `promotionCode`, `Rules/Authoring/Promotions/*`,
> `RULES_PROMOTION_*`. No scope changed.

## What to build

The brief's D4. The campaign workspace (`/campaigns/:id`) is unchanged but for the way back, Prev / Next and one note.
Contract: the 2848 brief § "The campaign workspace".

- **The list context.** 535 opens a campaign as `/campaigns/:id?promotion=<code>&q=&mechanic=&status=&page=` (`promotion`
  empty = no promotion). The workspace keeps that query on every page of its own menu (dashboard, rules, settings, coupons,
  versions), so it survives moving around inside the campaign.
- **The way back.** The side menu's back link goes to the promotion's page with its filters (`/campaigns/promotions/:code?…`, or
  `/campaigns/no-promotion?…`). The top bar's crumb reads **Promotions › `<promotion>` › `<campaign>`** ("No promotion" for none). The
  crumb is derived from the menu (`layout/crumb.ts`); add the promotion segment there rather than writing a crumb per
  screen.
- **Prev / Next** in the side menu: the neighbours in the promotion's list as filtered, in its order (by id). At a page's
  edge, fetch the neighbouring page (`Promotions/Campaigns` with the same filters); disabled at the list's ends. Hidden
  without a list context.
- **A direct link** (no context): with BO ask J (rows carry `promotionCode`, BackOffice 2855), find the promotion through
  `Promotions/Campaigns { all: true, q: <id> }` and the row whose id equals it exactly. Until it lands: the crumb reads
  **Promotions › `<campaign>`**, the back link goes to `/campaigns`, and Prev / Next are hidden.
- **An uploaded campaign's Rules page** (its promotion is `origin: upload` and its id starts with `<promotionCode>-`) says above
  the rule: "This campaign is part of promotion `<promotionCode>`'s upload. Change it by uploading the promotion again: a change made
  here is replaced by the next upload." A note, not a lock: HQ does not refuse the edit.

## Spine reach

logic (context ↔ URL, neighbour lookup across pages, uploaded-campaign test) · workspace shell + rules page · crumb
· i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [ ] `neighbours`: within a page; at a page's last row Next asks for the next page's first; at the list's ends disabled; no context → none (vitest)
- [ ] `isUploadedCampaign`: `origin: upload` and the `<promotionCode>-` prefix (any case) → true; a hand-made promotion or a campaign without the prefix → false (vitest)
- [ ] `deriveCrumb` gains the promotion segment for `/campaigns/:id?promotion=…`, and "No promotion" for `promotion=` empty (vitest, `crumb.test.ts`)
- [ ] the campaigns drive gains: open a campaign from a filtered promotion page, walk Next across a page boundary, back to the same filtered page; the uploaded campaign's Rules note; a direct link without context. LTR and RTL
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: `Promotions/Campaigns` (BackOffice 2846), plus BO ask J's `promotionCode` for direct links. Stubbed until 538.
- No change to what the workspace edits.

## Done when

The Proof boxes are ticked: from a promotion's filtered page, a campaign shows its promotion in the crumb, steps through the
promotion's list and goes back to the same view.

## Blocked by

[535](535-a-promotion-s-page-lists-its-campaigns-paged-and-filtered-on-the-server.md)
