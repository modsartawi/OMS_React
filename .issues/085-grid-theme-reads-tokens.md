---
status: done
spec: 082
blocked-by: 084
---

# 085 — theGridReadsTheAppTokensInsteadOfItsOwnHexCopy

## What to build

Every AG Grid in the app takes its colour from the same tokens the page around it uses, so the grid
and the app can no longer silently diverge.

Today `core/theme/ag-grid-theme.ts` hand-mirrors twenty hex values across a `light` and a `dark`
params block, with a comment instructing the reader to keep them in sync with `global.css` by hand.
Nothing enforces it.

- **One params block, not two.** `var()` works on the installed `ag-grid-community@36.0.1` — the v36
  serializer returns a string param value verbatim and every derived colour is computed in CSS via
  `color-mix`, so `backgroundColor: 'var(--card)'` composites correctly. Because `.dark` already
  reswitches every token, one block serves both themes and the two mirrored blocks collapse into one.
  `data-ag-theme-mode` keeps a single passenger: `browserColorScheme`, which is a literal (native
  scrollbars), not a colour.
- **Seventeen params** — the ten remapped and seven added in spec 082 D-11, each verified present in
  the 36.0.1 bundle by name. Density params (`spacing`, `fontSize`, `fontFamily`, `headerFontSize`,
  `headerFontWeight`, `wrapperBorderRadius`) are **unchanged** — density is a settled product
  decision.
- **`rowHoverColor` reads `--card-2`, not `--background`.** On a `--card` grid inside a
  `--background` page, hovering to the page colour reads as a hole rather than a highlight — and in
  dark it inverts, because the page is darker than the card. `--card-2` moves the correct direction
  in both themes by construction.
- **The selected-row accent bar** is the one genuine CSS escape: `.ag-row-selected::after` with
  `inset-inline-start: 0` + `inset-block: 0`. AG exposes no per-row edge marker param, and `::before`
  is unavailable (AG paints its own selection overlay there). It must **not** be a `box-shadow`
  inset — `box-shadow` offsets are physical, have no logical form, and do not mirror.
- **The two `cellStyle` hex overrides** — `oms/deliveries/columns.ts:46` and
  `oms/document/columns.ts:190`, both `#c62828` on `#ffffff` — become `var(--danger)` with the ink
  flipped to `var(--primary-foreground)`. Under 084's R2 the dark fill is a light tonal fill and
  white measures 2.2:1 on it. These are inline styles, so `var()` resolves against `:root`/`.dark`
  regardless of how the theme is written. **The comment documenting a light-mode-only contrast check
  is rewritten with the pair, not deleted** (`columns.ts:42` and `:182`).
- **`enableRtl` gets a declared home** — one derived value exported beside the theme object, ready to
  be spread into every grid. It is a grid *option*, not a theme param, so the theme cannot carry it.
  Today it is set on one of seven grid instances and reads a `dir` attribute nothing in the app ever
  sets. **Declare the home only; wiring the `dir` switch is explicitly out of scope.**
- **Two stale comments fixed.** The module header says the values are hex "because AG params don't
  resolve CSS vars in all paths" — that is the claim this ticket disproves. It also says AG Grid
  reads `data-ag-theme-mode` from `<body>`; both writers set it on `<html>`, and the extracted
  selector is `:where(:root[data-ag-theme-mode=…], body[…], .ag-theme-mode[…])` — `:root` **is**
  `<html>`, so the code is right and the comment is wrong. Worth fixing because a reader following
  the docs would "fix" a working line.

