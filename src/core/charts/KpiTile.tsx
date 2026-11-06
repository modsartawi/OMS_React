import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { CHART_TOOLTIP_STYLE } from './chrome'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { formatAs } from './format'
import { slotColour } from './slots'
import type { AnalyticsNumberFormat, MeasureUnit } from '@/core/models/analytics'

/**
 * The KPI tile (ticket 768; 755 Q3): one headline figure, its change against the previous period
 * (▲▼ % from the answer's `previous` rows) and a sparkline when the view is asked over time.
 *
 * The change is drawn in INK, not in a status colour: whether "up" is good depends on the measure
 * (orders up is good, minutes late up is not), and the status colours are never series colours (766 §F).
 * The arrow and the words say the direction; the colour does not.
 *
 * Every figure is a machine value, isolated with `Ltr`; the sparkline sits in the `dir="ltr"` box and
 * mirrors through `reversed`, like every chart (`./direction`).
 */
export interface KpiTileDelta {
  abs: number
  pct: number | null
  direction: 'up' | 'down' | 'flat'
}

export default function KpiTile({
  measureLabel,
  value,
  previous,
  delta,
  spark,
  unit,
  format,
  locale,
  changeText,
  changeUnit,
}: {
  measureLabel: string
  value: number | null
  previous: number | null
  delta: KpiTileDelta | null
  spark: readonly { x: string; label: string; value: number | null }[]
  unit: MeasureUnit
  format: AnalyticsNumberFormat
  locale: string
  /**
   * The caller's own writing of the change, unsigned, in place of the tile's (a share's change in
   * percentage points, say, where a percent of a percent would mislead). A machine value, isolated.
   */
  changeText?: string
  /** A word after the change, outside its isolate (`pts`), so it reads in the text's own direction. */
  changeUnit?: string
}) {
  const { t } = useTranslation('common')
  const fmt = (v: number | null) => formatAs(v, format, unit, locale)
  const headline = value === null ? t('charts.kpi.noValue') : fmt(value)
  const Icon = delta?.direction === 'up' ? ArrowUp : delta?.direction === 'down' ? ArrowDown : Minus
  // The change: the caller's writing of it; else a percent of the previous, or — from a zero previous —
  // the change itself, unsigned.
  const change = !delta ? '' : changeText ?? (delta.pct === null ? fmt(Math.abs(delta.abs)) : formatAs(Math.abs(delta.pct), 'percent', 'share', locale))
  const spoken = changeUnit ? t('charts.kpi.withUnit', { value: fsi(change), unit: changeUnit }) : fsi(change)
  const changeWords = delta ? t(`charts.kpi.${delta.direction}`, { change: spoken }) : ''

  return (
    <div className="flex flex-col gap-2 py-2" data-chart="kpi" role="figure" aria-label={t('charts.kpi.label', { measure: fsi(measureLabel), value: fsi(headline) })}>
      <div className="text-4xl font-semibold tracking-tight text-foreground" data-kpi-value>
        <Ltr>{headline}</Ltr>
      </div>
      {delta && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-kpi-delta={delta.direction}>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-medium text-foreground" aria-label={changeWords}>
            <Icon className="size-3.5" aria-hidden />
            <Ltr>{change}</Ltr>
            {changeUnit && <span data-kpi-change-unit>{changeUnit}</span>}
          </span>
          {previous !== null && (
            <span className="text-muted-foreground" data-kpi-previous>
              <Trans t={t} i18nKey="charts.kpi.previous" values={{ value: fmt(previous) }} components={{ v: <Ltr /> }} />
            </span>
          )}
        </div>
      )}
      {spark.length > 1 && (
        // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR; see `./direction`.
        <div dir={CHART_BOX_DIR} className="h-16" data-chart="sparkline">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[...spark]} accessibilityLayer margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <XAxis dataKey="label" hide reversed={chartMirror.categoryReversed} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [fmt(typeof v === 'number' ? v : null), measureLabel]} />
              <Line type="monotone" dataKey="value" stroke={slotColour(0)} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
