---
status: done
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

- [x] `neighbours`: within a page; at a page's last row Next asks for the next page's first; at the list's ends disabled; no context → none (vitest)
- [x] `isUploadedCampaign`: `origin: upload` and the `<promotionCode>-` prefix (any case) → true; a hand-made promotion or a campaign without the prefix → false (vitest)
- [x] `deriveCrumb` gains the promotion segment for `/campaigns/:id?promotion=…`, and "No promotion" for `promotion=` empty (vitest, `crumb.test.ts`)
- [x] the campaigns drive gains: open a campaign from a filtered promotion page, walk Next across a page boundary, back to the same filtered page; the uploaded campaign's Rules note; a direct link without context. LTR and RTL
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: `Promotions/Campaigns` (BackOffice 2846), plus BO ask J's `promotionCode` for direct links. Stubbed until 538.
- No change to what the workspace edits.

## Done when

The Proof boxes are ticked: from a promotion's filtered page, a campaign shows its promotion in the crumb, steps through the
promotion's list and goes back to the same view.

## Blocked by

[535](535-a-promotion-s-page-lists-its-campaigns-paged-and-filtered-on-the-server.md)

## Comments

**2026-10-21 — built (AFK).**

- **Context ↔ URL** (`core/rules/promotion-query.ts`): `listContextFromUrl`, `listContextSearch`, `withListContext`,
  `listContextBackPath`; 535's `campaignInPromotionPath` now writes through them (same output).
- **Stepping and the upload test** (`features/campaigns/workspace/list-step.ts`): `neighbours`, `neighbourId`, `stepPath`,
  `isUploadedCampaign`, `campaignLookupBody` / `promotionOfLookup` (BO ask J, optional `promotionCode`).
- **Workspace** (`useWorkspaceList.ts`, `CampaignWorkspacePage.tsx`): back link to the promotion's filtered page; Prev / Next
  in the side menu (the neighbouring page read with the same body the promotion page sends, one cache entry); every
  menu link and in-page link keeps the context (`useWorkspace().link`); a bare 403 on the list reads "You do not have
  access to this action."; the Rules page's uploaded note (a note, not a lock).
- **Crumb** (`layout/crumb.ts`, `TopBar.tsx`): a `scope` segment between the screen and the record for `/campaigns/:id?promotion=…`
  ("No promotion" for empty); `crumb.test.ts` + `menu-campaigns.test.ts` (shape gains `scope: null`).
- The promotion reads graduated to `core/rules/promotion-api.ts` (the workspace reads them; features never import features).
- The Coupons page's own URL keys are `search` / `codeStatus` now (they collided with the context's `q` / `status`).

**Proof.** vitest: `list-step.test.ts` (12), `promotion-query.test.ts` (+5), `crumb.test.ts` (+4); full suite 348 files /
5749 tests green; typecheck clean; lint 4/4 clean; build green. Drives (stubbed on the real envelope, port 5299 —
5199 was held by the main checkout's vite): `campaigns-drive` **683/683** — 537's section checks 142–150 in LTR and RTL
(open from FLYER-2610's `q=sun` page, crumb, back, context through every menu page, Next across page 1 → 2 with the
same filters, back to `?q=sun&page=2`, list ends, the uploaded note and its absence, a direct link's fallback, the
ask-J path, a bare 403); earlier checks re-cut only where 537 changed them: 6's way back now lands on the no-promotion
page it came from, 112's coupon URL keys. `campaign-promotions-drive` 180/180, `priority-drive` 50/50,
`sessions-drive` 73/73, `simulator-drive` 71/71 (gained a stub for the direct-link lookup), `campaign-uploads-drive` 272/272.

**Open / outstanding.** BO ask J (BackOffice 2855) is unbuilt: the direct-link path is proven on its fallback and on a
stubbed `promotionCode`; the live walk is 538's. Decisions taken AFK are in `.afk/HITL-537.md` (coupon keys, ask-J path
writes the context into the URL, Prev / Next keep the sub-page, crumb shows the code, no note without a context).
