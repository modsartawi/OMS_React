---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 647
---

# 650 — The general change log tab filters and exports

## What to build

"Why did this item's priority change?" needs an answer. A **Change log** tab on the General master page
(`?tab=changes`), doors BackOffice 3194
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- paged rows, newest first: when, who, entity (item / group) and key, action, before → after (group and priority, or
  the group's fields), reason, and the upload id when it came from a bulk apply;
- filters: item, group, user, date range (local days, inclusive), kept in the URL;
- **Export** downloads the filtered rows as `.xlsx`.

## Spine reach

api · logic (filter ↔ query, before/after rendering) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `change filters round-trip through the URL and refuse to before from` · pure
- [ ] `before → after renders set, clear and group edits` · pure
- [ ] drive `tools/idf-changes-drive.mjs` — filter by item and dates, page, export (LTR + RTL) · flow

## Boundaries

Endpoints stubbed. View grant only. Reuse 626's filter pieces where they fit.

## Done when

Against stubs, the log filters, pages and exports, proofs green.

## Blocked by

[647](647-the-masters-list-shows-general-and-its-page-lists-the-general-items.md)
