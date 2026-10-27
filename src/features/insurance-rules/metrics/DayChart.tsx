import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { bootDirection } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { formatDay } from '@/core/util/date-format'
import { totalFires, type MetricsRow } from './model'
import { Legend } from './bars'

const SLOT = 10
const BAR = 6
const RTL = bootDirection === 'rtl'
const FILL = { refuse: 'fill-danger', override: 'fill-post', warn: 'fill-attention' } as const

/**
 * Fires per local day, stacked REFUSE (bottom) → OVERRIDE → WARN (ticket 615). Hand-rolled inline SVG on the
 * theme tokens, as `delivery-statistics/SeriesChart` (the app has no chart library). Days run in reading order:
 * the SVG places its columns by `bootDirection` (a boot fact), and the day labels are an HTML flex row, so they
 * follow `dir` themselves. Pointing at a day writes its numbers above the plot; the table below carries every
 * value, so the plot itself is `aria-hidden`.
 */
export default function DayChart({ rows }: { rows: readonly MetricsRow[] }) {
  const { t } = useTranslation('insurance-metrics')
  const [active, setActive] = useState<number | null>(null)
  const count = rows.length
  const max = Math.max(1, ...rows.map((r) => totalFires(r.fires)))
  const shown = active !== null ? rows[active] : null
  const x = (i: number) => (RTL ? count - 1 - i : i) * SLOT + (SLOT - BAR) / 2

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-day-chart={String(count)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('chart.caption')}</h2>
        <Legend kind="severity" />
      </div>
      <p className="min-h-5 text-sm" data-chart-readout={shown ? shown.key : ''}>
        {shown ? (
          <Trans
            t={t}
            i18nKey="chart.readout"
            values={{ day: formatDay(shown.key), refuse: shown.fires.refuse, override: shown.fires.override, warn: shown.fires.warn }}
            components={{ v: <Ltr /> }}
          />
        ) : (
          <span className="text-muted-foreground">{t('chart.hint')}</span>
        )}
      </p>
      <div className="relative h-40" onMouseLeave={() => setActive(null)} data-chart-plot="">
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${count * SLOT} 100`} preserveAspectRatio="none" aria-hidden>
          <line x1={0} x2={count * SLOT} y1={100} y2={100} className="stroke-border-strong" vectorEffect="non-scaling-stroke" />
          {rows.map((r, i) => {
            let y = 100
            return (
              <g key={r.key} data-chart-day={r.key} onMouseEnter={() => setActive(i)}>
                <rect x={x(i) - (SLOT - BAR) / 2} y={0} width={SLOT} height={100} className={active === i ? 'fill-muted' : 'fill-transparent'} />
                {(['refuse', 'override', 'warn'] as const).map((s) => {
                  const h = (r.fires[s] / max) * 100
                  if (h <= 0) return null
                  y -= h
                  return <rect key={s} x={x(i)} y={y} width={BAR} height={h} className={FILL[s]} data-chart-bar={s} />
                })}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex text-[11px] text-muted-foreground tabular-nums" aria-hidden data-chart-labels="">
        {rows.map((r, i) => (
          <span key={r.key} className="min-w-0 flex-1 overflow-hidden text-center">
            {(i === 0 || i === count - 1 || count <= 10) && <Ltr>{r.key.slice(5)}</Ltr>}
          </span>
        ))}
      </div>
    </section>
  )
}
