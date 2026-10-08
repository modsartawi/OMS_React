/**
 * The Delivery inspector's pane (ticket 397, spec 380 L15–L16; ruling 367 §4): what the browser
 * remembers of it, and the one current row J/K step to. Its width bounds are `@/core/ui`'s
 * (graduated at ticket 432). Pure: the page reads `localStorage` and hands it in.
 */
import { INSPECTOR_WIDTH } from '@/core/ui/inspector-pane'

/** J and K: the next and previous row (365 §5), hidden commands the page registers. */
export const NEXT_ROW_KEYS = 'KeyJ'
export const PREVIOUS_ROW_KEYS = 'KeyK'
/** `I` folds and unfolds the pane (368 §4). */
export const INSPECTOR_KEYS = 'KeyI'

/** Width and open/closed, remembered per browser. */
export interface InspectorPrefs {
  width: number
  open: boolean
}

/** The `localStorage` key. Versioned, so a later shape never misreads this one. */
export const INSPECTOR_PREFS_KEY = 'oms.deliveries.inspector.v1'

const DEFAULT_PREFS: InspectorPrefs = { width: INSPECTOR_WIDTH.default, open: true }

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
