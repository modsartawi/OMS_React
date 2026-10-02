---
status: done
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

- [x] `npm run lint`: `check-contrast` carries `--grid-head-foreground` on `--grid-head` and
  `--cursor` on `--card` / `--primary-050` (362 §7) · lint gate
- [x] `grid-theme-drive.mjs` (extend): on Deliveries, in light and dark, a row measures 26px, the
  header ground equals `--grid-head`, the Delivery no. cell computes Plex Mono at weight 600, and the
  selected row's cursor bar is visible over a user-pinned column · flow (Playwright)
- [x] The same drive: drag-select text in a cell, press Ctrl+C, and the clipboard holds the text ·
  flow (Playwright)

## Boundaries

- No RTL or isolation changes. Those are 383, which builds on this params block.
- No i18n.

## Done when

Every grid renders at 26px rows with the header ground, mono IDs, a visible cursor bar over pinned
cells and native copy, and the extended `grid-theme-drive.mjs` passes in light and dark.

## Blocked by

[381](381-every-screen-paints-in-palette-b-with-ibm-plex.md)

## Comments

**2026-10-02 — done (AFK).** Unattended decisions are in `.afk/HITL-382.md`.

**What landed.**
- **Params (F8)**, still one block in `core/theme/ag-grid-theme.ts`. Rows are 26px and headers 28px (the
  two shared constants, so all 21 grids follow). Headers are 11.5px at 600, on the `--grid-head` pair.
  The wrapper radius is 8px, and `pinnedColumnBorder` sits on `--border-strong`. There is still no
  zebra, and the `--divider` rules are unchanged. `fontFamily: var(--font-sans)` had already landed in 381.
- **The cursor bar (F6).** The `global.css` rule paints `--cursor` (navy in light, gold in dark) at
  `z-index: 3`, so it stays above pinned cells. It is still on `inset-inline-start`.
- **Native copy (F9).** One `provideGlobalGridOptions({ enableCellTextSelection, ensureDomOrder })` at
  theme-module load reaches every grid. It is the app's ONE call: AG Grid replaces the global object, so
  383's `enableRtl` must join this object and not make a second call.
- **Mono IDs.** Delivery, document and order numbers and store codes take `font-mono` on every grid that
  shows them. Deliveries' Delivery no. is `font-mono font-semibold`. Money and quantities stay sans.
  The grid list is in HITL Q2.

**Proof.**
- `npm run lint` is clean. The contrast gate measures 144 pairs, including 381's `--grid-head-foreground`
  on `--grid-head` and `--cursor` on `--card` / `--primary-050`.
- `tools/grid-theme-drive.mjs` passes **125/125**. Deliveries is driven in light, dark, LTR and RTL, with
  an Arabic stub row in RTL. It checks:
  - all 18 params resolve to their tokens;
  - rows measure 26px and the header 28px, with 11.5/600 labels and an 8px wrapper;
  - the Delivery no. computes and *renders* (CDP) Plex Mono SemiBold, with the 600 face loaded;
  - the other IDs are mono at 400, and money and names are sans;
  - the cursor bar is a `--cursor` pixel over a user-pinned Delivery no.; the control run at z-index 1
    loses that pixel;
  - a drag over cell text plus Ctrl+C puts `8000002` on the clipboard.

  The other modules also assert 26/28 rows and selectable cell text. Coverage is Document Details ×4
  tabs, Change Store and BBY. Simulation mounts no grid without a result, so it is skipped and says so.
- `tools/foundation-drive.mjs` passes **72/72**. Its sans-cell probe moved off the now-mono Delivery no.
- Also green: the `document-items`, `document-rtl`, `central-invoice`, `central-invoice-list` and
  `bby-inquiry` drives, vitest (3133), typecheck and build.

**Reviews.**
- `/code-review` found nothing.
- `/standards-review` found no hard violation on either axis, and three of its catches landed:
  - Loy Actions' `branchId`, a store code, is now mono;
  - the Delivery no. no longer overrides an `idCol` spread;
  - the theme names its global-options call as the only one.

  Judgement calls are logged in the HITL file:
  - the 44px settlement lanes;
  - no shared ID-class constant;
  - the `font-mono` / `font-mono text-[12px]` split.

