---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md
blocked-by: 841, BackOffice 3441
---

# 843 — A viewer previews an area from the catalog in a grid, and an author starts a view or asks the copilot from a node

oms-react half of BackOffice spec 3437 (`C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md`), §G; the server spec is the normative wire.

## What to build

BackOffice spec 3437 §G, user stories 35–38, 49–51.

- **Preview** on an area or measure node: `POST Analytics/Catalog/Preview` with the defaults, shown in AG Grid
  (bilingual headers, the formats charts use). A period picker and a column chooser re-run the preview. Dropped
  measures get a note, and refusals use `refusalWords`.
- **Author actions:** "New view from this" opens the builder pre-filled with the measure (or the area's first
  measure) and dimension. "Ask about this area" opens the ask box scoped to the area. Runners see neither.

## Spine reach

UI / api / tests.

## Proof (→ `tdd` red-green cycles)

- [x] `preview request carries the defaults and re-runs on period change` · vitest
- [x] `dropped measures show a note` · vitest
- [x] `new view from a measure pre-fills the builder link` · vitest
- [x] `runner sees no author actions` · vitest

## Boundaries

Web only.

## Done when

Proofs green; on staging a preview of Item sales shows 200 rows by day.

## Blocked by

[841](841-the-catalog-page-browses-areas-members-marts-and-sources-as-a-tree.md), BackOffice [3441](C:/Work/DMSCO/BackOffice/.issues/3441-any-viewer-previews-an-area-through-cube-200-rows-by-day-for-the-last-7-days.md)

## Comments

**2026-11-07 — built (stubbed).** Code half holds; the staging walk ("a preview of Item sales shows 200 rows by day")
is still owed.

- Proofs (vitest, pure modules): `catalog-preview.test.ts` (request defaults + period re-run under a new query key,
  `readPreview` keeps `dropped` + `droppedNotes`, grid columns/formats, preview refusals), `catalog-actions.test.ts`
  (`newViewFrom`, `catalogAuthorActions`), `src/core/copilot-panel.test.ts` (`prefill` / `takeDraft`).
- Drive: scenario `843` in `tools/analytics-drive.mjs` (stub `previewAnswer843` in `tools/analytics-catalog-stubs.mjs`,
  branch `Analytics/Catalog/Preview` in `tools/analytics-stubs.mjs`), 24/24 en + rtl.
- Agent rulings applied (overrulable by the owner):
  - **4** "Ask about this area" PREFILLS, never sends: new generic `prefill(text)` / `takeDraft()` on
    `@/core/copilot-panel`; the copilot panel puts it in its box and focuses it. The question is
    `catalog.actions.askQuestion` with `fsi(label)` per the ruling — ⚠ the FSI/PDI therefore ride into the question
    text if sent as is (the copilot's own example chips avoid `fsi` for that reason); owner to confirm.
  - **5** New view: a measure/area node → that measure (else the area's first), by `date` at day grain, last 7 days,
    line chart; `newViewFrom` also takes a dimension node (that dimension, bar), not mounted on the dimension pane.
  - **12** dedicated `readPreview` wrapping `readResult`, keeping `dropped` (an entry with no measure dropped).
  - **13** preview-specific refusal words under `catalog.preview.refusal.*` (en + ar): 406 on `measures` →
    `allDropped`, other 406 → `invalid`, 408 → `timedOut` (30 s), 410 → the area's reason from the refusal's data
    (else the catalog's); anything else falls back to `refusalWords`.
- Preview is offered to every viewer (runners too); New view + Ask need the author grant, Ask also the copilot probe.
  The column chooser sends category dimensions only (the server owns `date`). The grid is `@/core/charts/TableChart`
  (grid base, `fsi` headers, `formatValue`/`formatDay`), lazy-loaded when Preview opens.
- Shared touches: `DetailShell` gained an optional `below` slot (`CatalogDetailParts.tsx`) for the preview.

**2026-11-07 — 3437 review fixes.**

- **Ruling 4's `fsi` clause is overridden:** the prefilled question interpolates the raw area label (no FSI/PDI),
  as the copilot panel's own example chips do (`CopilotPanel.tsx`) — the question is what the box will send.
- **Ruling 5 narrowed:** `newViewFrom(area, measure?)` takes a measure or area node only (story 49); the unmounted
  dimension-node path and its test case are gone.
- The column chooser offers, and `previewRequest` sends, category dimensions only — neither the date nor any other
  time dimension (`previewDimensions`, matching the server default in `AnalyticsCatalogPreview`).
- The Catalog's labels and the prefilled question follow a language switch (`useTranslation()`'s `i18n`).
