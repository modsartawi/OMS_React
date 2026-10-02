---
status: open
spec: 380
blocked-by: 381
---

# 382 — Every grid has 26px rows, a header ground, mono IDs, a cursor bar above pinned cells, and native copy

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decisions **F6** (the
selected row), **F8** and **F9**.

## What to build

Every AG Grid in the app takes the Ops Console look from the one params block, and every grid allows
native copy. The values are in [362](362-ops-console-colours-density-and-grid-look.md) §4 and §6.

- **Params (F8):**
  - row height 26, header height 28;
  - `fontSize` 12, `headerFontSize` 11.5, `headerFontWeight` 600;
  - `fontFamily: var(--font-sans)`, not the Inter literal;
  - the header ground and ink on `--grid-head` / `--grid-head-foreground`;
  - `wrapperBorderRadius` 8;
  - `pinnedColumnBorder` on `--border-strong`;
  - no zebra, and the `--divider` rules unchanged.
- **The selected row (F6):** the `--primary-050` ground plus a **3px `--cursor` bar** on the logical
  start edge (`inset-inline-start`). It is navy in light and gold in dark, with **`z-index: 3`** so
  it stays visible over a pinned column (362's finding: v36 pinned cells paint over the row's
  `::before`). Grid row hover is `--card-2`.
- **IDs in Plex Mono (359, 362 §6).** Delivery, document and order numbers and store codes take
  `font-mono` as a column `cellClass` on the grids that show them. The Delivery no. is mono **600**.
  Money and quantities stay sans.
- **Native copy everywhere (F9):** `enableCellTextSelection` + `ensureDomOrder` on every grid, so a
  drag over cell text plus Ctrl+C copies. AG Grid Community only.

Where this lives is the existing grid theme module. Native copy may go into the shared grid options
that 383 turns into the core base `defaultColDef`. If it lands as per-grid props here, 383 folds it
into the base.

## Spine reach

Grid theme module · column definitions (cellClass on ID columns) · drive. No model, api or i18n.

## Proof (→ `tdd` red-green cycles)

- [ ] `npm run lint`: `check-contrast` carries `--grid-head-foreground` on `--grid-head` and
  `--cursor` on `--card` / `--primary-050` (362 §7) · lint gate
- [ ] `grid-theme-drive.mjs` (extend): on Deliveries, in light and dark, a row measures 26px, the
  header ground equals `--grid-head`, the Delivery no. cell computes Plex Mono at weight 600, and the
  selected row's cursor bar is visible over a user-pinned column · flow (Playwright)
- [ ] The same drive: drag-select text in a cell, press Ctrl+C, and the clipboard holds the text ·
  flow (Playwright)

## Boundaries

- No RTL or isolation changes. Those are 383, which builds on this params block.
- No i18n.

## Done when

Every grid renders at 26px rows with the header ground, mono IDs, a visible cursor bar over pinned
cells and native copy, and the extended `grid-theme-drive.mjs` passes in light and dark.

## Blocked by

[381](381-every-screen-paints-in-palette-b-with-ibm-plex.md)
