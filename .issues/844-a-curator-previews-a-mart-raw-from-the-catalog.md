---
status: done
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

- [x] `raw preview is curator-only` · vitest (`boards/catalog-raw.test.ts`)
- [x] `order-by offers only previewable columns` · vitest (`boards/catalog-raw.test.ts`)
- [x] `417 shows its sentence in both languages` · vitest (`boards/catalog-raw.test.ts`)

## Boundaries

Web only.

## Done when

Proofs green; on staging a curator previews `mart_item_sales_daily` raw and a viewer does not see the action.

## Blocked by

[841](841-the-catalog-page-browses-areas-members-marts-and-sources-as-a-tree.md), BackOffice [3442](C:/Work/DMSCO/BackOffice/.issues/3442-a-curator-previews-a-mart-raw-through-allow-listed-columns-under-its-own-column-granted-login.md)

## Comments

**2026-11-07 — built (code half done; stubbed, staging walk owed).**

- Pure module `boards/catalog-raw.ts`: `rawOffer(mart, probe)` (null unless `canCurateAnalytics` AND the mart carries
  `columns`; gives rows, sizeMb, hidden count and the order-by list = previewable columns, table order),
  `rawRequest` (a choice off the list or none → the first listed column; descending unless chosen ascending; no
  listed column → `orderBy` left out so the server answers 417, not 406), `readRaw` (keeps only the listed columns),
  `rawRefusal`. Door `analyticsApi.catalogRaw` → `POST Analytics/Catalog/Raw`, key `analyticsRawKey(body)` (whole body,
  so a new order asks again). Models `AnalyticsRawPreviewRequest` / `AnalyticsRawPreview` in `core/models/analytics.ts`.
- `CatalogMartDetail.tsx`: curator facts Rows / Size ("Not stored (a view)" when null) / "Columns hidden from
  previews", and the **Raw preview (top 200)** button in the `DetailShell` actions slot. `CatalogRawPreview.tsx`: order-by
  `Select` (allow-listed only) + Descending `Chip`, AG Grid spreading `OMS_GRID_BASE_COL_DEF` (no client re-sort,
  `fsi` only in header names / native options), refusal through `ErrorBanner` + `refusalWords`.
- Ruling 7 applied: non-curators see no action, no hidden-column note, no row count, no size (the probe decides even if
  curator fields were present).
- Ruling 13 applied: `REFUSAL_KEYS` gains `ANALYTICS-402 → refusal.needsCurator` and `ANALYTICS-417 →
  refusal.notPreviewable` (a commented 844 block in `wire.ts`); the raw door's 10 s timeout is worded by
  `rawRefusal` (`catalog.raw.timedOut`), falling back to `analyticsRefusal`. en + ar for all; i18n under `catalog.raw.*`.
- Drive: `DRIVE_ONLY=844 DRIVE_PORT=5244 node tools/analytics-drive.mjs` (fixtures `CATALOG_CURATED_844`,
  `rawAnswer844`; stub branch `Analytics/Catalog/Raw` takes `opts.raw`), en + rtl, 22/22; 841's 29 still pass.
- Gates: typecheck, test (708 files), build, lint — only the 4 known `door-shapes.test.ts` boundary errors.
- **Owed:** on staging a curator previews `mart_item_sales_daily` raw and a viewer does not see the action.