**Deliberately not set**, named so they are not discovered as fallout: `columnBorder` /
`headerColumnBorder` (Quartz's no-vertical-rules default already matches), the chrome family
(`chromeBackgroundColor`, `menuBackgroundColor`, `tabBackgroundColor`, `sideBarBackgroundColor`,
`button*`), and `rangeSelection*` (Enterprise). **Zebra stays off** — `rowBorder` on `--divider`
already carries row rhythm, and `--card-2` is spent on hover, so zebra-on would cost a token that
does not exist.

**Verified before slicing:** five modules import `omsGridTheme`, carrying seven grid instances
(`ChangeStoreDialog` has two, and `DetailGrid` is reused across four tabs).

## Spine reach

`core/theme/ag-grid-theme.ts` (params + the exported RTL value) · one CSS rule in `global.css` ·
two feature `columns.ts` modules (`cellStyle` + comments) · drive.

**Amended on build:** `features/pricing/bonus-buy-inquiry/BonusBuyInquiryPage.tsx` too — it is the
one grid of seven that hand-rolled `enableRtl`, so declaring the value's home and leaving that line
duplicating it would have shipped the divergence this ticket exists to remove. Net-neutral: an
identical expression replaced by the shared export. The other six grids stay untouched.

## Proof (→ `tdd` red-green cycles)

Verified by `tools/grid-theme-drive.mjs` (new) — **36 passed, 0 failed, 12 skipped**, plus
`npm run typecheck`, `npm run lint` and `npm run build`. The drive mocks every `/api/**` envelope
(SIS.Api's delivery list needs a store grant a dev session doesn't have — the skip
`tools/palette-drive.mjs` already records) and reads computed styles back out of the real, painted
DOM in both themes. Both sides of every assertion are read from the same live document, so a check
reads "the grid equals the app", never "the grid equals a hex retyped in the test". The matrix is
data-dependent, so the drive **prints what it could not reach** next to the pass count — a green
total never stands in for full coverage.

- [x] Drive the grid modules in **both themes** — Deliveries, Document Details' four tabs, the
      Change Store picker, BBY Inquiry — and confirm header ground, header rule, row rules, hover,
      selection, pinned footer and filter inputs all read from the tokens · flow
      (`tools/grid-theme-drive.mjs`). All **17** params asserted on the Deliveries grid as the
      emitted `--ag-*` custom properties (where a `var()` that failed to serialise would surface as
      an empty string) *and* on painted elements for the ones that reach pixels; every other module
      re-asserts header ground, header ink, row ground and cell ink through its own scope, plus
      selection where the grid has it. The **12 named skips** are: row selection on the four Details
      tabs and BBY (read-only inquiry grids — selection is off, so there is nothing to assert), the
      Conditions tab (no rows in the mocked payload), and Sim's bonus-buy panel (its grid only
      mounts on a simulation result; mocking a whole `SimulationResult` was out of proportion — it
      renders from the same single params block, which is asserted).
- [x] `selectedRowShowsAnAccentBarOnItsLeadingEdge` — the bar renders on the inline-start edge
      (`--primary`, 3px, `left: 0px`) and mirrors to `right: 0px` under `dir="rtl"` · flow.
      **Deviation, verified not assumed:** it rides `::before`, not the `::after` this ticket named.
      In the installed `36.0.1`, `.ag-row::after` carries the row's own background layer
      (`background-color: var(--ag-data-background-color)`) plus the row-drag highlight, so taking
      it drops a paint layer AND buries the bar under the positioned cell containers (measured: the
      bar was invisible on `::after`). v36 paints the selection/hover overlay on a **child**
      (`.ag-row-selected .ag-grid-scrolling-cells::before`), leaving the ROW's own `::before` free
      for every non-full-width row. The rule is `.ag-row-selected:not(.ag-full-width-row)::before`
      with `z-index`, and the drive asserts the row's own `::after` layer survives.
- [x] `aFailedJobsCellIsReadableInBothThemes` — the `cellStyle` cell renders `--danger` ground with
      `--primary-foreground` ink (light `#c23b41`/white, dark `#df6768`/`#121c27`) · flow. Both the
      Deliveries cell and the Document Details Jobs-tab row are asserted.
- [x] Toggle the theme with a grid on screen and confirm there is no frame where the app is dark and
      the grid is light — one params block means the grid re-tints with `.dark` itself; the only
      mode-scoped passenger left is `browserColorScheme`, asserted to still switch on
      `data-ag-theme-mode`. Verified via `typecheck` + drive.

## Boundaries

No API, no i18n, no nav change. **The `dir` switch is out of scope** — this ticket declares
`enableRtl`'s home and stops. The two `cellStyle` values are colour literals inside `.ts` strings,
which ticket 089's gates must be able to see (see its open question).

## Done when

`core/theme/ag-grid-theme.ts` contains **one** params block reading `var(--token)` throughout, no
mirrored hex, no `#c62828` anywhere in `src/`, and all seven grid instances render correctly in both
themes.

## Blocked by

[084](084-pos-tokens-both-themes.md) — the tokens the theme reads must exist first.

## What shipped

`core/theme/ag-grid-theme.ts` is now **one** params block of `var(--token)` values plus two
one-line mode blocks carrying nothing but `browserColorScheme`. Twenty mirrored hex values are gone;
the two stale comments are corrected (`var()` DOES resolve on 36.0.1 — the serialiser returns a
string param verbatim; and `data-ag-theme-mode` on `<html>` IS matched, because the extracted
selector's `:where(:root[…])` **is** `<html>`).

`enableRtl` has a declared home — `omsGridDirection`, exported beside the theme, ready to spread
into every grid. The one call site that hand-rolled it (`BonusBuyInquiryPage`) now spreads the
shared value; the other six grids are untouched and the `dir` switch stays out of scope, as ruled.

**One note for [089](089-colour-literal-lint-gates.md):** the two `cellStyle` values are now
`var(--danger)` / `var(--primary-foreground)` inside `.ts` strings, so 089's literal gate has no
colour literal left to see in either module — its open question about scanning `.ts` strings is
narrower than it was.
