import { bootDirection, type Direction } from '@/core/theme/direction'

/**
 * The RTL rule for every chart (spec 766 §F; the trap in `docs/research/741-recharts-for-native-charts.md`).
 *
 * Recharts has no RTL mode. SVG `<text>` inherits `dir="rtl"`, which flips `text-anchor`, and labels
 * then collide with the bars and axes. So:
 *
 * - every chart sits inside a `dir="ltr"` box ({@link CHART_BOX_DIR}) — a LOGICAL EXCEPTION to the
 *   logical-Tailwind rule, as that rule allows for a direction-independent visual;
 * - mirroring comes ONLY from props: the category axis `reversed`, the value axis on the right
 *   ({@link chartMirror});
 * - custom SVG labels (769's treemap and heatmap) anchor to the right edge under Arabic.
 *
 * Direction is a boot fact (`@/core/theme/direction`): a language switch reloads the page.
 */

/** The box every chart is drawn in. Never `rtl`, whatever the page. */
export const CHART_BOX_DIR = 'ltr' as const

export interface ChartMirror {
  rtl: boolean
  /** The category axis runs right to left under Arabic. */
  categoryReversed: boolean
  /** The value axis stands at the reading start: the right under Arabic. */
  valueAxisSide: 'left' | 'right'
}

export function chartMirrorFor(dir: Direction): ChartMirror {
  const rtl = dir === 'rtl'
  return { rtl, categoryReversed: rtl, valueAxisSide: rtl ? 'right' : 'left' }
}

/** The page's mirror, read once at boot. */
export const chartMirror: ChartMirror = chartMirrorFor(bootDirection)
