import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { formatTick, formatValue } from './format'
import { CHART_INK, slotColour } from './slots'
import type { MeasureUnit } from '@/core/models/analytics'

/**
 * The vertical bar form — one measure × one category (ticket 767, Slice 0). 768 adds horizontal,
 * stacked and grouped beside it on the same chrome.
 *
 * `core/charts` is the ONLY place Recharts is imported (spec 766 §F). This form owns:
 * - the `dir="ltr"` box and mirroring through props only (`./direction`);
 * - colour by entity: each bar its member's slot (`./slots`), or `--chart-1` for a one-colour series;
 * - ink-coloured ticks and gridlines; Recharts' `accessibilityLayer` (on by default in v3, set
 *   explicitly so a reader sees it is meant);
 * - formats by unit through `Intl` (`./format`), plain text, never `fsi()`.
 */
export interface VerticalBarPoint {
  member: string
  label: string
  value: number | null
  slot: number | null
}

export default function VerticalBarChart({
  points,
  colourBy,
  unit,
  measureLabel,
  locale,
  ariaLabel,
  height = 320,
}: {
  points: readonly VerticalBarPoint[]
  colourBy: 'member' | 'single'
  unit: MeasureUnit
  measureLabel: string
  locale: string
  ariaLabel: string
  height?: number
}) {
  const data = points.map((p) => ({ ...p, fill: colourBy === 'member' ? slotColour(p.slot) : slotColour(0) }))
  const tick = { fill: CHART_INK.tick, fontSize: 11 }
  return (
    // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR; see `./direction`.
    <div dir={CHART_BOX_DIR} style={{ height }} data-chart="bar" data-chart-orientation="vertical" role="figure" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} accessibilityLayer margin={{ top: 12, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
          <XAxis
            dataKey="label"
            reversed={chartMirror.categoryReversed}
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: CHART_INK.axis }}
            interval={0}
          />
          <YAxis
            orientation={chartMirror.valueAxisSide}
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => formatTick(v, unit, locale)}
          />
          <Tooltip
            cursor={{ fill: CHART_INK.cursor }}
            contentStyle={{
              background: CHART_INK.card,
              border: `1px solid ${CHART_INK.axis}`,
              borderRadius: 8,
              color: CHART_INK.legend,
              fontSize: 12,
            }}
            labelStyle={{ color: CHART_INK.legend, fontWeight: 600 }}
            itemStyle={{ color: CHART_INK.legend }}
            formatter={(v) => [formatValue(typeof v === 'number' ? v : null, unit, locale), measureLabel]}
          />
          <Bar dataKey="value" name={measureLabel} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((p) => (
              <Cell key={p.member} fill={p.fill} data-member={p.member} data-slot={p.slot ?? ''} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
