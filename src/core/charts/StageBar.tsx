import { CHART_INK, slotColour } from './slots'
import { CHART_BOX_DIR, chartMirror } from './direction'

/**
 * The stage bar (ticket 814, spec 811): one funnel stage's length as a share of its funnel's top, a
 * plain horizontal bar under the stage's figure. Decorative — the figure beside it is the text a reader
 * (and a screen reader) reads, so the bar is `aria-hidden`.
 *
 * Plain props, no feature imports: `fraction` is the caller's geometry (0–1, clamped here); `null`
 * draws NO bar at all (an absent figure is not an empty one), while 0 draws the empty track.
 *
 * Like every chart it sits in the `dir="ltr"` box (`./direction`) and mirrors ONLY through props:
 * under Arabic the fill grows from the right edge, the reading start.
 */
export default function StageBar({
  fraction,
  rtl = chartMirror.rtl,
  colour = slotColour(0),
}: {
  fraction: number | null
  rtl?: boolean
  /** A slot or ink token reference; the series' first slot by default. */
  colour?: string
}) {
  if (fraction === null || !Number.isFinite(fraction)) return null
  const width = Math.min(100, Math.max(0, fraction * 100))
  return (
    // 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR and the fill's side is
    // set from `rtl`, so the bar mirrors through its props, as every chart does (`./direction`).
    <div
      dir={CHART_BOX_DIR}
      className="relative h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: CHART_INK.grid }}
      data-chart="stage-bar"
      data-stage-bar={Math.round(width)}
      aria-hidden
    >
      <div className="absolute inset-y-0 rounded-full" style={{ width: `${width}%`, background: colour, [rtl ? 'right' : 'left']: 0 }} />
    </div>
  )
}
