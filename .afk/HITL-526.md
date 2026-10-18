# HITL — ticket 526 (coupons on the real CouponBatches doors)

## Q: List answers batches, not codes — where do a batch's codes come from?
**Decision taken:** Settled default applied: the page lists BATCHES (`CouponBatches/List`: template, codes, used, disabled, created at / by) with a search over the batch id or template. Opening a batch (`?batch=`) reads its codes from `CouponBatches/Export`'s CSV, parsed on the client (`readBatchCsv`), with a code / member search and a status filter.
**Why:** No codes door exists; Export carries every code with its flags and days.
**Revisit if:** BO adds a codes door (or paging for a 10,000-code batch). Export reads the whole batch each time a batch opens.

## Q: Export
**Decision taken:** Settled default applied: Export saves HQ's `csv` exactly as HQ wrote it, under HQ's `fileName` (`coupons-<batchId>.csv`), with no BOM added. Every press calls the door again. The client CSV writer (`couponCsv`) is gone. So is 516's "export the filtered list": HQ exports a whole batch.
**Why:** Ticket 526: "save the server's CSV as is, and drop the client CSV writer for this export".
**Revisit if:** The owner wants Excel to open the file as UTF-8 (HQ would add the BOM), or a filtered export back.

## Q: Where does `templateId` come from?
**Decision taken:** It is typed. Create and Import have a "Coupon template" field, filled in with the newest batch's `templateId` (List answers it). A campaign with no batch yet starts empty, and the author types the SIS.Coupons template id once.
**Why:** No door in the contract names a campaign's coupon template. Drafts/Load, the catalogue and the lookups carry none. `CouponTemplate.CampaignId` exists only in SIS.Coupons. A coupon condition matches a code or a prefix, not a template. A `createCoupon` effect's `template` is for codes minted at close, and can be another campaign's (NEXT-VISIT mints from WKND20's).
**Revisit if:** **BO ask I (new; F is 523's, G and H are 525's):** name the campaign's coupon template(s) on a door, e.g. `templates: [...]` on Drafts/Load or a `couponTemplates` lookup narrowed by campaign. A template also has to be created somewhere: today only SIS.Coupons' own admin can set `CampaignId`, and oms-react's coupon-template screens do not.

## Q: Create does not check that the template is THIS campaign's
**Decision taken:** HQ's Create accepts any campaign-owned template and answers its `campaign`. When the answer names another campaign, the success modal says the batch is listed under that campaign. It offers no "Show the codes" and adds no budget here. Nothing else is guarded on the client.
**Why:** `RuleCouponBatchService.CreateAsync` reads `CampaignId` from the template and never compares it with anything. The client has no campaign field to send.
**Revisit if:** **BO ask I (cont.):** Create should take `campaign` and refuse a template that campaign does not own (`RULES_BATCH_TEMPLATE`).

## Q: The dialog's redemption limits (515 had none; 2755 has `eachCodeOnce` / `oncePerCustomer`)
**Decision taken:** Two boxes, "Each code works once" and "Once per customer", as in the 2734 prototype. Both start unticked. "Each code once" is not offered for a universal code. A box shows ticked and disabled ("a coupon budget already does this") when the campaign already has a budget of 1 use for its lifetime at that scope; a covered box is not sent. HQ answers the boxes as `budgets`. The page then adds the ones the draft does not have (by id) and saves the WHOLE draft at its revision (Drafts/Save). The modal names them, or shows HQ's refusal with "Add them again". Import sends both as false.
**Why:** ADR 0094 and the brief: "budgets the builder adds to the campaign". This reverses 515's "no limit field anywhere": that was written with no contract.
**Revisit if:** The owner wants the boxes ticked by default, or wants them on Import too. Also if a pending draft (RULES_DRAFT_PENDING) should hold the create back, rather than leaving the codes made and the budget off the draft. Today the modal says so and Settings ▸ Budgets can add it later.

## Q: Expired codes
**Decision taken:** A code reads "Expired" only when its OWN `validTo` (from the export) is before the reader's local day. A code with no day of its own follows the template's window, which no door answers, so it never reads expired. "Expired" is a status filter value.
**Why:** HQ no longer answers a status. Showing a dead code as "Unused" was a review finding.
**Revisit if:** HQ puts the template's window, or a status, on the export.

## Q: Client checks HQ also makes
**Decision taken:** The client checks what it can know before sending, at the field: a code and a member id match HQ's rule (letters, digits and `- _ .`, a letter or digit first; a code at most 64, a member id at most 26). It also checks one batch's cap (10,000, `CreateCampaignCouponsRequest.MaxCoupons`, where 515 had 5,000) and a template of at most 26 characters. A taken code and an unknown member are HQ's refusals, shown verbatim (`RULES_BATCH_CODE_TAKEN`, `RULES_BATCH_BAD` naming the ids). A universal code may be left blank, and HQ then generates it with the template's prefix. 515's prefix / suffix / length / charset fields are gone: HQ's template shapes the codes. Codes are still upper-cased as typed (515's ruling).
**Why:** The source wins over the brief and over 515's invented bounds. No pre-import check door exists.
**Revisit if:** HQ adds a dry-run flag on import (the old 2755 ask), so the preview can mark taken codes and unknown members per row again.

## Q: Delete unused's confirmation counts
**Decision taken:** It says "Delete the N codes of batch X nobody used?" with N = codes − used from List. It also says the used codes stay, "and so does a code a sale still paying holds". The page then reports HQ's own `deleted` / `kept`. A batch the delete empties disappears from HQ, and the page goes back to the batch list.
**Why:** List has no unused count. HQ also keeps codes a paying sale holds, so N is an upper bound.
**Revisit if:** HQ adds an `unused` count to List.

## Q: Drive assertions that changed meaning
**Decision taken:** 515/516's checks were re-cut, not dropped, except these, which have no door any more: 126 (export the filtered list) went with the client writer. 129's "taken by the campaign / in SIS.Coupons / unknown member" per-row reasons became 131's whole-import refusals. The per-code "kind" and "uses" columns are gone: the export has neither, only `used` yes/no. New checks: 141 (a refused draft save keeps the budget off the draft), 120's other-campaign template, and 132's emptied batch.
**Why:** Ticket rule: a deleted assertion needs a reason.
**Revisit if:** —

## Q: Import still leaves bad rows out on this side (standards-review spec axis)
**Decision taken:** Kept 516's preview. Rows with no code, a code or member id HQ would not take, a repeat, or more than 10,000 are shown with their reason and left out. The good rows are sent, and HQ's all-or-none refusal covers the rest.
**Why:** HQ would refuse the whole file for any one of those rows, so leaving them out locally is the 516 ruling ("rejected rows left out"), and the modal says how many were left out.
**Revisit if:** The owner wants an import to be exactly the file, refused whole on any bad row.
