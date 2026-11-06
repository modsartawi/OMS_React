import { CHART_BOX_DIR, chartMirror } from './direction'

/**
 * The share bar (ticket 814, spec 811): one whole split into its parts, as one bar of segments in
 * the order given — the Delivery funnel's In slot | Out of slot | No slot.
 *
 * Plain props, no feature imports. Each segment's `weight` is the caller's figure as sent (a count);
 * its width is that weight over the segments' sum — geometry only, never written as a figure. A
 * segment of weight 0 draws nothing; with nothing to split (no weight above 0) the bar draws nothing.
 * The segment colours are the caller's slot or ink tokens.
 *
 * It is one picture (`role="img"`) named by `label`, which the caller writes from the same figures it
 * shows as text beside it. Like every chart it sits in the `dir="ltr"` box (`./direction`) and
 * mirrors ONLY through props: under Arabic the first segment stands at the right, the reading start.
 */
export interface ShareBarSegment {
  id: string
  weight: number
  /** A slot or ink token reference (`slotColour`, `CHART_INK`). */
  colour: string
}

export default function ShareBar({
  segments,
  label,
  rtl = chartMirror.rtl,
}: {
  segments: readonly ShareBarSegment[]
  label: string
  rtl?: boolean
}) {
  const drawn = segments.filter((s) => Number.isFinite(s.weight) && s.weight > 0)
  const total = drawn.reduce((sum, s) => sum + s.weight, 0)
  if (total <= 0) return null
  const ordered = rtl ? [...drawn].reverse() : drawn
  return (
    // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR; the segment order is
    // reversed from `rtl`, so the bar mirrors through its props, as every chart does (`./direction`).
    <div dir={CHART_BOX_DIR} className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={label} data-chart="share-bar">
      {ordered.map((s) => (
        <div key={s.id} className="h-full" style={{ width: `${(s.weight / total) * 100}%`, background: s.colour }} data-share-segment={s.id} />
      ))}
    </div>
  )
}
