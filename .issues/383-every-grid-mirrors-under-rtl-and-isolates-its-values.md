---
status: done
spec: 380
blocked-by: 382
---

# 383 — Every grid mirrors under RTL and isolates its values

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decisions **F22, F23,
F25, F28**. The measured answer is [378](378-the-foundation-in-arabic-rtl.md) §1 and §2. The
prototype is branch `prototype/378-rtl` (`?ar=1&fix=1&glob=1`, and the `/prototype/bidi` bench).

## What to build

Under Arabic/RTL every grid mirrors with no per-grid opt-in. Its pinned identifier sits at the
reading start, and every value reads the right way round.

- **Direction is a boot fact (F22).**
  - `dir` is set from the locale **before first paint**, the way the theme is.
  - Core theme calls `provideGlobalGridOptions({ enableRtl })` **once**. The global hook carries
    **scalars only**, because `enableRtl` is `@initial` in AG Grid 36 and a grid's own
    `defaultColDef` replaces a global one under the shallow merge.
  - `omsGridDirection` and **all 17 of its spreads are removed**.
  - A language switch reloads the page.
- **`pinStart` (F23).** A core value reads `'left'` in LTR and `'right'` under RTL, and is read at
  boot. It replaces every literal side: today these are the bonus-buy inquiry columns
  (`pinned: 'left'`) and retail-invoice `DownloadAction` (`pinned: 'right'`). Re-check for any other
  literal side when you start.
- **The core base `defaultColDef` (F25).**
  - Every grid's `defaultColDef` spreads it.
  - Its cell renderer is a React `<bdi>` (dir auto) showing `valueFormatted ?? value`. A function
    renderer returning a DOM node throws under AG Grid React, as 378 measured.
  - A column with its own renderer isolates its own values.
  - This **replaces `Ltr` used as a cell renderer**, which silently dropped `valueFormatter`.
  - Fold 382's native-copy options into it if they landed per grid.
- **A lint gate** beside `check-boundaries` **refuses any file that mounts `<AgGridReact` without
  spreading the core base**. An opt-in is exactly what failed for direction: 5 of 22 grids never
  spread it.
- **Numbers stay at the cell's end (F28).** Keep AG Grid's `numericColumn` convention, with no
  override.

**This is a wide but mechanical migration.** There are **21 `<AgGridReact` mounts** across many
feature folders, plus the 17 `omsGridDirection` spreads and 2 literal pinned sides. It is one
ticket rather than expand–contract because the lint gate makes coverage checkable and each edit is
a one-line spread. **`enableRtl` and isolation land in one change.** Mirrored without isolation, the
live grid read slot `10:00 - 08:00` and mobile `2178 810 51 966+` (378,
`mirrored-unisolated-ar-values.png`).

## Spine reach

Core theme (boot direction, global options, `pinStart`, base `defaultColDef` + renderer) · the 21
grid mounts · new lint gate · drive. No api or i18n.

## Proof (→ `tdd` red-green cycles)

- [x] `pinStart reads right under rtl and left under ltr` — pure · vitest
- [x] The new grid gate in `npm run lint` fails on a fixture or temporary file that mounts
  `<AgGridReact` without the base, and passes on the whole tree · lint gate
- [x] `tools/foundation-drive.mjs` (extend) under `dir="rtl"` with Arabic stub rows: the Deliveries,
  Delivery details items, Change store, Central invoices and central-invoice result grids all
  mirror, the pinned Delivery no. sits at the reading start, and a slot range, a `+966…` mobile, a
  negative amount and a date-time read in order · flow (Playwright)

## Boundaries

- No i18n keys.
- Range **formatting** helpers and the non-grid range sweep belong to 384. This ticket isolates
  whole cell values through the base renderer only.

## Done when

`omsGridDirection` no longer exists, every `<AgGridReact` spreads the core base (the gate is green),
and every grid mirrors with isolated values under RTL in the drive.

