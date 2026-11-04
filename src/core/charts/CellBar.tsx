import type { ICellRendererParams } from 'ag-grid-community'
import Ltr from '@/core/ui/Ltr'

/**
 * The table form's cell-bar renderer (ticket 769): a numeric cell drawn as a bar in proportion to its
 * column's largest value, with the figure over it.
 *
 * It replaces the grid base's `BdiCell` on a measure column, so it **isolates its own whole value**
 * (`Ltr`: a figure is a machine value) — and it shows `valueFormatted`, so the column's
 * `valueFormatter` survives, the trap `@/core/theme/grid-base` names. Nothing is added to the text:
 * Ctrl+C and an export carry the value as formatted. The bar grows from the inline start, so it
 * mirrors with the grid under Arabic.
 *
 * `max` comes from the column's `cellRendererParams` (the view model's column maximum).
 */
export interface CellBarParams {
  max: number
}

export default function CellBar({ value, valueFormatted, max }: ICellRendererParams & CellBarParams) {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.abs(value) : 0
  const width = max > 0 ? Math.min(100, (n / max) * 100) : 0
  return (
    <span className="relative flex h-full items-center" data-cell-bar={Math.round(width)}>
      <span
        className="absolute inset-y-1 start-0 rounded-sm"
        style={{ width: `${width}%`, background: 'color-mix(in oklab, var(--chart-1) 28%, transparent)' }}
        aria-hidden
      />
      <span className="relative ms-1 tabular-nums">
        <Ltr>{valueFormatted ?? (value == null ? '' : String(value))}</Ltr>
      </span>
    </span>
  )
}
