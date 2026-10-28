---
status: done
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

- [x] `the list renders a general row without version, thresholds or edit` · pure
- [x] drive `tools/idf-general-drive.mjs` — General in the list opens its page; items filter, search and page (LTR + RTL) ·
  flow

## Boundaries

Endpoints stubbed. Reuses 643's items table if it has landed; otherwise this ticket builds it and 643 reuses it.

## Done when

Against stubs, General shows in the list and its page lists the items, proofs green.

## Blocked by

None (can start immediately).

## Done 2026-10-28

- Pure: `masters.test.ts` (647 describe — the proof `the list renders a general row without version, thresholds or
  edit`, plus `rankedMasters`), `general.test.ts` (the General page's address), door shape in `doors.test.ts` (647),
  keys in `i18n-keys.test.ts` (647; the masters kind check now runs over `IDF_LISTED_KINDS`).
- Drive: `tools/idf-general-drive.mjs` 48/48 (LTR + RTL) against stubs (`// --- 647 ---` in `tools/idf-stubs.mjs`:
  `IDF_GENERAL_ITEMS` 40 items / 4 groups, `idfGeneralItemsStub`, `reads.generalItems`, `deny: ['generalItems']`).
  `idf-masters-drive` 86/86 (now four rows), `idf-items-drive` 60/60, `idf-events-drive` 94/94,
  `idf-exceptions-drive` 46/46, `idf-upload-drive` 96/96 still green.
- Model: `IDF_MASTER_KINDS` stays the editable kinds (621's radios); `IDF_LISTED_KINDS` adds `general`;
  `IdfMasterRow` gains `editable` + `href`, `hard`/`reminder` null on general; `EditableIdfMaster` types 621's form;
  `rankedMasters()` filters general out of the Events master filter and the Exceptions master picker.
- Page: `GeneralPage.tsx` at `/insurance-rules/idf/general` (route + `activePrefix` on the IDF masters leaf);
  `/idf/masters/general` redirects there. Reuses 643's `ItemsTable` (new optional `empty` prop for the general wording).
- Slots for 648–651 are comments in `GeneralPage.tsx` (imports, the action row `data-idf-general-actions` for 648 Set
  item + 651 Export/Template, a 649 Upload block, 650's tab + panel; 648's row actions go on `ItemsTable` in
  `GeneralItems`), in `api.ts` (`IDF_GENERAL_KEY`, items under `IDF_GENERAL_ITEMS_KEY`) and `general.ts` (650).
- Settled myself (overrulable): the address is `?tab` (Items default, left out) and only the tab on show writes its
  keys — Items `?q&idf&page`; a tab switch drops the other tab's keys (`switchGeneralTab`), so 650 may reuse `idf`/`page`.
  General's row draws empty version cells (not "No live version yet"); new masters in the stub list before General
  (numbered among ranking masters, so `M-NEW-4…` ids hold). The tier number 4 is a page constant, not read.
