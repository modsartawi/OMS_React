---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3447-hybris-stock-sync-atp-to-the-hot-folder-spec.md
blocked-by: 847, BackOffice 3454
---

# 848 — The Hybris stock materials page uploads with a preview and edits single materials

## What to build

**Materials** page: list with search and enabled filter; add, enable, disable with a reason; **upload**
a CSV/XLSX → preview grouped new / changed / unchanged / refused (refused rows with their reason) → commit
under a reason; **download** the current list. Upload never deletes, and the page says so.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md` (written by BackOffice 3453, extended by 3454-3456).
Pattern: the HungerStation and Deliverect pages (`src/features/hungerstation`, `src/features/deliverect`).

## Spine reach

UI → app (BackOffice doors, stubbed until 851)

## Proof (→ `tdd` red-green cycles)

- [x] vitest: preview summary counts and refused-row reasons (`materials/upload-preview.test.ts`, + materials-query, i18n-keys)
- [x] drive script against stubs: upload preview → commit, refused rows, enable/disable, download (`tools/hybris-stock-materials-drive.mjs`, 67/67, LTR + RTL)
- [x] typecheck, lint, test green (lint: four gates green; boundaries red only for the 4 pre-existing `insurance-rules/aliases` imports on the base commit)

## Boundaries

oms-react only. Actions gated by the `Access` door (view / manage). On staging the rail stays in **shadow**, so Hybris never imports anything this page triggers.

## Done when

The proof is green; the live check rides 851.

## Blocked by

- [847](847-the-hybris-stock-stores-page-marks-stores-and-shows-their-health.md)
- BackOffice [3454](C:/Work/DMSCO/BackOffice/.issues/3454-the-hybris-team-uploads-and-edits-the-hybris-stock-material-list.md)

## Comments

**2026-11-07 — built against stubs (BackOffice 3454 not built).** Branch `spec/3447-hybris-stock`.

- 🚩 **Guessed doors** (all in `src/core/models/hybris-stock.ts`): `GET Materials?q=&enabled=&skip=&take=` →
  `{ total, rows }`; `POST Materials { materialNumber, reason }`; `PUT Materials/{n}/Enabled { enabled, reason }`;
  `POST Materials/Upload/Preview` (multipart `file`) → `{ uploadId, fileName, counts, rows[] }`, each row
  `{ line, materialNumber, materialName, enabled, wasEnabled, outcome, refusal }`; `POST Materials/Upload/{uploadId}/Commit
  { reason }` → `{ added, changed, unchanged, refused }`; `GET Materials/Download` (a file). Refusals HYS-00004 unknown
  material, 00005 already listed, 00006 preview gone, 00007 unreadable file.
- **The preview's counts are read from its rows**, not from `counts`; a disagreement is shown, never hidden.
  An outcome the door does not name reads as refused. Refusal reasons named: `unknownMaterial`, `malformed`,
  `badEnabled`, `repeated` — anything else "refused". BO ask: confirm these codes.
- The upload commits under the area's ONE reason dialog; Confirm stays off until the preview holds a new or
  changed row ("Commit N changes"). The page and the dialog both say an upload never removes a material.
- Download names the file from `Content-Disposition`, falling back to `hybris-stock-materials.csv`.
