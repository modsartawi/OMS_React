---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2544-material-master-on-the-web-spec.md
blocked-by: — (live: BackOffice 2545, 2546)
---

# 451 — An HQ user searches materials with the smart box and the level filters

## What to build

**Slice 0 of the Materials area** (BackOffice spec 2544). It registers the area end to end and
builds the Material search page. Use the glossary's word **Material** in every label: never "item"
or "product".

- **Registration**
  - A new area `features/materials/` with the feature `search`.
  - The `materials-search` i18n namespace, in EN and AR, registered in `core/i18n.ts`.
  - The route `/materials`.
  - A new **Materials** menu group. Its entries are gated by `accessProbe` on `MaterialWeb/Access`:
    `canSearchMaterials` for search, with placeholder entries for Stock check (`canCheckStock`) and
    GS1 check (`canCheckGs1`), which their tickets fill in.
- **Shared model and api.** Put `core/models/materials.ts` (types taken from the contract) and the
  probe call in `core/`, because the four Materials features share them. Each feature's own calls
  stay in its own `api.ts`.
- **Search page**
  - One **smart box**: material number, EN/AR words, barcode, a scanned GS1 string, or an
    SFDA/Wasfaty code. When the server answers `resolvedAs` = `gs1` / `barcode` / `code`, show a
    chip saying how the search was resolved (e.g. "Barcode 628… → 101234").
  - **Level filters A → E**: cascading multi-selects showing "code – description".
    - Each level's options come from `MaterialWeb/Levels`, given the levels chosen above it.
    - Changing a level clears any choices below it that are no longer offered.
  - **Side filters**:
    - vendor, brand, manufacturer and status as typeahead multi-selects (`MaterialWeb/Facets`);
    - blocked and serialised as three-state (any / yes / no), default any;
    - item type.
  - **Results grid** (AG Grid): material number, EN and AR descriptions (bidi-safe), A–E codes,
    vendor, brand, status, a blocked badge, a serialised badge, and price (ex VAT, 3 decimal
    places).
    - A row opens `/materials/:no`. That route can be a placeholder until 452.
    - A **"limited — narrow your search"** banner shows when `limited` is true.
  - **The search lives in the URL**, so a search is a shareable link. Repeated params, as in the
    contract.
  - **Export** the grid to Excel through `core/util/grid-xlsx`.
  - **"Check stock for selected"**: tick rows (up to 50), then navigate to
    `/materials/stock?material=…&material=…`. Hide it when `canCheckStock` is false.
  - **Errors**: `MAT-00006` (search text too short) shows inline next to the box, not as a toast.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md` (Common,
Access, Search, Levels, Facets).

## Spine reach

UI → app (BackOffice read doors, stubbed until 455)

## Proof (→ `tdd` red-green cycles)

- [ ] `searchQuery`: the box, levels, side filters and take build the exact query string, with
  repeated params, and parse back from the URL unchanged — a round trip (vitest)
- [ ] `levelCascade`: changing A drops any B/C/D/E choice no longer offered; picking a level never
  touches the levels above it (vitest)
- [ ] `resolvedChip`: each `resolvedAs` maps to a label key; `text` / `null` → no chip (vitest)
- [ ] `tools/materials-search-drive.mjs`, run against stubs:
  - each query kind renders rows;
  - the cascade narrows;
  - the limited banner shows;
  - "check stock for selected" carries the ticked materials;
  - the menu entry is hidden when `canSearchMaterials` is false.
- [ ] `npm run typecheck`, `npm run lint` (boundaries) and `npm test` green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real
boundary. BackOffice 2545/2546 are built in parallel; until they are deployed, prove the page
against stubs of the contract.

## Done when

The named helpers and the drive are green, and the search page renders from stubs.

## Blocked by

None — can start immediately
