---
status: done
spec: 805
blocked-by: 807
---

# 808 — A pasted list of employee IDs becomes Add holders' picks, matched exactly

## What to build

**Add holders** gains **Paste IDs**: the shared paste box (`PasteCodesDialog`) takes a column from Excel or
IDs separated by commas, spaces or new lines. The paste is split with the `core/util/code-list` parser and
de-duplicated. Each ID is then looked up through the same `Employees` search, **sequentially**, with
progress shown ("12 of 40"). Because that search is a contains-match, an ID resolves only to the result
row whose `employeeId` **equals** it — `1234` never picks `12345`.

Each pasted ID ends in one of three outcomes:
- **found** → added to the picks as a chip with the person's name (so the batch can be checked before it is written);
- **already holds** → reported, not picked;
- **not found** → listed back, so the list can go back to whoever sent it.

The admin then presses **Assign to N** — the 807 batch, unchanged. This is the path for teams that arrive
as ID lists.

## Spine reach

store/logic (paste resolution) · component (Paste IDs in Add holders) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `resolvePastedIds splits, de-duplicates and matches exactly` — `1234` against results `1234, 12345` → `1234` only; repeated IDs once; found / already-holds / not-found classified · pure
- [x] `authz-batch-drive` Paste IDs leg — paste 5 IDs (one repeated, one unknown, one current holder, one prefix of another) → 2 chips with names, 1 already-holds, 1 not-found listed; Assign to 2 succeeds · flow (Playwright)

## Boundaries

Existing `Employees` search only (one call per pasted ID). New `authz-admin` keys for the paste labels and
outcomes. Paste-box words passed in by the caller, as the other `PasteCodesDialog` users do.

## Done when

Pasting a list of employee IDs into Add holders yields exactly-matched picks plus a report of the unused
IDs, and the vitest test and drive leg pass.

## Blocked by

[807](807-a-roles-held-by-tab-adds-several-holders-found-by-searching-people.md)

## Comments

- 2026-11-06 review fixes (`impl/805-review-fixes`): pasted IDs are de-duplicated case-insensitively
  (`ab12`/`AB12` look up once, pick once); a capped lookup with no exact row is reported "too many
  matches — check by hand", not "not found"; the progress is seeded with the ID count; the dialog
  cannot be dismissed while the lookups run.
- Possible BackOffice follow-up (recorded, not built — the spec ruled client-only): an exact-ID
  lookup door that takes the whole pasted list in **one request** (e.g. `AuthzAdminWeb/Employees/ByIds`)
  would replace the one-search-per-ID loop and remove the "too many matches" case altogether, since a
  contains-match capped at 50 can hide a short ID's exact row.
