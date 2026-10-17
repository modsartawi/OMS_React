# HITL — ticket 516 (coupon CSV import/export, delete unused)

## Q: How does the client learn "unknown member" and "code already in SIS.Coupons" before importing?
**Decision taken:** A provisional pre-import check door, `POST RuleCampaign/Campaigns/{id}/Coupons/Imports/Check` → `{ inUse[], unknownMembers[] }`, sent only the rows that pass the local check (missing code, bad characters, repeat in file, already in this campaign). Import then posts the good rows to `.../Coupons/Imports` and HQ answers `{ batch, count }`.
**Why:** The client cannot know members or other campaigns' codes; the ticket asks for the per-row check *before* importing.
**Revisit if:** BackOffice 2755/2758 folds the check into the import door (a dry-run flag) or answers per-row refusals instead — re-point in 520.

## Q: Is Delete unused campaign-wide (prototype) or one batch?
**Decision taken:** One batch — the button appears when the list is filtered to a batch; the confirmation shows unused that go and used/disabled/expired that stay, from the list as last read. `DELETE .../Coupons/Batches/{batch}/Unused` → `{ deleted, kept }`.
**Why:** The ticket says "removes a batch's unused codes".
**Revisit if:** the owner wants the prototype's campaign-wide "Delete all unused coupons".

## Q: Export columns and file name
**Decision taken:** Machine header `code,member,status,kind,uses,batch,valid_from,valid_until,created` (BOM, CRLF, no isolates), so an export reads back as an import; file `<campaign code>-<batch|coupons>.csv`.
**Why:** Mirrors the prototype's `codeCsv`; header names are machine names, not copy.
**Revisit if:** a print house / email provider needs a different layout.

## Q: One import's cap
**Decision taken:** Good rows past MAX_BATCH (5000, the create form's cap) are rejected as "too many", counted after HQ's check.
**Why:** Same batch cap as creating codes (515).
**Revisit if:** HQ sets a different import cap.

## Q: Review notes left for the owner
**Decision taken:** Not changed in-slice: the CSV cell writer duplicates two other features' writers (pricing/coupons is off-limits this wave); `badCode` copy hard-codes the 3–32 bound.
**Why:** Touching pricing/coupons is forbidden; the bound is unlikely to change before 520.
**Revisit if:** a CSV writer helper lands in core/util.
