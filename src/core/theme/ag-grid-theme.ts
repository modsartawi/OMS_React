import { themeQuartz } from 'ag-grid-community'

/**
 * Dense AG Grid theme, painted from the app's design tokens (spec 082 D-11,
 * ticket 085).
 *
 * There is ONE params block, not a light/dark pair. Every colour is written as
 * `var(--token)`: the v36 serializer returns a string param value verbatim and
 * every derived colour is computed in CSS via `color-mix`, so a token reference
 * composites on every path. Because `.dark` reswitches every token anyway, one
 * block serves both themes and the grid re-tints with the app — it cannot
 * silently diverge from `global.css` the way the old mirrored hex blocks could.
 *
 * `data-ag-theme-mode` keeps a single passenger: `browserColorScheme`, a
 * literal (it drives native scrollbars) with no token. AG Grid reads that
 * attribute from any grid ancestor; both writers set it on `<html>`, which the
 * extracted selector matches via `:where(:root[data-ag-theme-mode=…], …)` —
 * `:root` IS `<html>`. `index.html` sets it pre-paint and `layout/theme.ts`
 * rewrites it in the same synchronous block as the `.dark` flip, so there is no
 * frame where the app is dark and the grid is light.
 *
 * Low spacing + small fonts pack the maximum rows/columns on screen — Screen 1
 * has 41 columns and density is a settled product decision (403 §7, D-9);
 * ticket 085 changed colour only.
 *
 * Two deliberate omissions, named so they are not rediscovered as fallout:
 * `columnBorder`/`headerColumnBorder` (Quartz's no-vertical-rules default
 * already matches), and zebra — `oddRowBackgroundColor` stays on `--card`
 * because `rowBorder` on `--divider` already carries the row rhythm and
 * `--card-2` is spent on hover.
 *
 * The selected-row accent bar has no param and lives in `global.css`, on
 * `.ag-row-selected:not(.ag-full-width-row)::before` — that rule carries the
 * evidence for why `::before` and not `::after`.
 */
export const omsGridTheme = themeQuartz
  .withParams({
    // Density — unchanged since 403.
    spacing: 4,
    fontSize: 12,
    fontFamily: "'Inter', 'Readex Pro', system-ui, sans-serif",
    headerFontSize: 12,
    headerFontWeight: 600,
    wrapperBorderRadius: 10,

    // Surfaces. The grid is a card sitting on the page, so its ground is
    // `--card`; hover moves to `--card-2`, which steps the correct direction in
    // BOTH themes (`--background` would read as a hole in light and invert in
    // dark, where the page is darker than the card).
    backgroundColor: 'var(--card)',
    foregroundColor: 'var(--foreground)',
    oddRowBackgroundColor: 'var(--card)',
    rowHoverColor: 'var(--card-2)',
    headerBackgroundColor: 'var(--muted)',
    headerTextColor: 'var(--muted-foreground)',

    // Rules. `--border` is the default for every edge; rows get the quieter
    // `--divider`, and the header and pinned-footer rules get `--border-strong`.
    borderColor: 'var(--border)',
    rowBorder: { color: 'var(--divider)' },
    headerRowBorder: { color: 'var(--border-strong)' },

    // Pinned totals footer.
    pinnedRowBackgroundColor: 'var(--muted)',
    pinnedRowTextColor: 'var(--foreground)',
    pinnedRowBorder: { color: 'var(--border-strong)' },

    // Selection + focus.
    selectedRowBackgroundColor: 'var(--primary-050)',
    accentColor: 'var(--primary)',

    // Filter inputs inside the grid — fields read stronger than card edges.
    inputBackgroundColor: 'var(--card)',
    inputBorder: { color: 'var(--input)' },
    invalidColor: 'var(--danger)',
  })
  .withParams({ browserColorScheme: 'light' }, 'light')
  .withParams({ browserColorScheme: 'dark' }, 'dark')

/** Compact row height (px) for the results grid. */
export const OMS_GRID_ROW_HEIGHT = 28

/** Compact header height (px) for the results grid. */
export const OMS_GRID_HEADER_HEIGHT = 30

/**
 * RTL is a grid OPTION, not a theme param, so the theme object cannot carry it.
 * This is its declared home: spread `{...omsGridDirection}` into every grid so
 * the seven instances flip together.
 *
 * Read once at module load, which is correct while `dir` is set before the app
 * boots (as `index.html` already does for the theme). Nothing in the app sets
 * `dir` today — wiring that switch is deliberately out of scope for ticket 085.
 */
export const omsGridDirection = {
  enableRtl: document.documentElement.dir === 'rtl',
} as const
