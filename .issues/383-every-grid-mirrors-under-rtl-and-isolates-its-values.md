---
status: open
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

- [ ] `pinStart reads right under rtl and left under ltr` — pure · vitest
- [ ] The new grid gate in `npm run lint` fails on a fixture or temporary file that mounts
  `<AgGridReact` without the base, and passes on the whole tree · lint gate
- [ ] `tools/foundation-drive.mjs` (extend) under `dir="rtl"` with Arabic stub rows: the Deliveries,
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
