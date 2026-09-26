import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import { SLIP_ABSENT, isKnownSlipCount, slipCountText, slipDayOf, type SlipDay, type SlipDayRow } from './slips'

/**
 * The **Slips** column Ready and Cash Collections share (ticket 320, BackOffice
 * 2034) — built once, because the two grids must draw an unknown count the same way.
 *
 * 🔑 A known count, `0` included, draws as the number. An unknown one (`null`)
 * draws the dash, with its meaning said to a screen reader through `t()` — a bare
 * `—` would be read as nothing, and "unknown" is exactly what it must not lose.
 *
 * **Clickable (ticket 321)** when the Page hands in `onOpen`: a known count on a
 * row with an owner key (`slipDayOf`) is a button that opens that store day's
 * drawer — `0` included, since that is where 322's Add goes. The dash is never a
 * button: an unknown count opens nothing.
 *
 * A `valueGetter` rather than a `field`, so the one builder types over both rows;
 * `colId: 'slipCount'` is the handle a drive and the grid state key on.
 */
export function slipCountColumn<Row extends SlipDayRow>(
  t: TFunction,
  onOpen?: (day: SlipDay) => void,
): ColDef<Row> {
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
    cellRenderer: (p: ICellRendererParams<Row, number | null>) => {
      if (!isKnownSlipCount(p.value))
        return (
          <span title={unknownLabel}>
            <span aria-hidden>{SLIP_ABSENT}</span>
            <span className="sr-only">{unknownLabel}</span>
          </span>
        )
      const day = slipDayOf(p.data)
      if (!onOpen || !day) return String(p.value)
      return (
        <button
          type="button"
          data-slip-open={day.ownerKey}
          onClick={() => onOpen(day)}
          aria-label={t('slips.open', { value: p.value, store: day.store, day: day.businessDate })}
          className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline"
        >
          {String(p.value)}
        </button>
      )
    },
  }
}
