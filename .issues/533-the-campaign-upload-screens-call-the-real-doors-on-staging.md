---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2839-oms-react-campaign-upload-brief.md
blocked-by: 530, 531, 532 (live: BackOffice 2836–2838 and 2862 deployed, HQ scripts 015 then 016 run, and 018 where an older 015 already ran)
---

# 533 — The campaign upload screens call the real doors on staging

> Rewritten by ticket 539 (2026-10-21) to BackOffice 2862's words: promotion, `promotionCode`, `Rules/Authoring/Promotions/*`,
> `RULES_PROMOTION_*`. No scope changed.

## What to build

The brief's U4: the live walk. No new screen. The stubs come off and the screens meet the real
`Rules/Authoring/Uploads/*` doors.

**Before it can run (owner acts):**
- BackOffice 2836–2838 and 2862 (the rename this screen ships with, oms-react 539) deployed to the SIS.Api the walk uses;
- the HQ scripts `Sartawi.Retail.Data/Modules/Rules/Sql/015_create_rule_upload_batch.sql`, then
  `016_alter_rule_upload_batch_review.sql`, run on that HQ database, and on a database where 015 ran before
  BackOffice 2862, `018_rename_rule_deal_to_promotion.sql` after them (a no-op on a fresh one);
- two users: an author (`RULE_AUTHOR`) and a **different** approver (`RULE_APPROVER`).

**The walk:**
1. Convert the owner's sample `Same GRP - 50 Pct.txt` (531). Open the workbook, check the proposed
   PromotionCode and the `Convert notes` sheet, and upload it (530). It is accepted and pending.
2. As the same author, Activate it: 403 `RULES_SELF_APPROVAL`, shown in the dialog.
3. As the approver, open it (532): every campaign is new and none is disabled. Activate it, and the new
   version appears in the campaigns' Versions view.
4. Upload the same promotion again with one campaign row removed. The opened upload shows that campaign in the
   disabling list before activating. Activate it, and the campaign is disabled.
5. Upload a workbook with an error on each sheet. The all-or-none message shows, and nothing new is
   pending.

Record each step's request and reply (status, code) in this ticket. Any mismatch between the contract and
the wire becomes a finding here, and a BackOffice ask when HQ owns it.

## Spine reach

test (live drive + owner walk). Code changes only where the wire differs from the stubs.

## Proof

- [ ] `tools/campaign-uploads-drive.mjs` run against the live doors (no stubs), steps 1–5 green
- [ ] owner walk of steps 1–5

## Boundaries

Live only. A wire drift found here is fixed in 530–532's code, with a note on the ticket.

## Done when

Steps 1–5 pass on staging (or on a local SIS.Api, if the owner rules it stands in, as for 455) and the
owner has walked them.

## Blocked by

[530](530-an-author-uploads-a-campaign-workbook-and-reads-its-all-or-none-report.md),
[531](531-an-author-converts-a-sap-bby-file-into-a-campaign-upload-workbook.md),
[532](532-an-approver-activates-or-sends-back-a-campaign-upload-as-a-whole.md)
