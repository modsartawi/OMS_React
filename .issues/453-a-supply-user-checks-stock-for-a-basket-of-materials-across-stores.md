---
status: open
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

- [ ] `parseMaterialList`: splits on newline, comma and space; trims; de-duplicates; refuses the 51st
  (vitest)
- [ ] `storeSelection`: adding a set merges into the existing chips without duplicates; "All stores"
  sends `null`; removing a chip works (vitest)
- [ ] `stockRequest`: the inputs build the exact request body (vitest)
- [ ] `tools/materials-stock-drive.mjs`, run against stubs:
  - a pasted basket × a city set renders the grid;
  - the zero and closed toggles reach the request;
  - `MAT-00004` shows the unavailable panel;
  - the prefill from `?material=` works;
  - the menu entry is hidden when `canCheckStock` is false.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green

## Boundaries

oms-react only, against stubs until 455.

## Done when

The named helpers and the drive are green.

## Blocked by

[451](451-an-hq-user-searches-materials-with-the-smart-box-and-the-level-filters.md)
