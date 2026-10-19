---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2862-deal-is-renamed-promotion-everywhere-the-rule-engine-says-it.md
blocked-by: — (live: BackOffice 2862, deployed together)
---

# 539 — "Deal" is renamed "promotion" across the campaign upload screens and the deal tickets

## What to build

The owner renamed **deal** to **promotion** (BackOffice 2862): a promotion is the named set of campaigns (the flyer,
or an ad-hoc set). It is the rule engine's own promotion; the bonus-buy engine's `BbyPromotion` is unrelated here.
BackOffice renames the wire, so this slice renames in lockstep and the two **deploy together**.

- **Wire:** `dealCode` → `promotionCode` in every `Rules/Authoring/Uploads/*` body and reply
  (`core/models/rule-upload.ts`, `features/campaigns/uploads/api.ts`), and the workbook key the screens name
  (`DealCode` → `PromotionCode`). The converted file is `<PromotionCode>.xlsx`.
- **Routes:** `/campaigns/uploads/:dealCode` → `/campaigns/uploads/:promotionCode` (the param name; the path keeps its
  shape).
- **Words:** every "deal" in `locales/en/campaign-uploads.json`, the menu model, the pages, dialogs and tests becomes
  "promotion"; the success line reads "Waiting for approval — promotion X, revision N."
- **Fixtures and drives:** `tools/campaign-uploads-drive.mjs` and its stub serve and assert the new names.
- **The open tickets 533-538** are rewritten to the new contract before anyone builds them: `Rules/Authoring/
  Promotions/*`, `promotionCode`, `RULES_PROMOTION_*`, `core/models/rule-promotion.ts`, feature
  `features/campaigns/promotions/` (namespace `campaign-promotions`), routes `/campaigns/promotions/:promotionCode` and
  `/campaigns/no-promotion`, menu leaf **Promotions**, crumb `Promotions › <promotion> › <campaign>`; their files
  renamed where the slug says deal, INDEX lines and links fixed. The BackOffice brief they cite is renamed
  `2848-oms-react-promotions-brief.md`.

## Spine reach

model · api · route · i18n EN · tests + drive · tracker text

## Proof (→ `tdd` red-green cycles)

- [ ] The upload api tests send and read `promotionCode` (vitest)
- [ ] `tools/campaign-uploads-drive.mjs` green in LTR and RTL against the renamed stub
- [ ] `git grep -i -w deal -- src tools` returns nothing; `git grep -i -w deal -- .issues/53[3-8]-*.md` returns nothing
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- No behaviour change. Closed tickets 530-532 keep their words as a record.

## Done when

The Proof boxes are ticked and 533-538 read in the new words.

## Blocked by

— (deploys with BackOffice 2862)
