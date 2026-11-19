---
status: open
spec: BackOffice 4057
blocked-by: BO 4058
---

# 925 — An author uploads an item list, sees the preview, and shares it

## What to build

Spec: `C:\Work\DMSCO\BackOffice\.issues\4057-a-team-uploads-an-item-list-with-its-availability-periods-and-the-copilot-analyses-on-them-spec.md`.

- **The upload page** (author grant):
  - a template download;
  - a file drop for `.xlsx` and `.csv`, up to 2 MB;
  - a preview table with matched rows, then unknown values, duplicates, bad dates and overlaps, each with its row
    number;
  - name, audience (the existing audience picker) and folder;
  - Save, which uses the preview token. An expired token asks for the file again.
- **The list page** (audience):
  - members with their level, and periods with their status chips and notes;
  - unknown values;
  - versions, with who and when;
  - Export, and Re-upload (author), which goes through the same preview.
- EN and AR, RTL.

## Spine reach

UI (new `features/item-lists`), API client.

## Proof (→ `tdd` red-green cycles)

- [ ] The preview renders each problem kind with its row number, and Save is disabled while nothing matched
- [ ] Expired token → asks for the file again
- [ ] Without the author grant there is no upload or re-upload, but the list page and Export still work
- [ ] Arabic layout (RTL) snapshot
- [ ] Lint + build clean

## Done when

Proof is green against mocks, and there is a live walk on BO 4058's local endpoints.

## Blocked by

- BackOffice 4058

## Comments
