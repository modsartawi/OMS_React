import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { formatValue } from './format'
import { CHART_INK, slotColour } from './slots'
import type { MeasureUnit } from '@/core/models/analytics'

/**
 * The donut form — one additive measure × one category, at most 6 slices plus "Other" (ticket 769;
 * the fold and the shape refusal are the view model's, `toDonutView`).
 *
 * - The ring sits in the `dir="ltr"` box; under Arabic it runs counter-clockwise from the top
 *   (mirrored through `startAngle`/`endAngle` props only, `./direction`).
 * - Each slice paints its entity's slot; "Other" is ink grey, never a sixth hue.
 * - The legend is HTML beside the ring, in the page's own direction, ink text: each label in a
 *   `<bdi>` (free text), its value and share in `Ltr` (machine values).
 */
export interface DonutSlicePoint {
  member: string
  label: string
  value: number
  /** `null` for "Other". */
  slot: number | null
}

const share = (value: number, total: number, locale: string) => formatValue(total > 0 ? value / total : null, 'share', locale)

export default function DonutChart({
  slices,
  total,
  unit,
  locale,
  ariaLabel,
  height = 280,
}: {
  slices: readonly DonutSlicePoint[]
  total: number
  unit: MeasureUnit
  locale: string
  ariaLabel: string
  height?: number
}) {
  const { t } = useTranslation('common')
  const data = slices.map((s) => ({ ...s, fill: slotColour(s.slot) }))
  // Clockwise from twelve o'clock; mirrored under Arabic.
  const [startAngle, endAngle] = chartMirror.rtl ? [90, 450] : [90, -270]
  return (
    <div className="flex flex-wrap items-center gap-6" role="figure" aria-label={ariaLabel}>
      {/* 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR; see `./direction`. */}
      <div dir={CHART_BOX_DIR} style={{ height, width: height }} className="shrink-0" data-chart="donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="92%"
              startAngle={startAngle}
              endAngle={endAngle}
              paddingAngle={1}
              stroke={CHART_INK.card}
              isAnimationActive={false}
            >
              {data.map((s) => (
                <Cell key={s.member} fill={s.fill} data-member={s.member} data-slot={s.slot ?? ''} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: CHART_INK.card, border: `1px solid ${CHART_INK.axis}`, borderRadius: 8, color: CHART_INK.legend, fontSize: 12 }}
              itemStyle={{ color: CHART_INK.legend }}
              formatter={(v, name) => {
                const n = typeof v === 'number' ? v : 0
                return [formatPair(formatValue(n, unit, locale), share(n, total, locale)), String(name)]
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex min-w-48 flex-col gap-1.5 text-sm text-foreground" data-chart-legend="donut">
        {data.map((s) => (
          <li key={s.member} className="flex items-center gap-2" data-member={s.member}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.fill }} aria-hidden />
            <bdi className="min-w-0 flex-1 truncate">{s.label}</bdi>
            <span className="tabular-nums">
              <Ltr>{formatValue(s.value, unit, locale)}</Ltr>
            </span>
            <span className="w-14 text-end tabular-nums text-muted-foreground" data-share>
              <Ltr>{share(s.value, total, locale)}</Ltr>
            </span>
          </li>
        ))}
        <li className="mt-1 flex items-center gap-2 border-t border-divider pt-1.5 font-medium" data-chart-total>
          <span className="size-2.5 shrink-0" aria-hidden />
          <span className="flex-1">{t('charts.total')}</span>
          <span className="tabular-nums">
            <Ltr>{formatValue(total, unit, locale)}</Ltr>
          </span>
          <span className="w-14" aria-hidden />
        </li>
      </ul>
    </div>
  )
}
