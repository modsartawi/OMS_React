import { themeQuartz } from 'ag-grid-community'

/**
 * Dense AG Grid theme with light + dark variants. AG Grid v33+ picks the named
 * variant from `data-ag-theme-mode` on `<body>`; index.html sets it pre-paint and
 * the theme store rewrites it in the same paint as the `.dark` class flip.
 *
 * Low spacing + small fonts pack the maximum rows/columns on screen — Screen 1
 * has 41 columns and density is a product decision (403 §7, D-9).
 *
 * Restyle (464): the grid reads as part of the warm-neutral design language —
 * no zebra striping (hairline row borders carry the rhythm, like claude.ai's
 * list rows), warm surfaces matching the app tokens, terracotta only on
 * selection/range accents. Values are hex because AG params don't resolve CSS
 * vars in all paths; keep them in sync with global.css.
 */
const denseSharedParams = {
  spacing: 4,
  fontSize: 12,
  fontFamily: "'Inter', 'Readex Pro', system-ui, sans-serif",
  headerFontSize: 12,
  headerFontWeight: 600,
  wrapperBorderRadius: 10,
} as const

export const omsGridTheme = themeQuartz
  .withParams(
    {
      ...denseSharedParams,
      backgroundColor: '#ffffff',
      foregroundColor: '#26241f',
      headerBackgroundColor: '#f5f4ef',
      headerTextColor: '#57544c',
      oddRowBackgroundColor: '#ffffff',
      rowHoverColor: '#f3f2ec',
      selectedRowBackgroundColor: '#d9775726',
      accentColor: '#c96442',
      borderColor: '#e8e6df',
      browserColorScheme: 'light',
    },
    'light',
  )
  .withParams(
    {
      ...denseSharedParams,
      backgroundColor: '#262521',
      foregroundColor: '#eeede7',
      headerBackgroundColor: '#21201c',
      headerTextColor: '#a8a598',
      oddRowBackgroundColor: '#262521',
      rowHoverColor: '#2c2b26',
      selectedRowBackgroundColor: '#d977572e',
      accentColor: '#e08d70',
      borderColor: '#393731',
      browserColorScheme: 'dark',
    },
    'dark',
  )

/** Compact row height (px) for the results grid. */
export const OMS_GRID_ROW_HEIGHT = 28

/** Compact header height (px) for the results grid. */
export const OMS_GRID_HEADER_HEIGHT = 30
