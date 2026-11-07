/**
 * An inspector pane's width (ticket 397, spec 380 L15–L16; ruling 367 §4): the bounds, the
 * viewport cap and what a key on its resize handle asks for. Pure: the caller reads the viewport
 * and the direction and hands them in.
 *
 * Born in the Deliveries feature and graduated here at ticket 432, when the Donor requests
 * inspector became its second pane — a feature may not import a feature.
 */

/** 367 §4: default 360, min 320, max 560 — and never more than 40% of the viewport. */
export const INSPECTOR_WIDTH = { default: 360, min: 320, max: 560, step: 16, viewportShare: 0.4 } as const

/**
 * A resizable side pane's bounds (846: the analytics editors' side lists reuse the separator with
 * their own). Every function below defaults to the inspector's.
 */
export interface PaneBounds {
  readonly default: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly viewportShare: number
}

/**
 * The widest the pane may be in this viewport: 560, or 40% of the viewport when that is less.
 * The 320 floor wins over the 40% cap on a narrow viewport, so the pane is never too narrow to
 * read; the grid gives way instead.
 */
export function maxInspectorWidth(viewport: number, bounds: PaneBounds = INSPECTOR_WIDTH): number {
  const share = Math.floor(viewport * bounds.viewportShare)
  return Math.max(bounds.min, Math.min(bounds.max, share))
}

/** A width brought inside the bounds this viewport allows, in whole pixels. */
export function clampInspectorWidth(width: number, viewport: number, bounds: PaneBounds = INSPECTOR_WIDTH): number {
  return Math.max(bounds.min, Math.min(maxInspectorWidth(viewport, bounds), Math.round(width)))
}

/**
 * The width a key on the separator asks for, or `null` when the key is not the separator's.
 * The handle sits on the pane's inline-start edge (an inspector at the inline end), so the arrow
 * pointing toward the inline start grows it: ← in LTR, → under RTL. A pane at the inline START has
 * its handle on its inline-END edge (`edge: 'end'`), and the arrow toward the inline end grows it.
 * Home and End jump to the minimum and the maximum.
 */
export function separatorKeyWidth(
  key: string,
  width: number,
  at: { viewport: number; rtl: boolean; bounds?: PaneBounds; edge?: 'start' | 'end' },
): number | null {
  const b = at.bounds ?? INSPECTOR_WIDTH
  const towardStart = at.rtl ? 'ArrowRight' : 'ArrowLeft'
  const towardEnd = at.rtl ? 'ArrowLeft' : 'ArrowRight'
  const [grow, shrink] = at.edge === 'end' ? [towardEnd, towardStart] : [towardStart, towardEnd]
  if (key === grow) return clampInspectorWidth(width + b.step, at.viewport, b)
  if (key === shrink) return clampInspectorWidth(width - b.step, at.viewport, b)
  if (key === 'Home') return b.min
  if (key === 'End') return maxInspectorWidth(at.viewport, b)
  return null
}
