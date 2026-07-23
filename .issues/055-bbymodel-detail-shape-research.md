---
type: wayfinder-ticket
wayfinder: research
map: 053
status: done
blocked-by: —
---

# 055 — Research: full BbyModel detail shape for the Details modal

## Question

Produce a complete **field inventory of the `BbyModel` graph** that the SAP "Display Bonus Buy"
detail view renders, so the detail-endpoint contract (ticket 058) and the detail-modal prototype
(ticket 060) can be specified from data, not guesses. Capture as a linked `/research` Markdown asset.

Read and inventory:
- `BbyModel`, `BbyCondModel`, `BbyPrereqModel`, `BbyCond000Model` (Get-side per-material expansion),
  and the row VMs in `BonusBuyDetailController.cs` (`BonusBuyDetailBuyRow`, `BonusBuyDetailGetRow`,
  `BonusBuyGroupMemberRow`).
- `IBonusBuyRepository.GetBonusBuyByNumber` — where it lives, what it returns, whether it can be
  surfaced through a SIS.Api read endpoint (serialization, dependencies).
- The Buy grid (prereqs incl. material-grouping members via `MatGrouping`/`MatGroupingStatus`), the
  Get grid (conditions, `DiscountType`, scale, `ConditionType`), and the `Document` total-discount
  branch.

Deliverable: the field list per section (Header / Org / Buy / Get / grouping members), noting which
fields exist only in `BbyModel` (not `BbyHeader`), and whether `IMaterialInfoRepository` description
enrichment is needed server-side. Explicitly **exclude** the live-basket `LiveStatus` join.

## Answer

Full field inventory captured as a linked asset: **[055-bbymodel-field-inventory.md](055-bbymodel-field-inventory.md)**.

Key findings that shape the detail contract (ticket 058) and modal prototype (ticket 060):

- **Only three child collections justify a detail endpoint.** Every `BbyModel` header scalar is already
  on the flat `BbyHeader` (so the list endpoint, ticket 057, covers them). The detail endpoint exists
  purely for `Prereqs` (Buy grid), `Conditions` (Get grid / total-discount), and `ItemConditions`
  (per-material expansion). `StackableOrder` is the one BbyModel-only header field (computed, not
  surfaced by the view).
- **`GetBonusBuyByNumber(string) : Task<BbyModel>`** returns a plain Dapper-mapped POCO tree — all child
  collections populated, no NHibernate/EF lazy proxies, no cycles → **serializes cleanly to JSON as-is.**
  `Conditions` is a `Dictionary<CondNumber, BbyCondModel>`; recommend flattening to an array on the wire.
  It's already cached per-BBY (`CachedBonusBuyRepository`, FusionCache).
- **Org fields are NOT on `BbyModel`.** SalesOrg / DistChannel / Plant / Currency come from the WPF
  caller's `PcHeader`, not the model. The detail endpoint must either project them separately or the
  modal carries them from the list row — a decision for ticket 058.
- **Material `Description` is not a model field.** WPF enriches client-side via `IMaterialInfoRepository`,
  batched once. Recommend folding enrichment **server-side** into the new endpoint (attach `description`
  inline per row) since the SPA has no equivalent repo. Also a 058 decision.
- **Two pre-existing BackOffice defects to design around** (flagged for 058, not fixed here):
  (1) `LoadBbyModel` queries `BbyCond201` twice — `BbyCond202` is never actually loaded (copy-paste bug);
  (2) free-goods BBYs (`DiscountType "N"`) throw `ArgumentException` in the server-side `ConditionType`
  derivation — such BBYs would 500.
- **Code sets to carry into the DTO contract:** BbyStatus `A/I/D/X`; LinkCategory `A`nd/`O`r;
  CondTargetType `R`=Document (total-discount switch) `/P/M/G`; DiscountType `P/R/%/N`;
  ScaleType `A`=From`/B`=UpTo`/C`=Equal; ConditionType `ZB01/02/12/03/13`;
  MatGroupingStatus `1/2/3`; PrereqType `MGP/MAT`.

`LiveStatus` live-basket join excluded per scope.
