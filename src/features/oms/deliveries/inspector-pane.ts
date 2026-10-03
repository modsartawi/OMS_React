/**
 * The Delivery inspector's pane (ticket 397, spec 380 L15–L16; ruling 367 §4): how wide it is,
 * what the browser remembers of it, and the one current row J/K step to. Pure: the page reads
 * the viewport, the direction and `localStorage`, and hands them in.
 */

/** J and K: the next and previous row (365 §5), hidden commands the page registers. */
export const NEXT_ROW_KEYS = 'KeyJ'
export const PREVIOUS_ROW_KEYS = 'KeyK'
/** `I` folds and unfolds the pane (368 §4). */
export const INSPECTOR_KEYS = 'KeyI'

/** 367 §4: default 360, min 320, max 560 — and never more than 40% of the viewport. */
export const INSPECTOR_WIDTH = { default: 360, min: 320, max: 560, step: 16, viewportShare: 0.4 } as const

/** Width and open/closed, remembered per browser. */
export interface InspectorPrefs {
  width: number
  open: boolean
}

/** The `localStorage` key. Versioned, so a later shape never misreads this one. */
export const INSPECTOR_PREFS_KEY = 'oms.deliveries.inspector.v1'

const DEFAULT_PREFS: InspectorPrefs = { width: INSPECTOR_WIDTH.default, open: true }

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

/**
 * The remembered prefs, read defensively: a value that is not what this module wrote reads as
 * the default (360, open), field by field. The width is kept inside 320–560; the viewport's
 * 40% cap is applied when it renders, so a narrow window never shrinks what a wide one saved.
 */
export function parseInspectorPrefs(raw: string | null | undefined): InspectorPrefs {
  if (!raw) return { ...DEFAULT_PREFS }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_PREFS }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ...DEFAULT_PREFS }
  const { width, open } = value as Record<string, unknown>
  return {
    width:
      typeof width === 'number' && Number.isFinite(width)
        ? Math.max(INSPECTOR_WIDTH.min, Math.min(INSPECTOR_WIDTH.max, Math.round(width)))
        : DEFAULT_PREFS.width,
    open: typeof open === 'boolean' ? open : DEFAULT_PREFS.open,
  }
}

export function serializeInspectorPrefs(prefs: InspectorPrefs): string {
  return JSON.stringify({ width: prefs.width, open: prefs.open })
}

/**
 * The row J (`+1`) or K (`-1`) moves the one current row to, among `count` displayed rows.
 * From no current row, J lands on the first and K on the last. It stops at either end rather
 * than wrapping. `null` when nothing is displayed.
 */
export function nextRowIndex(current: number | null, delta: 1 | -1, count: number): number | null {
  if (count <= 0) return null
  if (current === null) return delta === 1 ? 0 : count - 1
  // A row index from before the grid narrowed (a filter, a lens) comes back to the last row.
  if (current >= count) return count - 1
  return Math.max(0, Math.min(count - 1, current + delta))
}
