---
status: done
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

- [x] The upload api tests send and read `promotionCode` (vitest: `uploads/api.test.ts`, `report.test.ts`, `review.test.ts`, 51/51)
- [x] `tools/campaign-uploads-drive.mjs` green in LTR and RTL against the renamed stub (272/272: 136 LTR + 136 RTL, vite on 5197)
- [x] `git grep -i -w deal -- src tools` returns nothing; `git grep -i -w deal -- .issues/53[3-8]-*.md` returns nothing
- [x] `npm run typecheck`, `npm run lint`, `npm test` green (344 files, 5696 tests); `npm run build` green

## Boundaries

- No behaviour change. Closed tickets 530-532 keep their words as a record.

## Done when

The Proof boxes are ticked and 533-538 read in the new words.

## Blocked by

— (deploys with BackOffice 2862)

## Outcome (2026-10-21)

Built AFK. A pure rename, no behaviour change:

- **Wire and model:** `dealCode` → `promotionCode` in `core/models/rule-upload.ts` and every `Uploads/*` body and
  reply in `features/campaigns/uploads/api.ts` (confirmed against pricing2's `RuleCampaignUploadWebEndpoints.cs`).
- **Route:** `/campaigns/uploads/:promotionCode`. **Words:** `campaign-uploads.json`, pages, dialogs, comments, the
  menu model; "the proposed PromotionCode"; "Waiting for approval — promotion X, revision N."; the `Fact` key and
  the `<Trans>` slot are `promotion`. The grid's column is `promotionCode` and its renderer is `PromotionCell`.
- **Drive and tests:** `tools/campaign-uploads-drive.mjs` serves and asserts the new names. Its converter refusal and
  Note copy the server's new text ("One upload is one SAP promotion number; …"). Test codes are `P0`–`P4`.
- **Tracker:** 534-538 were renamed by number (`git mv`), and 533-538 were rewritten to the new words, each with a
  note that it was rewritten. 533 and 538 now also name BackOffice 2862 and script 018. The INDEX lines, links and
  section heading are fixed. 530-532 are unchanged.

Not done here: the deploy with BackOffice 2862, which is a deploy and not a Proof box. Rulings are logged in
`.afk/HITL-539.md`: port 5199 was held by another process, the prototype path is cited through the brief, and the
oms CONTEXT.md rule-engine entry is left to 534.
