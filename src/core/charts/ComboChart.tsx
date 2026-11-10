import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { formatTick, formatValue, percentTicks } from './format'
import { CHART_INK, slotColour } from './slots'
import type { MeasureUnit } from '@/core/models/analytics'

/**
 * The combo form — one volume measure and one rate measure over one category or time axis (ticket 769).
 *
 * 766 §E amendment 1: never one chart with two y-axes. It is **two panes stacked on one shared x-axis**:
 * the volume as bars above, the rate as a line below, each pane with its own single y-axis. The panes
 * share a `syncId`, so hovering one shows both tooltips on the same member; the upper pane hides its
 * x labels (the lower pane carries them) and both reserve the same value-axis width so the marks align.
 */
export interface ComboChartPoint {
  member: string
  label: string
  volume: number | null
  rate: number | null
  /** 825: each named series' volume and rate at this point, by series key. */
  bySeries?: Record<string, { volume: number | null; rate: number | null }>
}

/** 825: a named series drawn in both panes, in its slot's colour. */
export interface ComboChartSeries {
  id: string
  label: string
  slot: number
}

interface PaneMeasure {
  label: string
  unit: MeasureUnit
}

const AXIS_WIDTH = 56

export default function ComboChart({
  points,
  volume,
  rate,
  locale,
  ariaLabel,
  paneHeight = 180,
  series = [],
}: {
  points: readonly ComboChartPoint[]
  volume: PaneMeasure
  rate: PaneMeasure
  locale: string
  ariaLabel: string
  paneHeight?: number
  /** 825: named series — one bar and one line per series, a legend above, and no total across them. */
  series?: readonly ComboChartSeries[]
}) {
  const syncId = useId()
  const named = series.length > 0
  const data = points.map((p) => {
    const flat: Record<string, number | null> = {}
    for (const s of series) {
      flat[`v-${s.id}`] = p.bySeries?.[s.id]?.volume ?? null
      flat[`r-${s.id}`] = p.bySeries?.[s.id]?.rate ?? null
    }
    return { ...p, ...flat }
  })
  const tick = { fill: CHART_INK.tick, fontSize: 11 }
  const tooltip = (unit: MeasureUnit, label: string) => ({
    contentStyle: { background: CHART_INK.card, border: `1px solid ${CHART_INK.axis}`, borderRadius: 8, color: CHART_INK.legend, fontSize: 12 },
    labelStyle: { color: CHART_INK.legend, fontWeight: 600 },
    itemStyle: { color: CHART_INK.legend },
    formatter: (v: unknown, name: unknown) =>
      [formatValue(typeof v === 'number' ? v : null, unit, locale), named ? String(name) : label] as [string, string],
  })
  const margin = { top: 8, right: 8, bottom: 4, left: 8 }
  // A percent or share axis in round steps (0%, 10%, 20%…), as in `SeriesChart`; the rate pane is where it lands.
  const rates = points.flatMap((p) => [p.rate, ...Object.values(p.bySeries ?? {}).map((b) => b.rate)]).filter((v): v is number => typeof v === 'number')
  const valueAxis = (unit: MeasureUnit, values: readonly number[] = []) => {
    const ticks = (unit === 'percent' || unit === 'share') && values.length ? percentTicks(Math.min(...values), Math.max(...values)) : undefined
    return (
      <YAxis
        orientation={chartMirror.valueAxisSide}
        tick={tick}
        tickLine={false}
        axisLine={false}
        width={AXIS_WIDTH}
        tickFormatter={(v: number) => formatTick(v, unit, locale)}
        {...(ticks ? { ticks, domain: [ticks[0], ticks[ticks.length - 1]] } : {})}
      />
    )
  }
  // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the pane title sits inside the always-LTR chart box, where
  // `text-start` would always mean left; physical `text-right`/`text-left` anchors it to the reading start by the
  // boot direction (`./direction`).
  const paneTitle = (label: string, kind: string) => (
    <div className={`px-2 text-xs font-medium text-muted-foreground ${chartMirror.rtl ? 'text-right' : 'text-left'}`} data-combo-pane-title={kind}>
      <bdi>{label}</bdi>
    </div>
  )

  return (
    // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR, and the pane titles anchor
    // to the reading start by the boot direction (`./direction`).
    <div dir={CHART_BOX_DIR} data-chart="combo" data-chart-series={series.length || 1} role="figure" aria-label={ariaLabel} className="flex flex-col gap-1">
      {named && (
        <ul className={`flex flex-wrap gap-x-3 gap-y-1 px-2 text-xs ${chartMirror.rtl ? 'flex-row-reverse' : ''}`} data-combo-legend>
          {series.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1" style={{ color: CHART_INK.legend }} data-combo-series={s.id}>
              <span className="inline-block size-2.5 rounded-sm" style={{ background: slotColour(s.slot) }} aria-hidden />
              <bdi>{s.label}</bdi>
            </li>
          ))}
        </ul>
      )}
      {paneTitle(volume.label, 'volume')}
      <div style={{ height: paneHeight }} data-combo-pane="volume">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId={syncId} accessibilityLayer margin={margin}>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            <XAxis dataKey="label" reversed={chartMirror.categoryReversed} hide />
            {valueAxis(volume.unit)}
            <Tooltip cursor={{ fill: CHART_INK.cursor }} {...tooltip(volume.unit, volume.label)} />
            {named ? (
              series.map((s) => (
                <Bar key={s.id} dataKey={`v-${s.id}`} name={s.label} fill={slotColour(s.slot)} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              ))
            ) : (
              <Bar dataKey="volume" name={volume.label} fill={slotColour(0)} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {paneTitle(rate.label, 'rate')}
      <div style={{ height: paneHeight + 24 }} data-combo-pane="rate">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId={syncId} accessibilityLayer margin={margin}>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            <XAxis
              dataKey="label"
              // A band scale, like the bar pane's: each point sits at the centre of its bar's band, so the
              // two panes read on ONE x-axis (a point scale would run edge to edge and drift).
              scale="band"
              reversed={chartMirror.categoryReversed}
              tick={tick}
              tickLine={false}
              axisLine={{ stroke: CHART_INK.axis }}
              interval="preserveStartEnd"
            />
            {valueAxis(rate.unit, rates)}
            <Tooltip cursor={{ stroke: CHART_INK.axis }} {...tooltip(rate.unit, rate.label)} />
            {named ? (
              series.map((s) => (
                <Line
                  key={s.id}
                  dataKey={`r-${s.id}`}
                  name={s.label}
                  stroke={slotColour(s.slot)}
                  strokeWidth={2}
                  dot={{ r: 3, fill: slotColour(s.slot), strokeWidth: 0 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))
            ) : (
              <Line
                dataKey="rate"
                name={rate.label}
                stroke={slotColour(2)}
                strokeWidth={2}
                dot={{ r: 3, fill: slotColour(2), strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
