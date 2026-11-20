import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_TOOLTIP_STYLE } from '@/core/charts/chrome'
import { CHART_BOX_DIR, chartMirror } from '@/core/charts/direction'
import { CHART_INK, slotColour } from '@/core/charts/slots'
import type { DrainChartRow } from './mirror-drain-helpers'
import { figure } from './helpers'

/**
 * The drain's bars (oms 931): pulled against applied per slot, and below them the rows waiting at each slot's
 * end — two panes on one shared x-axis, never one chart with two y-axes (766 §E amendment 1).
 *
 * - The door's bad slots get a light danger band in both panes; the "since" marker is a dashed danger line at
 *   the door's `troubleSince` slot (its words are the caller's caption). Nothing here judges a slot.
 * - The pull's limit is a dashed line in the waiting pane — drawn only when the line comes within half of it,
 *   so a healthy few hundred rows do not flatten against a 50,000 ceiling.
 * - Applied is the success ink, as in the pie; pulled is the first palette slot.
 * - The box is always LTR and mirrors through props (`@/core/charts/direction`).
 */
const AXIS_WIDTH = 64
const PULLED = slotColour(0)
const APPLIED = 'var(--success)'
const WAITING = 'var(--attention)'
const BAND = 'var(--danger)'

export default function MirrorDrainChart({
  rows,
  threshold,
  marker,
}: {
  rows: readonly DrainChartRow[]
  threshold: number | null
  marker: { slot: string } | null
}) {
  const { t } = useTranslation('sync-console')
  const syncId = useId()
  const label = new Map(rows.map((r) => [r.slot, r.label]))
  const peak = rows.reduce((m, r) => Math.max(m, r.pending), 0)
  const showLimit = threshold != null && peak >= threshold / 2
  const runs = badRuns(rows)
  const tick = { fill: CHART_INK.tick, fontSize: 11 }
  const margin = { top: 18, right: 8, bottom: 4, left: 8 }
  const xAxis = (hide: boolean) => (
    <XAxis
      dataKey="slot"
      reversed={chartMirror.categoryReversed}
      tickFormatter={(s: string) => label.get(s) ?? s}
      tick={tick}
      minTickGap={16}
      hide={hide}
    />
  )
  const yAxis = (
    <YAxis
      orientation={chartMirror.valueAxisSide}
      tick={tick}
      tickLine={false}
      axisLine={false}
      width={AXIS_WIDTH}
      tickFormatter={(v: number) => figure(v)}
    />
  )
  const tooltip = (
    <Tooltip
      {...CHART_TOOLTIP_STYLE}
      labelFormatter={(s) => label.get(String(s)) ?? String(s)}
      formatter={(v, name) => [figure(typeof v === 'number' ? v : 0), String(name)]}
    />
  )
  const bands = runs.map((run) => (
    <ReferenceArea key={run.from} x1={run.from} x2={run.to} fill={BAND} fillOpacity={0.08} ifOverflow="hidden" />
  ))
  // The marker in both panes, unlabelled: its words are the caption above the chart (`BarsCard`), where an SVG label
  // at the window's edge would be clipped.
  const since = () => marker && <ReferenceLine x={marker.slot} stroke={BAND} strokeDasharray="4 3" strokeWidth={1.5} />

  // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR (`@/core/charts/direction`).
  return (
    <div dir={CHART_BOX_DIR} role="figure" aria-label={t('drain.bars.aria')} className="flex flex-col gap-1" data-drain-chart="">
      <div style={{ height: 200 }} data-drain-pane="bars">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...rows]} syncId={syncId} accessibilityLayer margin={margin} barGap={1}>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            {bands}
            {xAxis(true)}
            {yAxis}
            {tooltip}
            <Legend verticalAlign="top" height={20} iconSize={10} wrapperStyle={{ fontSize: 12, color: CHART_INK.legend }} />
            <Bar dataKey="pulled" name={t('drain.bars.pulled')} fill={PULLED} isAnimationActive={false} />
            <Bar dataKey="applied" name={t('drain.bars.applied')} fill={APPLIED} isAnimationActive={false} />
            {since()}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ height: 150 }} data-drain-pane="waiting">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...rows]} syncId={syncId} accessibilityLayer margin={margin}>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
            {bands}
            {xAxis(false)}
            {yAxis}
            {tooltip}
            <Line
              type="monotone"
              dataKey="pending"
              name={t('drain.bars.pending')}
              stroke={WAITING}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {showLimit && (
              <ReferenceLine
                y={threshold}
                stroke={CHART_INK.axis}
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
                label={{ value: t('drain.bars.threshold'), position: 'insideTopRight', fill: CHART_INK.tick, fontSize: 11 }}
              />
            )}
            {since()}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** The bad slots folded into runs, so a day of trouble is one band, not 144. */
function badRuns(rows: readonly DrainChartRow[]): { from: string; to: string }[] {
  const runs: { from: string; to: string }[] = []
  let open: { from: string; to: string } | null = null
  for (const r of rows) {
    if (r.bad) {
      if (open) open.to = r.slot
      else open = { from: r.slot, to: r.slot }
    } else if (open) {
      runs.push(open)
      open = null
    }
  }
  if (open) runs.push(open)
  return runs
}
