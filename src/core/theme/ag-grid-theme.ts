import { themeQuartz } from 'ag-grid-community'

/**
 * Dense AG Grid theme with light + dark variants. AG Grid v33+ picks the named
 * variant from `data-ag-theme-mode` on `<body>`; index.html sets it pre-paint and
 * the theme store rewrites it in the same paint as the `.dark` class flip.
 *
 * Low spacing + small fonts pack the maximum rows/columns on screen — Screen 1
 * has 41 columns and density is a product decision (403 §7, D-9).
 */
const denseSharedParams = {
  spacing: 4,
  fontSize: 12,
  headerFontSize: 12,
  headerFontWeight: 600,
  wrapperBorderRadius: 4,
} as const

export const omsGridTheme = themeQuartz
  .withParams(
    {
      ...denseSharedParams,
      headerBackgroundColor: '#eef2f7',
      oddRowBackgroundColor: '#f6f8fb',
      borderColor: '#e2e8f0',
      browserColorScheme: 'light',
    },
    'light',
  )
  .withParams(
    {
      ...denseSharedParams,
      backgroundColor: '#0f172a',
      foregroundColor: '#e2e8f0',
      headerBackgroundColor: '#1e293b',
      oddRowBackgroundColor: '#152033',
      borderColor: '#334155',
      browserColorScheme: 'dark',
    },
    'dark',
  )

/** Compact row height (px) for the results grid. */
export const OMS_GRID_ROW_HEIGHT = 28

/** Compact header height (px) for the results grid. */
export const OMS_GRID_HEADER_HEIGHT = 30
