---
status: done
spec: BO 2737 (brief § HQ contract: campaign coupons (2755))
blocked-by: 522
---

# 526 — Coupons call the real batch doors

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17.

## What to build

Re-point 515/516 (all POST, `Rules/Authoring/CouponBatches/*`):

- **Create `{ templateId, kind: random|universal|personal|import, count?, code?, members?, csv?, validFrom?,
  validTo?, eachCodeOnce, oncePerCustomer }`**. Import is the same door with `kind: import` and `csv`
  (`code[,customerId]`). **There is no pre-import check door**: drop `checkCouponImport` and show the
  refusal instead (`RULES_BATCH_BAD` names the bad member ids, `RULES_BATCH_CODE_TAKEN`). The reply carries
  `budgets`, the coupon / profile budgets the builder **adds to the campaign** and saves as the draft (ADR
  0094). Wire that.
- **`List { campaign }`** answers batches (`codes`, `used`, `disabled` counts) and **not codes**. 515's
  per-code grid has no door. The codes come from `Export { batchId }` (`csv`). Either the page lists batches
  and a batch opens its exported codes, or ask BO for a codes door. Grill this.
- **`Export { batchId }`** answers `{ fileName, csv }`: save the server's CSV as is, and drop the client CSV
  writer for this export.
- **`DeleteUnused { batchId }`** answers `{ deleted, kept }`.
- `templateId` is a SIS.Coupons template. Find out where the screen gets it (the campaign's coupon effect?)
  while building.

## Spine reach

api · logic (coupon-form, coupon-csv) · component (CouponsPage, dialogs) · test

## Proof (→ `tdd` red-green cycles)

- [x] `couponForm_buildsCreateBody` for all four kinds · pure (`coupon-form.test.ts`; plus `coupon-csv.test.ts` for the import rows and the export read)
- [x] coupons drive re-stubbed, green · flow (`tools/campaigns-drive.mjs` 638/638 on the real CouponBatches shapes; priority 50/50, simulator 71/71, sessions 73/73 on the shared fixtures)

## Done when

The coupons page calls only the four real doors, and its drive is green stubbed.

## Comments

**2026-10-18 — done (AFK).** The coupons page calls only `Rules/Authoring/CouponBatches/{Create,List,Export,DeleteUnused}`, all POST.
- **Model / api:** the old `RuleCampaignCoupon`, the shape fields, `RuleCouponImportCheck` and `RuleCouponUnusedDeleted` are gone, along with the `RuleCampaign/Campaigns/{id}/Coupons*` methods and their PROVISIONAL marks. The new types are copied from `RuleCouponBatchService`. 519's finder and Members doors are untouched, still PROVISIONAL (529's).
- **Page:** it lists batches. Opening one (`?batch=`) reads its codes from Export's CSV, which gives search, a status filter, and Expired from a code's own `validTo`. Export saves HQ's csv as is under HQ's `fileName`, so the client writer is gone.
- **Create:** the template id is typed, filled in from the newest batch. It has the two limit boxes. The reply's `budgets` are added to the draft (whole Drafts/Save, de-duplicated by id), and a refused save is shown with "Add them again".
- **Import:** it uses Create with `kind: import`, sending the good rows as `code[,customerId]` lines. HQ's all-or-none refusals are shown as is.
- **Delete unused:** it uses the List counts and goes back to the batch list when HQ empties the batch.
- **Decisions:** logged in `.afk/HITL-526.md`. **New BO ask I:** no door names a campaign's coupon template, and Create does not check that the template belongs to the campaign. Also still open: an import dry-run and a codes door with paging (2755).
- **Drive assertions dropped, with reasons:** 126 (filtered export, no door) and 129's per-row HQ reasons (no check door; now 131's whole-import refusals).
- **Outstanding, not this ticket's:** the live walk on staging (520) and owner sign-off on the HITL defaults.
