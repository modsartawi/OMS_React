import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart as RechartsScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_BOX_DIR, chartMirror } from './direction'
import { CHART_INK } from './slots'

/**
 * The scatter form (ticket 966, BackOffice spec 4354 §19: the sourcing simulator's trade-off) — points by two measures,
 * each drawn in one of four shapes, a few of them marked and labelled.
 *
 * `core/charts` is the ONLY place Recharts is imported (spec 766 §F). Like the other forms this one owns:
 * - the `dir="ltr"` box, mirroring through props only (`./direction`): under Arabic the x axis runs right to left, the
 *   value axis stands on the right and a mark's label sits at its reading end;
 * - ink-coloured ticks and gridlines (`CHART_INK`); an unmarked point in ink grey, a marked one in `--primary` — token
 *   references, so light and dark follow the cascade;
 * - Recharts' `accessibilityLayer`, and the caller's formats as plain text (never `fsi()`: a tick reaches copied text).
 *
 * The caller gives each point its tooltip lines: the chart adds nothing up and prints no figure the caller did not give.
 */
export type ScatterShape = 'circle' | 'square' | 'triangle' | 'diamond'

export interface ScatterPoint {
  id: string
  x: number
  y: number
  shape: ScatterShape
  /** Drawn larger in `--primary`, with its `label` beside it. */
  marked: boolean
  label?: string
  /** The tooltip's lines, as the caller words them. */
  tip: readonly string[]
}

interface ShapeProps {
  cx?: number
  cy?: number
  payload?: ScatterPoint
}

/** One point's mark. Exported for the legend, which draws the same four shapes. */
export function ScatterMark({ shape, cx, cy, r, fill, stroke, strokeWidth = 0, opacity = 1 }: { shape: ScatterShape; cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }) {
  const common = { fill, fillOpacity: opacity, stroke, strokeWidth }
  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={r} {...common} />
    case 'square':
      return <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} {...common} />
    case 'triangle':
      return <path d={`M${cx} ${cy - r - 1}L${cx + r + 1} ${cy + r}L${cx - r - 1} ${cy + r}Z`} {...common} />
    case 'diamond':
      return <path d={`M${cx} ${cy - r - 1}L${cx + r + 1} ${cy}L${cx} ${cy + r + 1}L${cx - r - 1} ${cy}Z`} {...common} />
  }
}

const MARKED = 'var(--primary)'

function PointMark({ cx, cy, payload }: ShapeProps) {
  if (cx === undefined || cy === undefined || !payload) return <g />
  const rtl = chartMirror.rtl
  return (
    <g data-scatter-point={payload.id} data-scatter-shape={payload.shape} data-scatter-marked={payload.marked ? 'true' : undefined}>
      {payload.marked ? (
        <ScatterMark shape={payload.shape} cx={cx} cy={cy} r={6} fill={MARKED} stroke={CHART_INK.card} strokeWidth={2} />
      ) : (
        <ScatterMark shape={payload.shape} cx={cx} cy={cy} r={3.5} fill={CHART_INK.other} opacity={0.6} />
      )}
      {payload.marked && payload.label && (
        <text x={rtl ? cx - 10 : cx + 10} y={cy - 8} textAnchor={rtl ? 'end' : 'start'} fontSize={11} fontWeight={600} fill={CHART_INK.legend}>
          {payload.label}
        </text>
      )}
    </g>
  )
}

export default function ScatterChart({
  points,
  xLabel,
  yLabel,
  formatX,
  formatY,
  ariaLabel,
  height = 320,
}: {
  points: readonly ScatterPoint[]
  xLabel: string
  yLabel: string
  formatX: (v: number) => string
  formatY: (v: number) => string
  ariaLabel: string
  height?: number
}) {
  const tick = { fill: CHART_INK.tick, fontSize: 11 }
  // Unmarked first, so a marked point is drawn over the crowd.
  const tried = points.filter((p) => !p.marked)
  const marked = points.filter((p) => p.marked)
  return (
    // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR; see `./direction`.
    <div dir={CHART_BOX_DIR} style={{ height }} data-chart="scatter" role="figure" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsScatterChart accessibilityLayer margin={{ top: 16, right: 24, bottom: 24, left: 24 }}>
          <CartesianGrid stroke={CHART_INK.grid} />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            reversed={chartMirror.rtl}
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: CHART_INK.axis }}
            tickFormatter={formatX}
            // Headroom past the furthest point, so a mark's label at the far end stays inside the box.
            domain={[0, (max: number) => Math.ceil(max * 1.18)]}
            label={{ value: xLabel, position: 'insideBottom', offset: -16, fill: CHART_INK.tick, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            orientation={chartMirror.valueAxisSide}
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={formatY}
            domain={[0, 'auto']}
            label={{ value: yLabel, angle: -90, position: chartMirror.rtl ? 'insideRight' : 'insideLeft', fill: CHART_INK.tick, fontSize: 11, style: { textAnchor: 'middle' } }}
          />
          <Tooltip
            cursor={{ stroke: CHART_INK.axis, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as ScatterPoint | undefined) : undefined
              if (!p) return null
              return (
                <div
                  style={{ background: CHART_INK.card, border: `1px solid ${CHART_INK.axis}`, borderRadius: 8, color: CHART_INK.legend, fontSize: 12, padding: '6px 8px' }}
                  data-scatter-tip={p.id}
                >
                  {p.tip.map((line, i) => (
                    <div key={i} style={i === 0 ? { fontWeight: 600 } : undefined}>
                      {line}
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <Scatter data={tried as ScatterPoint[]} shape={PointMark} isAnimationActive={false} />
          <Scatter data={marked as ScatterPoint[]} shape={PointMark} isAnimationActive={false} />
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
