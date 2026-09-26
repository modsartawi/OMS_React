import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import { SLIP_ABSENT, isKnownSlipCount, slipCountText } from './slips'

/**
 * The **Slips** column Ready and Cash Collections share (ticket 320, BackOffice
 * 2034) — built once, because the two grids must draw an unknown count the same way.
 *
 * 🔑 A known count, `0` included, draws as the number. An unknown one (`null`)
 * draws the dash, with its meaning said to a screen reader through `t()` — a bare
 * `—` would be read as nothing, and "unknown" is exactly what it must not lose.
 *
 * ⚠️ **Not clickable yet**: no link, no button. The drawer is ticket 321's.
 *
 * A `valueGetter` rather than a `field`, so the one builder types over both rows;
 * `colId: 'slipCount'` is the handle a drive and the grid state key on.
 */
export function slipCountColumn<Row extends { slipCount: number | null }>(t: TFunction): ColDef<Row> {
  const unknownLabel = t('slips.countUnknown')
  return {
    headerName: t('slips.column'),
    colId: 'slipCount',
    width: 100,
    type: 'numericColumn',
    filter: 'agNumberColumnFilter',
    cellClass: 'text-end tabular-nums',
    valueGetter: (p) => p.data?.slipCount ?? null,
    valueFormatter: (p) => slipCountText(p.value),
    cellRenderer: (p: ICellRendererParams<Row, number | null>) =>
      isKnownSlipCount(p.value) ? (
        String(p.value)
      ) : (
        <span title={unknownLabel}>
          <span aria-hidden>{SLIP_ABSENT}</span>
          <span className="sr-only">{unknownLabel}</span>
        </span>
      ),
  }
}
