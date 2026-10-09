---
status: done
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

- [x] `masterGroups`: every contract field lands in exactly one group; `hasInfo: false` collapses
  the info groups (vitest)
- [x] `stockTabVisible`: hidden without `canCheckStock`, and no request is made (vitest)
- [x] `simulationMaterialParam`: `?material=101234` pre-adds the material once; without the param
  the simulator is unchanged (vitest)
- [x] `tools/materials-detail-drive.mjs`, run against stubs:
  - each tab renders;
  - the zero toggle works;
  - `MAT-00004` shows the unavailable state;
  - `MAT-00001` shows not found;
  - the simulator link lands prefilled.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green

## Boundaries

oms-react only, against stubs until 455. The simulator change is additive: without the param,
behaviour is identical.

## Done when

The named helpers and the drive are green.

## Blocked by

[451](451-an-hq-user-searches-materials-with-the-smart-box-and-the-level-filters.md)

## Comments

**Done 2026-10-09 (AFK, stubbed).** Built at `src/features/materials/detail/` (`MaterialDetailPage`,
`api`, `columns`, `master-groups`, `detail-view`), namespace `materials-detail` EN + AR. Route `/materials/:no`
now points at the detail, and the 451 placeholder is deleted (file and `placeholder.*` keys). The simulator
change is `features/pricing/simulation/material-param.ts`, read once at its initial state.

Proof:
- `masterGroups` → `master-groups.test.ts`. The pure function is named `masterSections`, beside the
  `MASTER_GROUP_ROWS` / `MASTER_SOURCE` tables. `MASTER_SOURCE` is typed with `satisfies Record<keyof MaterialMaster, …>`,
  so a new contract field fails the typecheck until it is placed.
- `stockTabVisible` → `detail-view.test.ts`. The "no request" half runs the tab's own query through a real
  TanStack `QueryObserver` with the stock door spied: zero calls without `canCheckStock` (or with no probe answer),
  and exactly one call with the contract body when both grants are held.
- `simulationMaterialParam` → `material-param.test.ts`.
- `tools/materials-detail-drive.mjs` → 67/67 against stubs on :5244:
  - every tab renders;
  - the zero toggle re-asks with `includeZero: true`;
  - MAT-00004 shows the unavailable panel and no grid;
  - MAT-00001 shows the not-found page, and its link goes back to search;
  - the simulator link lands with one row 101234 / 1 / EA and nothing processed, and the plain simulator still opens with one empty row;
  - the static `/materials/stock` and `/materials/gs1` still beat `:no`.
- Regression drives on :5244: search 74/74 (its check 8 now waits for the detail), stock 47/47, GS1 59/59,
  sim-process 51/51. `node tools/check-sim-keys.mjs` 8/8: no simulation key was added.
- Gates: `npm run typecheck` clean. `npm run lint` 4 gates clean. `npm test` 247 files / 4357 tests. `npm run build` clean.

Decisions, the contract-envelope drift, and the review findings are in `.afk/HITL-452.md`. Two of them want the
owner's eye: the tab hides ATP-0 stores by default, and fields are split into Item and ItemInfo by reading
`ItemInfo.cs`. Outstanding, and not this ticket's: the live doors (BackOffice 2547, 2548), the owner walk and the
Arabic read-through, all ticket 455.
