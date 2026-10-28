---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 643
---

# 644 — A master downloads in its upload format, and a blank template downloads

## What to build

Bulk add and remove should start from the current ranking. Doors BackOffice 3188
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- **Export** beside the Items section downloads the version on show (live or old) as `.xlsx`;
- **Template** beside Upload downloads the blank file;
- file names name the master and the version; a refused download (JSON envelope) shows its message.

## Spine reach

api (`api.blob`, as 627's export) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `export file name names the master and version` · pure
- [ ] drive `tools/idf-export-drive.mjs` — Export and Template each download a file; a refused export shows its message ·
  flow

## Boundaries

Endpoints stubbed. The download helper is shared with 651 and 652.

## Done when

Against stubs, both downloads work from the master page, proofs green.

## Blocked by

[643](643-a-masters-page-lists-the-items-of-its-live-version-or-any-old-one.md)
