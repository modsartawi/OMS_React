import { useMemo, useState, type KeyboardEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { DeliveryStatisticsBucket, StatisticsGranularity } from '@/core/models/delivery-statistics'
import { bootDirection } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { chartModel } from './chart-model'

/** A bucket's slot in the plot's own units; the two columns and the space around them share it. */
const SLOT = 10
const BAR = 3.5
/** The column at the reading start of a slot, and the one after it. */
const FIRST = (SLOT - 2 * BAR - 1) / 2
const SECOND = FIRST + BAR + 1
/** The axis' lines, top to bottom, as a share of the plot's height: the top, two thirds, one third, 0. */
const LINES = [0, 1 / 3, 2 / 3, 1]

const RTL = bootDirection === 'rtl'

/**
 * Came in and Handed over per bucket, side by side (ticket 486): by the hour for Today and
 * Yesterday, by the day for a Range — the till's two column charts on one axis. Read-only.
 *
 * Hand-rolled inline SVG on the theme tokens (ruled: the app has no chart library and this is its
 * only chart). Time runs in reading order: under RTL the first bucket sits at the right. The SVG
 * places its columns by `bootDirection` — direction is a boot fact, never flipped live — and the
 * axis labels are HTML in a flex row, so they follow `dir` themselves and stay under their columns.
 *
 * Pointing at a bucket, or focusing the plot and stepping with the arrow keys, writes its two
 * values in the readout above it; every value there and on the axes is isolated (`Ltr`).
 */
export default function SeriesChart({
  series,
  granularity,
}: {
  series: readonly DeliveryStatisticsBucket[]
  granularity: StatisticsGranularity
}) {
  const { t } = useTranslation('delivery-statistics')
  const dash = t('dash')
  const model = useMemo(() => chartModel(series, granularity, dash), [series, granularity, dash])
  const [active, setActive] = useState<number | null>(null)
  // Whether the plot holds focus: the keyboard owns the readout then, and the pointer leaving does not clear it.
  const [focused, setFocused] = useState(false)
  const count = model.columns.length
  const shown = active !== null && active < count ? model.columns[active] : null
  /** A slot's x in the plot: in reading order, so from the right under RTL. */
  const slotX = (i: number) => (RTL ? count - 1 - i : i) * SLOT

  function step(e: KeyboardEvent<HTMLDivElement>) {
    if (count === 0) return
    // The arrow that points along the reading direction steps forward in time.
    const forward = RTL ? 'ArrowLeft' : 'ArrowRight'
    const back = RTL ? 'ArrowRight' : 'ArrowLeft'
    const at = active ?? -1
    const next =
      e.key === forward ? Math.min(count - 1, at + 1)
      : e.key === back ? Math.max(0, at < 0 ? count - 1 : at - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? count - 1
      : null
    if (next === null) return
    e.preventDefault()
    setActive(next)
  }

  return (
    <section className="flex flex-col gap-2" data-statistics-band="chart" data-chart-granularity={granularity}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(`chart.caption.${granularity}`)}</h2>
        <ul className="flex items-center gap-4 text-xs text-muted-foreground" data-chart-legend="">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
            {t('flow.cameIn')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-success" aria-hidden />
            {t('flow.handedOver')}
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3">
        {/* Announced only while the keyboard steps: a pointer sweeping 31 columns would queue 31 announcements. */}
        <p className="min-h-5 text-sm" aria-live={focused ? 'polite' : 'off'} data-chart-readout={shown ? String(active) : ''}>
          {shown ? (
            <Trans
              t={t}
              i18nKey="chart.readout"
              values={{ bucket: shown.readout, cameIn: shown.cameIn, handedOver: shown.handedOver }}
              components={{ v: <Ltr /> }}
            />
          ) : (
            <span className="text-muted-foreground">{t(count ? 'chart.hint' : 'chart.empty')}</span>
          )}
        </p>

        {count > 0 && (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
            {/* The value axis, at the reading start. */}
            <div className="relative h-48 min-w-8 text-[11px] text-muted-foreground tabular-nums" aria-hidden data-chart-axis="">
              {model.axis.map((value, i) => (
                <span key={i} className="absolute end-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${LINES[i] * 100}%` }}>
                  <Ltr>{value}</Ltr>
                </span>
              ))}
            </div>

            <div
              role="group"
              tabIndex={0}
              aria-label={t('chart.label')}
              onKeyDown={step}
              onFocus={() => {
                setFocused(true)
                setActive((a) => a ?? 0)
              }}
              onBlur={() => {
                setFocused(false)
                setActive(null)
              }}
              onMouseLeave={() => !focused && setActive(null)}
              className="relative h-48 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-chart-plot=""
            >
              <svg
                className="absolute inset-0 h-full w-full overflow-visible"
                viewBox={`0 0 ${count * SLOT} 100`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {LINES.map((at) => (
                  <line
                    key={at}
                    x1={0}
                    x2={count * SLOT}
                    y1={at * 100}
                    y2={at * 100}
                    className={at === 1 ? 'stroke-border-strong' : 'stroke-border'}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {model.columns.map((column, i) => {
                  const x = slotX(i)
                  // The bucket's first column (Came in) at the reading start of its slot.
                  const cameInX = x + (RTL ? SECOND : FIRST)
                  const handedOverX = x + (RTL ? FIRST : SECOND)
                  return (
                    <g key={i} data-chart-column={i} onMouseEnter={() => setActive(i)}>
                      <rect x={x} y={0} width={SLOT} height={100} className={active === i ? 'fill-muted' : 'fill-transparent'} />
                      {column.cameInShare > 0 && (
                        <rect
                          x={cameInX}
                          y={100 - column.cameInShare * 100}
                          width={BAR}
                          height={column.cameInShare * 100}
                          className="fill-primary"
                          data-chart-bar="cameIn"
                        />
                      )}
                      {column.handedOverShare > 0 && (
                        <rect
                          x={handedOverX}
                          y={100 - column.handedOverShare * 100}
                          width={BAR}
                          height={column.handedOverShare * 100}
                          className="fill-success"
                          data-chart-bar="handedOver"
                        />
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* The bucket axis: a flex row, so under RTL it runs right to left like the columns. */}
            <div aria-hidden />
            <div className="flex text-[11px] text-muted-foreground tabular-nums" aria-hidden data-chart-labels="">
              {model.columns.map((column, i) => (
                <span key={i} className="min-w-0 flex-1 text-center" data-chart-label={i}>
                  {column.label && <Ltr>{column.label}</Ltr>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
