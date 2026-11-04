import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { formatValue } from './format'
import { sequentialFill, SEQUENTIAL_FLOOR } from './sequential'
import type { MeasureUnit } from '@/core/models/analytics'

/**
 * The heatmap form — 1 measure × 2 dimensions (ticket 769). Recharts has none, so this draws it: an
 * HTML grid of cells on ONE hue (`./sequential`, decided per cell by `toHeatmapView`), not SVG, so a
 * screen reader walks it as the table it is.
 *
 * - The grid sits in the `dir="ltr"` box like every chart; under Arabic the columns run right to left
 *   and the row labels stand on the right, mirrored by the order this component lays out
 *   (`./direction`), and the labels anchor to the right edge.
 * - Every cell has a tooltip (hover or focus) naming its two members and its value.
 * - A scale strip reads the range, faint to full; an empty cell is unpainted.
 * - **The table view:** a toggle lists every cell as a row (x, y, value), the "table view for every
 *   chart" of 766 §F.
 */
export interface HeatmapAxisMember {
  member: string
  label: string
}

export interface HeatmapCellPoint {
  x: string
  y: string
  value: number | null
  fill: string | null
}

export default function HeatmapChart({
  xs,
  ys,
  cells,
  min,
  max,
  xLabel,
  yLabel,
  unit,
  measureLabel,
  locale,
  ariaLabel,
}: {
  xs: readonly HeatmapAxisMember[]
  ys: readonly HeatmapAxisMember[]
  cells: readonly HeatmapCellPoint[]
  min: number | null
  max: number | null
  xLabel: string
  yLabel: string
  unit: MeasureUnit
  measureLabel: string
  locale: string
  ariaLabel: string
}) {
  const { t } = useTranslation('common')
  const [tableView, setTableView] = useState(false)
  const [hover, setHover] = useState<{ cell: HeatmapCellPoint; left: number; top: number } | null>(null)
  const byKey = new Map(cells.map((c) => [`${c.x}\u0000${c.y}`, c]))
  const xLabels = new Map(xs.map((x) => [x.member, x.label]))
  const yLabels = new Map(ys.map((y) => [y.member, y.label]))
  // Mirrored by layout order only, inside the LTR box.
  const columns = chartMirror.rtl ? [...xs].reverse() : xs
  const rtl = chartMirror.rtl

  const rowHead = (y: HeatmapAxisMember) => (
    <th scope="row" className={`whitespace-nowrap px-2 text-xs font-normal text-muted-foreground ${rtl ? 'text-right' : 'text-left'}`}>
      <bdi>{y.label}</bdi>
    </th>
  )
  const corner = <td aria-hidden />

  return (
    <div className="flex flex-col gap-3">
      {/* 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR, and its labels anchor
          by the boot direction (`./direction`); physical `text-left`/`text-right` is that anchor. */}
      <div dir={CHART_BOX_DIR} className="relative overflow-x-auto" data-chart="heatmap" role="figure" aria-label={ariaLabel}>
        <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
          <caption className="sr-only">{ariaLabel}</caption>
          <thead>
            <tr>
              {!rtl && corner}
              {columns.map((x) => (
                <th key={x.member} scope="col" className="px-1 pb-1 text-center text-xs font-normal text-muted-foreground" data-heatmap-x={x.member}>
                  <bdi>{x.label}</bdi>
                </th>
              ))}
              {rtl && corner}
            </tr>
          </thead>
          <tbody>
            {ys.map((y) => (
              <tr key={y.member} data-heatmap-y={y.member}>
                {!rtl && rowHead(y)}
                {columns.map((x) => {
                  const cell = byKey.get(`${x.member}\u0000${y.member}`) ?? { x: x.member, y: y.member, value: null, fill: null }
                  const words = t('charts.heatmapCell', {
                    value: fsi(cell.value === null ? t('charts.noValue') : formatValue(cell.value, unit, locale)),
                    x: fsi(x.label),
                    y: fsi(y.label),
                  })
                  const show = (el: HTMLElement) => {
                    const box = el.closest('[data-chart="heatmap"]')!.getBoundingClientRect()
                    const r = el.getBoundingClientRect()
                    setHover({ cell, left: r.left - box.left + r.width / 2, top: r.top - box.top })
                  }
                  return (
                    <td
                      key={x.member}
                      className="h-7 min-w-8 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ background: cell.fill ?? 'transparent', boxShadow: cell.fill ? undefined : 'inset 0 0 0 1px var(--divider)' }}
                      tabIndex={0}
                      aria-label={words}
                      data-heatmap-cell={`${x.member}|${y.member}`}
                      data-fill={cell.fill ?? ''}
                      onMouseEnter={(e) => show(e.currentTarget)}
                      onFocus={(e) => show(e.currentTarget)}
                      onMouseLeave={() => setHover(null)}
                      onBlur={() => setHover(null)}
                    />
                  )
                })}
                {rtl && rowHead(y)}
              </tr>
            ))}
          </tbody>
        </table>
        {hover && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-border-strong bg-card px-2.5 py-1.5 text-xs text-foreground shadow-pop"
            style={{ left: hover.left, top: hover.top - 4 }}
            dir={rtl ? 'rtl' : 'ltr'}
            role="tooltip"
            data-heatmap-tooltip
          >
            <div className="font-semibold">
              <bdi>{xLabels.get(hover.cell.x) ?? hover.cell.x}</bdi>
            </div>
            <div className="text-muted-foreground">
              <bdi>{yLabels.get(hover.cell.y) ?? hover.cell.y}</bdi>
            </div>
            <div>
              <bdi>{measureLabel}</bdi>{' '}
              <Ltr>{hover.cell.value === null ? t('charts.noValue') : formatValue(hover.cell.value, unit, locale)}</Ltr>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-heatmap-scale>
          <span className="tabular-nums">
            <Ltr>{min === null ? '' : formatValue(min, unit, locale)}</Ltr>
          </span>
          <span
            className="h-2.5 w-32 rounded-full"
            aria-hidden
            style={{
              // A machine visual: faint → full along the reading direction.
              background: `linear-gradient(to ${rtl ? 'left' : 'right'}, ${sequentialFill(SEQUENTIAL_FLOOR)}, ${sequentialFill(100)})`,
            }}
          />
          <span className="tabular-nums">
            <Ltr>{max === null ? '' : formatValue(max, unit, locale)}</Ltr>
          </span>
        </div>
        <Button variant="secondary" onClick={() => setTableView((v) => !v)} aria-expanded={tableView} data-heatmap-table-toggle>
          {t(tableView ? 'charts.hideTable' : 'charts.showTable')}
        </Button>
      </div>

      {tableView && (
        <table className="w-full text-sm" data-heatmap-table>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-1 text-start font-medium">
                <bdi>{xLabel}</bdi>
              </th>
              <th className="py-1 text-start font-medium">
                <bdi>{yLabel}</bdi>
              </th>
              <th className="py-1 text-end font-medium">
                <bdi>{measureLabel}</bdi>
              </th>
            </tr>
          </thead>
          <tbody>
            {cells.map((c) => (
              <tr key={`${c.x}|${c.y}`} className="border-b border-divider">
                <td className="py-1">
                  <bdi>{xLabels.get(c.x) ?? c.x}</bdi>
                </td>
                <td className="py-1">
                  <bdi>{yLabels.get(c.y) ?? c.y}</bdi>
                </td>
                <td className="py-1 text-end tabular-nums">
                  <Ltr>{c.value === null ? '' : formatValue(c.value, unit, locale)}</Ltr>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
