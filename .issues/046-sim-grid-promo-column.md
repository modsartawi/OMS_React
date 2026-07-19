---
status: open
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

- [ ] a promoted line renders its kind chip + role tag; an un-promoted line renders "—" · component (RTL, when runner lands)
- [ ] the four kinds render their four distinct chips · component (RTL, when runner lands)

Runner not installed — verify via `npm run typecheck` + drive `npm run dev`: run a basket with mixed
promos against live `SIS.Api`, confirm the Promotion column reads per line without selection.

## Boundaries

New `simulation` i18n keys (kind labels, role tags). No endpoint change. Keeps the AG Grid Community
flat grid (column parity for advanced users) — this adds a column, it does not replace the grid.

## Done when

The results grid shows a per-line kind chip + role tag driven by `promoView`, verified in the running
app; typecheck green.

## Blocked by

[045](045-sim-promoview-model.md) — the grid column reads `promoView(result).lines`.
