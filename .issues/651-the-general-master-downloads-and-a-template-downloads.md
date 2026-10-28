---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 644, 647
---

# 651 — The general master downloads, and a template downloads

## What to build

Doors BackOffice 3195 ([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- **Export** on the General master page downloads the whole general master as `.xlsx`;
- **Template** beside Upload downloads the blank file;
- both with 644's download helper.

## Spine reach

api (`api.blob`) · component · i18n (EN+AR) · drive

## Proof (→ `tdd` red-green cycles)

- [ ] drive `tools/idf-general-drive.mjs` extended — Export and Template each download a file · flow

## Boundaries

Endpoints stubbed. View grant only.

## Done when

Against stubs, both downloads work from the General page, proof green.

## Blocked by

[644](644-a-master-downloads-in-its-upload-format-and-a-blank-template-downloads.md),
[647](647-the-masters-list-shows-general-and-its-page-lists-the-general-items.md)
