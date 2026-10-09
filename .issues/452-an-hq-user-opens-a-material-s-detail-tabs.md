---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2544-material-master-on-the-web-spec.md
blocked-by: 451 (live: BackOffice 2547, 2548)
---

# 452 — An HQ user opens a material's detail tabs

## What to build

Feature `features/materials/detail` with the route `/materials/:no`, guarded by
`canSearchMaterials`. Its own i18n namespace, EN + AR.

- **Header**: material number, EN and AR descriptions, and badges for blocked, serialised and
  status.
- **Master** tab: every master field from `MaterialWeb/Material/{no}`, in labelled groups:
  - Identity — numbers, codes, SFDA, Wasfaty.
  - Hierarchy — A–E, each as "code – description".
  - Commercial — vendor, brand, manufacturer, house brand, price ex VAT.
  - Logistics — UoMs, tracking, temperature.

  A material without ItemInfo shows "not in material info" in place of the empty groups.
- **Barcodes** tab: a grid of barcode, UoM, quantity and main flag, exportable to Excel.
- **Batches** tab: a grid of SAP batch, vendor batch and expiry. It is shown only for serialised
  materials.
- **Stock** tab:
  - **Visible only when `canCheckStock`**; otherwise a "not permitted" note, and no call is made.
  - It calls `POST MaterialWeb/Stock` with this one material and `stores: null`.
  - The grid shows every store whose ATP ≠ 0, sorted by ATP: store, ATP, SAP unrestricted, POS, OMS
    and last updated.
  - A **"show zero stores"** toggle sets `includeZero`.
  - `MAT-00004` shows a clear "Stock Visibility unavailable" state, **never an empty grid**.
  - Exportable to Excel.
- **"Check promotions in the simulator"** link. It opens the pricing simulator with this material
  filled in. That needs the **simulation feature to accept `?material=` and pre-add that material**
  on open. That is a small change inside `features/pricing/simulation`, reading its own query
  param, so it crosses no feature boundary.
- `MAT-00001` → a "material not found" page with a link back to search.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md` (Material,
Stock).

## Spine reach

UI → app (BackOffice read doors, stubbed until 455)

## Proof (→ `tdd` red-green cycles)

- [ ] `masterGroups`: every contract field lands in exactly one group; `hasInfo: false` collapses
  the info groups (vitest)
- [ ] `stockTabVisible`: hidden without `canCheckStock`, and no request is made (vitest)
- [ ] `simulationMaterialParam`: `?material=101234` pre-adds the material once; without the param
  the simulator is unchanged (vitest)
- [ ] `tools/materials-detail-drive.mjs`, run against stubs:
  - each tab renders;
  - the zero toggle works;
  - `MAT-00004` shows the unavailable state;
  - `MAT-00001` shows not found;
  - the simulator link lands prefilled.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green

## Boundaries

oms-react only, against stubs until 455. The simulator change is additive: without the param,
behaviour is identical.

## Done when

The named helpers and the drive are green.

## Blocked by

[451](451-an-hq-user-searches-materials-with-the-smart-box-and-the-level-filters.md)
