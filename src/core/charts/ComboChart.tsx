import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { formatTick, formatValue } from './format'
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
}: {
  points: readonly ComboChartPoint[]
  volume: PaneMeasure
  rate: PaneMeasure
  locale: string
  ariaLabel: string
  paneHeight?: number
}) {
  const syncId = useId()
  const data = points.map((p) => ({ ...p }))
  const tick = { fill: CHART_INK.tick, fontSize: 11 }
  const tooltip = (unit: MeasureUnit, label: string) => ({
    contentStyle: { background: CHART_INK.card, border: `1px solid ${CHART_INK.axis}`, borderRadius: 8, color: CHART_INK.legend, fontSize: 12 },
    labelStyle: { color: CHART_INK.legend, fontWeight: 600 },
    itemStyle: { color: CHART_INK.legend },
    formatter: (v: unknown) => [formatValue(typeof v === 'number' ? v : null, unit, locale), label] as [string, string],
  })
  const margin = { top: 8, right: 8, bottom: 4, left: 8 }
  const valueAxis = (unit: MeasureUnit) => (
    <YAxis
      orientation={chartMirror.valueAxisSide}
      tick={tick}
      tickLine={false}
      axisLine={false}
      width={AXIS_WIDTH}
      tickFormatter={(v: number) => formatTick(v, unit, locale)}
    />
  )
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
    <div dir={CHART_BOX_DIR} data-chart="combo" role="figure" aria-label={ariaLabel} className="flex flex-col gap-1">
      {paneTitle(volume.label, 'volume')}
      <div style={{ height: paneHeight }} data-combo-pane="volume">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId={syncId} accessibilityLayer margin={margin}>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            <XAxis dataKey="label" reversed={chartMirror.categoryReversed} hide />
            {valueAxis(volume.unit)}
            <Tooltip cursor={{ fill: CHART_INK.cursor }} {...tooltip(volume.unit, volume.label)} />
            <Bar dataKey="volume" name={volume.label} fill={slotColour(0)} radius={[3, 3, 0, 0]} isAnimationActive={false} />
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
            {valueAxis(rate.unit)}
            <Tooltip cursor={{ stroke: CHART_INK.axis }} {...tooltip(rate.unit, rate.label)} />
            <Line
              dataKey="rate"
              name={rate.label}
              stroke={slotColour(2)}
              strokeWidth={2}
              dot={{ r: 3, fill: slotColour(2), strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
