import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { CHART_LEGEND_STYLE, CHART_TICK, CHART_TOOLTIP_STYLE } from './chrome'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { formatAs, formatTickAs } from './format'
import { CHART_INK, slotColour } from './slots'
import type { AnalyticsNumberFormat, MeasureUnit } from '@/core/models/analytics'

/**
 * The time and category forms (ticket 768): line, stacked area, and the bars — vertical, horizontal,
 * stacked and grouped — on 767's chrome (`VerticalBarChart` stays the single-series vertical bar).
 *
 * `core/charts` is the ONLY Recharts importer (766 §F). Every form here:
 * - sits in the `dir="ltr"` box and mirrors through props only (`./direction`);
 * - paints each series in its slot's token (`./slots`); "Other" (slot `null`) in ink grey;
 * - has a tooltip on every mark, a legend for two or more series (ink text), and `accessibilityLayer`;
 * - formats through the definition's number format (`formatAs`), plain text, never `fsi()`.
 *
 * Plain props, so the analytics feature's view model (`features/analytics/boards/series-view.ts`) maps
 * onto them structurally and `core` never imports a feature.
 */
export interface ChartSeries {
  key: string
  label: string
  slot: number | null
  other: boolean
  unit: MeasureUnit
}

export interface ChartSeriesRow {
  x: string
  label: string
  values: Record<string, number | null>
  slot: number | null
}

export default function SeriesChart({
  form,
  orientation = 'vertical',
  stacking,
  series,
  rows,
  colourBy,
  unit,
  format,
  locale,
  ariaLabel,
  otherCount = 0,
  height = 320,
  onPoint,
}: {
  form: 'line' | 'area' | 'bar'
  orientation?: 'vertical' | 'horizontal'
  stacking: 'none' | 'stacked' | 'grouped'
  series: readonly ChartSeries[]
  rows: readonly ChartSeriesRow[]
  colourBy: 'member' | 'single'
  unit: MeasureUnit
  format: AnalyticsNumberFormat
  locale: string
  ariaLabel: string
  /** How many members the "Other" series folds (its legend says "Other (n)"). */
  otherCount?: number
  height?: number
  /** Bars only (772's cross-filter): a click on a bar gives its category member (`rows[i].x`). */
  onPoint?: (x: string) => void
}) {
  const { t } = useTranslation('common')
  const named = series.map((s) => ({ ...s, name: s.other ? t('charts.other', { count: otherCount, n: otherCount }) : s.label, colour: slotColour(s.slot) }))
  const unitOf = new Map(series.map((s) => [s.key, s.unit]))
  const data = rows.map((r) => ({ label: r.label, ...r.values, fill: colourBy === 'member' ? slotColour(r.slot) : slotColour(0) }))
  const stackId = stacking === 'stacked' ? 'stack' : undefined
  const horizontal = form === 'bar' && orientation === 'horizontal'
  const margin = { top: 12, right: 8, bottom: 4, left: 8 }

  const valueTick = (v: number) => formatTickAs(v, format, unit, locale)
  const tooltip = (
    <Tooltip
      {...CHART_TOOLTIP_STYLE}
      cursor={form === 'bar' ? { fill: CHART_INK.cursor } : { stroke: CHART_INK.axis }}
      formatter={(v, name, item) => [
        formatAs(typeof v === 'number' ? v : null, format, unitOf.get(String(item.dataKey)) ?? unit, locale),
        name,
      ]}
    />
  )
  const legend =
    named.length > 1 ? (
      <Legend
        verticalAlign="bottom"
        // The series' own order (rank, "Other" last), not Recharts' default sort by name.
        itemSorter={null}
        wrapperStyle={CHART_LEGEND_STYLE}
        formatter={(value) => <span style={{ color: CHART_INK.legend }}>{value}</span>}
      />
    ) : null
  const grid = <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={CHART_INK.grid} />
  const categoryAxis = (
    <XAxis
      dataKey="label"
      reversed={chartMirror.categoryReversed}
      tick={CHART_TICK}
      tickLine={false}
      axisLine={{ stroke: CHART_INK.axis }}
      minTickGap={8}
    />
  )
  const valueAxis = (
    <YAxis orientation={chartMirror.valueAxisSide} tick={CHART_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={valueTick} />
  )

  let chart
  if (form === 'line') {
    chart = (
      <LineChart data={data} accessibilityLayer margin={margin}>
        {grid}
        {categoryAxis}
        {valueAxis}
        {tooltip}
        {legend}
        {named.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.colour}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    )
  } else if (form === 'area') {
    chart = (
      <AreaChart data={data} accessibilityLayer margin={margin}>
        {grid}
        {categoryAxis}
        {valueAxis}
        {tooltip}
        {legend}
        {named.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stackId="stack"
            stroke={s.colour}
            fill={s.colour}
            fillOpacity={0.35}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    )
  } else {
    const single = named.length === 1
    chart = (
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} accessibilityLayer margin={margin}>
        {grid}
        {horizontal ? (
          <>
            {/* A horizontal bar's category is the Y axis: mirror the VALUE axis, category on the right under RTL. */}
            <XAxis type="number" reversed={chartMirror.rtl} tick={CHART_TICK} tickLine={false} axisLine={false} tickFormatter={valueTick} />
            <YAxis
              type="category"
              dataKey="label"
              orientation={chartMirror.rtl ? 'right' : 'left'}
              tick={CHART_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART_INK.axis }}
              width={110}
              interval={0}
            />
          </>
        ) : (
          <>
            {categoryAxis}
            {valueAxis}
          </>
        )}
        {tooltip}
        {legend}
        {named.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId={stackId}
            fill={s.colour}
            radius={stackId ? 0 : horizontal ? (chartMirror.rtl ? [3, 0, 0, 3] : [0, 3, 3, 0]) : [3, 3, 0, 0]}
            isAnimationActive={false}
            cursor={onPoint ? 'pointer' : undefined}
            onClick={onPoint ? (_d: unknown, i: number) => rows[i] && onPoint(rows[i].x) : undefined}
          >
            {single && data.map((p, i) => <Cell key={rows[i].x} fill={p.fill} data-member={rows[i].x} data-slot={rows[i].slot ?? ''} />)}
          </Bar>
        ))}
      </BarChart>
    )
  }

  return (
    // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR; see `./direction`.
    <div
      dir={CHART_BOX_DIR}
      style={{ height }}
      data-chart={form}
      data-chart-orientation={orientation}
      data-chart-stacking={stacking}
      data-chart-series={named.length}
      role="figure"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  )
}
