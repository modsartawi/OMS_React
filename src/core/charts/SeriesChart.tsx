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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CHART_LEGEND_STYLE, CHART_TICK, CHART_TOOLTIP_STYLE } from './chrome'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { formatAs, formatTickAs, percentTicks } from './format'
import { CHART_INK, seriesColour, seriesDash, seriesOpacity, seriesRowFill } from './slots'
import type { AnalyticsLegendPosition, AnalyticsNumberFormat, MeasureUnit } from '@/core/models/analytics'

/**
 * The time and category forms (ticket 768): line, stacked area, and the bars — vertical, horizontal,
 * stacked and grouped — on 767's chrome (`VerticalBarChart` stays the single-series vertical bar).
 *
 * `core/charts` is the ONLY Recharts importer (766 §F). Every form here:
 * - sits in the `dir="ltr"` box and mirrors through props only (`./direction`);
 * - paints each series in its slot's token (`./slots`); "Other" (slot `null`) in ink grey;
 * - has a tooltip on every mark, a legend for two or more series (ink text), and `accessibilityLayer`;
 * - formats through the definition's number format (`formatAs`), plain text, never `fsi()`;
 * - 825: a click on a legend entry highlights that series (the others dim); so does a click on a bar of a
 *   chart with no `onPoint`. A highlight never cross-filters — `onPoint` is the cross-filter, and only a
 *   bar's own click, when the caller gives it, reaches it. Highlight = opacity, never a new colour.
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
  /** The previous period (line only): ink grey and dashed, named "Previous period". */
  previous?: boolean
  /** The same weeks last year (877; a line or a bar): the darker ink, its own dash on a line, named by its `label`. */
  lastYear?: boolean
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
  legend: legendAt = 'bottom',
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
  /** Where the legend sits (755 item 4, ticket 775); `end` is the reading end, so it mirrors under RTL. */
  legend?: AnalyticsLegendPosition
}) {
  const { t } = useTranslation('common')
  const [lit, setLit] = useState<string | null>(null)
  // A highlight of a series no longer drawn falls away by itself.
  const shown = lit && series.some((s) => s.key === lit) ? lit : null
  const toggle = (key: string | undefined) => key && setLit((k) => (k === key ? null : key))
  const opacity = (key: string) => seriesOpacity(shown, key)
  const named = series.map((s) => ({
    ...s,
    name: s.other ? t('charts.other', { count: otherCount, n: otherCount }) : s.previous ? t('charts.previousPeriod') : s.label,
    colour: seriesColour(s),
  }))
  const unitOf = new Map(series.map((s) => [s.key, s.unit]))
  // The row fill only for one series (ticket 820): Recharts lets a row's `fill` beat `<Bar fill>`.
  const data = rows.map((r): { label: string; fill?: string } & Record<string, number | string | null | undefined> => {
    const fill = seriesRowFill(series.length, colourBy, r.slot)
    return fill === undefined ? { label: r.label, ...r.values } : { label: r.label, ...r.values, fill }
  })
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
    named.length > 1 && legendAt !== 'hidden' ? (
      <Legend
        {...(legendAt === 'end'
          ? // The reading end: opposite the value axis, which sits at the reading start.
            { layout: 'vertical' as const, verticalAlign: 'middle' as const, align: chartMirror.valueAxisSide === 'left' ? ('right' as const) : ('left' as const) }
          : { verticalAlign: legendAt })}
        // The series' own order (rank, "Other" last), not Recharts' default sort by name.
        itemSorter={null}
        wrapperStyle={{ ...CHART_LEGEND_STYLE, cursor: 'pointer' }}
        onClick={(entry: { dataKey?: unknown }) => toggle(typeof entry.dataKey === 'string' ? entry.dataKey : undefined)}
        formatter={(value) => (
          <span style={{ color: CHART_INK.legend }}>
            <bdi>{value}</bdi>
          </span>
        )}
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
  // A percent or share axis in round steps (0%, 10%, 20%…), not Recharts' own split of the range.
  const values = rows.flatMap((r) => Object.values(r.values)).filter((v): v is number => typeof v === 'number')
  const ticks = (unit === 'percent' || unit === 'share') && stacking !== 'stacked' && values.length ? percentTicks(Math.min(...values), Math.max(...values)) : undefined
  const valueAxis = (
    <YAxis
      orientation={chartMirror.valueAxisSide}
      tick={CHART_TICK}
      tickLine={false}
      axisLine={false}
      width={56}
      tickFormatter={valueTick}
      {...(ticks ? { ticks, domain: [ticks[0], ticks[ticks.length - 1]] } : {})}
    />
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
            strokeOpacity={opacity(s.key)}
            strokeWidth={2}
            strokeDasharray={seriesDash(s)}
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
            // 825: named series are never stacked (a stack's height is a total): they overlap.
            stackId={stacking === 'stacked' ? 'stack' : undefined}
            stroke={s.colour}
            strokeOpacity={opacity(s.key)}
            fill={s.colour}
            fillOpacity={0.35 * opacity(s.key)}
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
            <XAxis type="number" reversed={chartMirror.rtl} tick={CHART_TICK} tickLine={false} axisLine={false} tickFormatter={valueTick} {...(ticks ? { ticks, domain: [ticks[0], ticks[ticks.length - 1]] } : {})} />
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
            fillOpacity={opacity(s.key)}
            radius={stackId ? 0 : horizontal ? (chartMirror.rtl ? [3, 0, 0, 3] : [0, 3, 3, 0]) : [3, 3, 0, 0]}
            isAnimationActive={false}
            cursor={onPoint || !single ? 'pointer' : undefined}
            onClick={onPoint ? (_d: unknown, i: number) => rows[i] && onPoint(rows[i].x) : !single ? () => toggle(s.key) : undefined}
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
      data-chart-highlight={shown ?? ''}
      role="figure"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  )
}