## Blocked by

[382](382-the-grid-look-26px-rows-mono-ids-and-native-copy.md)

## Comments

**Built 2026-10-02 (AFK).** Unattended decisions are in `.afk/HITL-383.md`.

- **Boot direction (F22).** `index.html`'s pre-paint script sets `<html dir>` from `localStorage['oms.locale']` (`ar` → rtl). `@/core/theme/direction` reads it once (`bootDirection`). The theme's ONE `provideGlobalGridOptions` gains `enableRtl: bootDirection === 'rtl'` beside 382's native-copy scalars. `omsGridDirection` and its 16 spreads are gone.
- **`pinStart` / `pinEnd` (F23).** BBY's identity column and the Deliveries toolbar's Pin control use `pinStart`. Retail-invoice `DownloadAction` was the END of the row, so it takes the `pinEnd` twin; `pinStart` would have moved it to the start in LTR.
- **Core base (F25).** `@/core/theme/grid-base` exports `BdiCell` (a React `<bdi>`, dir auto, showing `valueFormatted ?? value`) and `OMS_GRID_BASE_COL_DEF`. Every grid's `defaultColDef` spreads it first; Assignment had none and now passes the base. The Details items column drops its `Ltr` `cellRendererSelector`, and `Ltr` drops its renderer-only `value` prop. Custom renderers that print a whole data value now wrap it in `<bdi>`. Values interpolated into `t()` sentences inside cells are left for 384 (no i18n here).
- **Gate.** `tools/check-grid-base.mjs` runs in `npm run lint`. It follows each `<AgGridReact`'s `defaultColDef` through consts, `useMemo` and builders to a spread of the core-imported base.
- **F28.** Numbers keep AG Grid's `numericColumn` end, with no override. The drive asserts the money sits at the cell's inline end.

**Proof.**
- **vitest.** `src/core/theme/direction.test.ts` has 5 tests, including the boot read under a stubbed `<html dir="rtl">`. The suite totals 167 files and 3138 tests, all green.
- **Lint gate.** It passes the tree: 22 mounts in 21 files, self-test 6/6. On a temp copy of `src/` it refused all 22 mounts with every spread stripped, and refused exactly `DeliveriesPage.tsx:212` with one spread stripped.
- **`tools/foundation-drive.mjs`: 164/164.** It runs in light and dark, each in LTR and RTL. RTL boots through `oms.locale` (the real path). The five named grids each run in the page's direction, with `ag-rtl` set and the first column at the reading start.
  - The Delivery no., pinned through the toolbar, sits at the reading start (right under RTL).
  - These values read in order, measured as rendered characters sorted by x: slot `08:00 - 10:00`, `+966 55 810 2177`, `-5.00`, `2026-07-01 09:12`, the items `-1.50` and its totals label, a store code, the central-invoice `2026-09-29 10:15` and `-5.125`, and the result grid's number and code.
  - A control strips the slot's isolate and sees it reverse under RTL.
  - No page errors.
- **Other drives.**
  - `grid-theme-drive` 125/125 (its RTL checks are now direction-aware) and `document-rtl-drive` 53/53 (the totals footer isolate is the base `<bdi>`).
  - Also green: `bby-inquiry` 73, `slip-count` 65, `settlement` 291, `settlement-change` 337, `central-invoice` 65, `central-invoice-list` 52, `document-items` 23, `loy-member` 184, `invoice` 79.
  - `nphies-eligibility` and `nphies-authorizations` each fail one check, on surfaces this diff does not touch (a check-form label and a refusal-act copy check). They are left for their owners.
- `npm run typecheck`, `npm run lint` and `npm run build` are clean.

**Outstanding (not 383's).** A human eye on real Arabic rendering. A language switch, which will need restoring saved Deliveries views with `pinStart` (a code-review finding, latent until then).

**"Maximum update depth exceeded"** on `/oms/deliveries` was not seen. Every drive mode asserts no page errors.
