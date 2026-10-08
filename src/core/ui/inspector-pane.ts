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
 * The widest the pane may be in this viewport: 560, or 40% of the viewport when that is less.
 * The 320 floor wins over the 40% cap on a narrow viewport, so the pane is never too narrow to
 * read; the grid gives way instead.
 */
export function maxInspectorWidth(viewport: number): number {
  const share = Math.floor(viewport * INSPECTOR_WIDTH.viewportShare)
  return Math.max(INSPECTOR_WIDTH.min, Math.min(INSPECTOR_WIDTH.max, share))
}

/** A width brought inside the bounds this viewport allows, in whole pixels. */
export function clampInspectorWidth(width: number, viewport: number): number {
  return Math.max(INSPECTOR_WIDTH.min, Math.min(maxInspectorWidth(viewport), Math.round(width)))
}

/**
 * The width a key on the separator asks for, or `null` when the key is not the separator's.
 * The handle sits on the pane's inline-start edge, so the arrow pointing toward the inline
 * start grows it: ← in LTR, → under RTL. Home and End jump to the minimum and the maximum.
 */
export function separatorKeyWidth(
  key: string,
  width: number,
  at: { viewport: number; rtl: boolean },
): number | null {
  const grow = at.rtl ? 'ArrowRight' : 'ArrowLeft'
  const shrink = at.rtl ? 'ArrowLeft' : 'ArrowRight'
  if (key === grow) return clampInspectorWidth(width + INSPECTOR_WIDTH.step, at.viewport)
  if (key === shrink) return clampInspectorWidth(width - INSPECTOR_WIDTH.step, at.viewport)
  if (key === 'Home') return INSPECTOR_WIDTH.min
  if (key === 'End') return maxInspectorWidth(at.viewport)
  return null
}
