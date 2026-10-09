---
status: done
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

- [x] `searchQuery`: the box, levels, side filters and take build the exact query string, with
  repeated params, and parse back from the URL unchanged — a round trip (vitest)
- [x] `levelCascade`: changing A drops any B/C/D/E choice no longer offered; picking a level never
  touches the levels above it (vitest)
- [x] `resolvedChip`: each `resolvedAs` maps to a label key; `text` / `null` → no chip (vitest)
- [x] `tools/materials-search-drive.mjs`, run against stubs:
  - each query kind renders rows;
  - the cascade narrows;
  - the limited banner shows;
  - "check stock for selected" carries the ticked materials;
  - the menu entry is hidden when `canSearchMaterials` is false.
- [x] `npm run typecheck`, `npm run lint` (boundaries) and `npm test` green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real
boundary. BackOffice 2545/2546 are built in parallel; until they are deployed, prove the page
against stubs of the contract.

## Done when

The named helpers and the drive are green, and the search page renders from stubs.

## Blocked by

None — can start immediately

## Comments

**2026-10-09 — built (AFK).** Done-when holds; everything is proven against STUBS of the door
contract, since no `MaterialWeb/*` door is deployed (the live walk is 455's).

- **Registration:**
  - area `src/features/materials/search/`;
  - namespace `materials-search` in EN and AR (six Arabic plural forms), registered in `core/i18n.ts`;
  - routes `/materials`, `/materials/stock`, `/materials/gs1` and `/materials/:no` (the last three
    render ONE placeholder, `MaterialPlaceholderPage`, which 452 deletes);
  - a **Materials** menu group after Pricing & Promotions, holding all three leaf labels under
    `materials-search:menu.*`.
- **Shared, in core:**
  - `core/models/materials.ts`: types for EVERY contract door, field for field;
  - `core/materials/api.ts`: one key and one call, failing closed;
  - `core/materials/access.ts`: a predicate per flag, plus `canSeeMaterialStock` for 452;
  - `core/materials/stock-cap.ts`: `STOCK_MATERIAL_CAP = 50`, the one refusal key, and `stockCheckHref`;
  - `formatMoney3` beside `formatMoney`, which is left at 2 decimals.
- **Proof:**
  - vitest: `search-query.test.ts`, `level-cascade.test.ts`, `resolved-chip.test.ts`,
    `i18n-keys.test.ts`, plus `core/materials/{access,stock-cap}.test.ts` and
    `number-format.test.ts` (235 files / 4237 tests green);
  - drive `tools/materials-search-drive.mjs`: **74/74** on vite :5199, LTR and RTL;
  - typecheck, lint (all four gates) and build are green.
- **Reviews:**
  - `/code-review` found three real bugs, now fixed:
    - Enter in a picker's Find box submitted the search;
    - the level pickers shared one Find text;
    - a range tick crossing the cap unticked the rows that still fit.
  - The same pass also turned up a URL-write race, fixed with updater writes and an echo-tracking
    ref; the drive covers it.
  - `/standards-review` found no hard violations.
- **Decisions and contract gaps** are in `.afk/HITL-451.md`. The main ones:
  - the stub uses the real envelope `errors[]` shape;
  - `material` gets no chip;
  - "Material type" is a free-number entry;
  - the cap key lives in `materials-search`;
  - the stock-cell field names in the spec and the contract disagree.
- **Outstanding (not this ticket's):** the live walk against the real doors, the owner walk and
  the Arabic read-through belong to 455.

