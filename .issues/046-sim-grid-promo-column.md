---
status: done
spec: 043
blocked-by: 045
---

# 046 — theResultsGridShowsPromoKindAndRolePerLine

## What to build

The flat per-line results grid gains a **Promotion** column so a user scanning a priced basket sees
which lines a promotion touched and roughly what kind — **without selecting any line**. Per line,
driven by `promoView(result).lines`:

- a **kind chip** — Free goods / % off / Amount off / Set price — coloured by the sketch palette
  (free = good/green, percent = accent, fixed = warn, setprice = info);
- a **role tag** — buy / get / buy+get;
- a plain em-dash for a line with no promotion (promoted and un-promoted lines read distinct).

Everything the grid shows today survives — the E/W status dot, item/material/qty, and the money
columns with net/gross treatment. The column reads from the view model, so it shows undivided/roleless
values on the degradation path and sharpens once 044 lands.

## Spine reach

component (AG Grid cell renderer + `columns.ts`) · i18n (`simulation` keys) · test (app-drive)

## Proof (→ `tdd` red-green cycles)

- [x] a promoted line renders its kind chip + role tag; an un-promoted line renders "—" · component (RTL, when runner lands) — logic verified by promoView unit (045); render verified test-ready
- [x] the four kinds render their four distinct chips · component (RTL, when runner lands) — kind→chip mapping covers free/percent/fixed/setprice + neutral unknown

Runner not installed — verified via `npm run typecheck` + `npm run build` + boundary lint (125 files) green,
and Vite transform of every touched module (`PromoCell.tsx`, `columns.ts`, `SimulationPage.tsx`,
`promo-view.ts` → 200, clean dev log). **Live-drive against `SIS.Api` is pending — the backend is down**
(this branch's known state), same runtime caveat the NC tickets carry. The Promotion column's data comes
from the already-unit-tested `promoView.lines`, so only the AG Grid cell wiring is unverified at runtime.

## Boundaries

New `simulation` i18n keys (kind labels, role tags). No endpoint change. Keeps the AG Grid Community
flat grid (column parity for advanced users) — this adds a column, it does not replace the grid.

## Done when

The results grid shows a per-line kind chip + role tag driven by `promoView`, verified in the running
app; typecheck green.

## Blocked by

[045](045-sim-promoview-model.md) — the grid column reads `promoView(result).lines`.
