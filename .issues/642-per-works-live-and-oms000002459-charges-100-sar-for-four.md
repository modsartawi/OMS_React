---
status: open
spec: 639 (server half BackOffice 3181)
blocked-by: 640, 641, BackOffice 3181 (deployed)
---

# 642 — Per works live, and OMS000002459 charges 100 SAR for four

## What to build

Swap 640's stubs for BackOffice 3181's live doors, and reconcile any spelling 3181 changed (its
Comments on spec 639). Then walk it with the owner on a live SIS.Api. Staging is preferred; a local
walk counts when the owner rules it does, as for 638.

## Spine reach

api (live doors, stubs retired from the walk) · walk

## Proof

- [ ] The drive runs green against the live SIS.Api (read-only where it can be; the writes go to a throwaway Planned bonus buy).
- [ ] **OMS000002459 fixed by hand:** Back to Planned → Per 4 on its get line → Mark Tested → Activate. The simulator prices four units of 204612 at **100.00 SAR** in total.
- [ ] A From-scale copy (From 4, P 100, Per 4) prices six units at **150.00**.
- [ ] Opening and saving an SAP-sourced bonus buy with `KPEIN` > 1 keeps its Per.
- [ ] A file using column 25 `PER` uploads, and a bad `PER` value is refused with its row number.
- [ ] Per 0 and Per 1.5 are refused as `BBY-PRICING-UNIT` in English and Arabic.

## Boundaries

No new UI. A defect found here goes back to 640/641 or to BackOffice 3181.

## Done when

Every Proof box is ticked on the owner's walk, and OMS000002459 is live at 100 SAR for four.

## Blocked by

[640](640-the-editor-reads-edits-and-saves-a-get-lines-per.md), [641](641-each-price-or-amount-get-line-shows-what-the-till-will-charge.md), BackOffice [3181](C:\Work\DMSCO\BackOffice\.issues\3181-a-bonus-buy-get-line-price-or-amount-is-set-per-n-units.md) deployed
