---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: —
---

# 647 — The masters list shows General, and its page lists the general items

## What to build

The general master (tier 4) is still seen only in the WPF. Doors BackOffice 3191
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- the IDF masters list shows the `kind: general` row ("General" / "عام"), with no version, no thresholds and no edit;
  its name links to `/insurance-rules/idf/general`;
- a **General master page**: header naming tier 4, help text saying the WPF IDF screens still write it unchecked, and
  a paged items table (item, description, group, priority) with group filter and item search — the same component as
  643, fed by `GET IdfPriority/general/items`;
- slots for 648–651 on the page (single edit, Upload, Export / Template, Change log tab).

## Spine reach

model (kind `general`) · api · route + component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `the list renders a general row without version, thresholds or edit` · pure
- [ ] drive `tools/idf-general-drive.mjs` — General in the list opens its page; items filter, search and page (LTR + RTL) ·
  flow

## Boundaries

Endpoints stubbed. Reuses 643's items table if it has landed; otherwise this ticket builds it and 643 reuses it.

## Done when

Against stubs, General shows in the list and its page lists the items, proofs green.

## Blocked by

None (can start immediately).
