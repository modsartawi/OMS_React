---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-deals-brief.md
blocked-by: 534, 535, 536, 537 (live: BackOffice 2846–2847 deployed, HQ script 017 run)
---

# 538 — The deal screens call the real doors on staging

## What to build

The brief's D5: the live walk. No new screen. The stubs come off and the screens meet the real
`Rules/Authoring/Deals/*` doors.

**Before it can run (owner acts):**
- BackOffice 2846 and 2847 deployed to the SIS.Api the walk uses (and 2855 for the direct-link crumb and the budget
  tile, when it lands);
- the HQ script `Sartawi.Retail.Data/Modules/Rules/Sql/017_create_rule_deal.sql` run on that HQ database (after 015
  and 016; it is idempotent and backfills the deals of existing uploads);
- an author (`RULE_AUTHOR`), and at least one activated upload (533's walk leaves one).

**The walk:**
1. Open `/campaigns`: the activated upload's deal is `live` with its counts, and the no-deal row is last.
2. Open that deal: page through it, narrow it by a mechanic chip and by status, find a campaign by its Arabic name.
3. Open a campaign from the filtered page: the crumb names the deal; Next across a page boundary; back to the same
   filtered page. The Rules page shows the upload note.
4. Create a hand-made deal, assign two hand-built campaigns: they leave the no-deal page.
5. Assign an uploaded campaign to it: `RULES_DEAL_OWNED`, nothing changes.
6. Unassign both and delete the deal.

Record each step's request and reply (status, code) in this ticket. Any mismatch between the contract and the wire
becomes a finding here, and a BackOffice ask when HQ owns it.

## Spine reach

test (live drive + owner walk). Code changes only where the wire differs from the stubs.

## Proof

- [ ] `tools/campaign-deals-drive.mjs` run against the live doors (no stubs), steps 1–6 green
- [ ] Each step's request and reply recorded here

## Boundaries

- Doors: `Rules/Authoring/Deals/*` (BackOffice 2846–2847), live. No stubs.
- Writes on staging only: one hand-made deal, created and deleted by the walk.

## Done when

The walk is green on staging and recorded here.

## Blocked by

[534](534-the-campaign-area-opens-on-the-deals-list.md), [535](535-a-deal-s-page-lists-its-campaigns-paged-and-filtered-on-the-server.md),
[536](536-an-author-makes-a-deal-by-hand-and-assigns-campaigns-to-it.md),
[537](537-the-campaign-workspace-knows-its-deal-and-steps-through-the-deal-s-list.md)
