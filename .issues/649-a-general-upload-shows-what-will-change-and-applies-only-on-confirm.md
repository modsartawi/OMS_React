---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 647
---

# 649 — A general upload shows what will change, and applies only on confirm

## What to build

A bad general file reaches every till today. An **Upload** step on the General master page, doors BackOffice 3193
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- pick a file; a failing file shows its row report (as 622) and cannot be applied;
- a clean file shows the **change preview**: counts of added / re-ranked / moved / unchanged, and a filterable table
  of each change, before → after;
- **Apply** asks for a reason; the result shows how many items were applied and lists any failed batch with its lines
  and message.

## Spine reach

api (multipart) · logic (applicable, preview filter) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `a general upload is applicable only when ok and no row failed` · pure
- [ ] `preview filter by change kind` · pure
- [ ] drive `tools/idf-general-upload-drive.mjs` — dirty file: report, Apply off; clean file: preview, apply with reason;
  a stubbed failed batch is listed · flow

## Boundaries

Endpoints stubbed. Reuse 622's row-report component. Needs the general-edit grant once 654 adds the probe.

## Done when

Against stubs, nothing applies until a clean preview is confirmed, proofs green.

## Blocked by

[647](647-the-masters-list-shows-general-and-its-page-lists-the-general-items.md)
