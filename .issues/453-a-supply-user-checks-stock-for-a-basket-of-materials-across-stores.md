---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2544-material-master-on-the-web-spec.md
blocked-by: 451 (live: BackOffice 2548)
---

# 453 — A supply user checks stock for a basket of materials across stores

## What to build

Feature `features/materials/stock-check` with the route `/materials/stock`, guarded by
`canCheckStock` (fill in 451's placeholder menu entry). Its own i18n namespace, EN + AR.

- **Materials input**
  - Paste or type material numbers, one per line or comma-separated, de-duplicated, up to 50.
  - The 51st is refused **on the client** with the `MAT-00002` message before any call; the server
    refuses too.
  - Prefilled from `?material=` (repeatable), which is what 451's "check stock for selected" sends.
- **Stores input**
  - Pick stores by code or name, using the existing store lookup in `core/services/lookups`.
  - Or **add a whole set**: choose a kind (area / city / district / supervisor) from
    `MaterialWeb/StoreSets`, then a value with its store count; this adds that set's stores.
  - **"All stores"** sends `stores: null`.
  - **"Include closed stores"** toggle, off by default.
  - The chosen stores show as removable chips, with a count.
- **"Include zero"** toggle, off by default.
- **Result grid**, one row per material × store: material, description, store, store name, ATP, SAP
  unrestricted, POS, OMS and last updated.
  - Grouped or sortable by material.
  - A summary line: materials asked, stores asked, cells shown.
  - Exportable to Excel.
- **Errors**
  - `MAT-00004` → a "Stock Visibility unavailable — try again" panel, **never an empty grid**.
  - `MAT-00003` → inline under the materials input.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md` (Stock,
StoreSets).

## Spine reach

UI → app (BackOffice read doors, stubbed until 455)

## Proof (→ `tdd` red-green cycles)

- [x] `parseMaterialList`: splits on newline, comma and space; trims; de-duplicates; refuses the 51st
  (vitest)
- [x] `storeSelection`: adding a set merges into the existing chips without duplicates; "All stores"
  sends `null`; removing a chip works (vitest)
- [x] `stockRequest`: the inputs build the exact request body (vitest)
- [x] `tools/materials-stock-drive.mjs`, run against stubs:
  - a pasted basket × a city set renders the grid;
  - the zero and closed toggles reach the request;
  - `MAT-00004` shows the unavailable panel;
  - the prefill from `?material=` works;
  - the menu entry is hidden when `canCheckStock` is false.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green

## Boundaries

oms-react only, against stubs until 455.

## Done when

The named helpers and the drive are green.

## Blocked by

[451](451-an-hq-user-searches-materials-with-the-smart-box-and-the-level-filters.md)

## Comments

**2026-10-09 — built AFK (stubbed), done.**

- **Feature** `features/materials/stock-check`: `StockCheckPage.tsx` sits behind `canCheckStock` (the
  ScreenGate backstop) and is routed at the static `/materials/stock` in place of 451's placeholder.
  The menu leaf and its `materials-search:menu.stockCheck` label are unchanged. Namespace
  `materials-stock-check`, EN + AR, with all six Arabic plural forms.
- **Shared, in core, for 452's Stock tab:**
  - `core/materials/stock.ts`: `stockRequest`, `materialStockApi.stock` (POST `MaterialWeb/Stock`),
    `materialStockQuery`, `isStockUnavailable`;
  - `core/materials/StockUnavailable.tsx`: the MAT-00004 panel. Its words are
    `materials-search:shared.stockUnavailable*`, beside 451's cap key.
- **Pure helpers:** `material-list.ts` (`parseMaterialList`) and `store-selection.ts` (add, set
  merge, remove, clear, All stores, lookup matching).
- **Proof:**
  - vitest: `material-list.test.ts`, `store-selection.test.ts`, `core/materials/stock.test.ts`,
    `i18n-keys.test.ts` (239 files / 4270 tests green);
  - drive `tools/materials-stock-drive.mjs`: **47/47** on vite :5244, LTR;
  - 451's `tools/materials-search-drive.mjs`: 74/74. Its check 8 now proves `/materials/stock` on
    the real page. Its check 5 flaked once in three runs, a timing race in 451's filter-URL test;
  - typecheck, lint (all four gates) and build are green.
- **Reviews:**
  - `/code-review`: fixed a server MAT-00002/3 refusal that stayed after an edit, the composite
    row id that could collide, and the stale router comment;
  - `/standards-review`: no hard violations. Two smells were fixed: the set-to-chip mapping now
    lives in `store-selection.ts`, and the prefill text has one source.
- **Decisions and contract gaps** are in `.afk/HITL-453.md`:
  - the contract's stock cell has **no description**, so there is no description column;
  - the real envelope `errors[]` shape;
  - All stores is off by default;
  - an empty list disables Check rather than sending for MAT-00003;
  - the 51st material refuses the whole check;
  - a store's "name" is its lookup address;
  - a set is resolved with the closed toggle as it was when added;
  - the grid is sortable, not grouped (Community grid).
- **Outstanding (not this ticket's):** the live walk against BackOffice 2548, the owner walk and
  the Arabic read-through belong to 455.
