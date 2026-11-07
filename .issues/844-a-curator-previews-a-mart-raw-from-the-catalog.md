---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md
blocked-by: 841, BackOffice 3442
---

# 844 — A curator previews a mart raw from the catalog and sees its hidden-column count and size

oms-react half of BackOffice spec 3437 (`C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md`), §G; the server spec is the normative wire.

## What to build

BackOffice spec 3437 §G, user stories 39–41, 47–48.

- On a mart/fact/dim node, curators get **Raw preview (top 200)**: `POST Analytics/Catalog/Raw`, an order-by column
  picker (allow-listed columns only) and a descending toggle, shown in AG Grid.
- A "N columns hidden" note, and the mart's row count and size in the detail pane.
- Non-curators see none of these. `ANALYTICS-402/408/417` are shown by `refusalWords`, with en/ar strings added.

## Spine reach

UI / api / tests.

## Proof (→ `tdd` red-green cycles)

- [ ] `raw preview is curator-only` · vitest
- [ ] `order-by offers only previewable columns` · vitest
- [ ] `417 shows its sentence in both languages` · vitest

## Boundaries

Web only.

## Done when

Proofs green; on staging a curator previews `mart_item_sales_daily` raw and a viewer does not see the action.

## Blocked by

[841](841-the-catalog-page-browses-areas-members-marts-and-sources-as-a-tree.md), BackOffice [3442](C:/Work/DMSCO/BackOffice/.issues/3442-a-curator-previews-a-mart-raw-through-allow-listed-columns-under-its-own-column-granted-login.md)
