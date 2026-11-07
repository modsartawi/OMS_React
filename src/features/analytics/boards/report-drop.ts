import type { AnalyticsReportDefinition } from '@/core/models/analytics'
import { locateBlock } from './report-ops'

/**
 * The report designer's drop indicator (846 item 2; research `docs/research/846-canvas-editor-drag-drop-ux.md`, after
 * Figma's auto-layout insertion line and Pragmatic DnD's closest edge) — pure: no DOM, no React. The page measures its
 * stacked items and hands their boxes in.
 *
 * A drag is over a GAP between stacked items (blocks in a section, or sections in the report), the one nearest the
 * pointer: `slotAmong`. Whether a drop there is allowed is `blockDrop` / `sectionDrop`; a drop that is not (the wrong
 * kind, or the dragged item's own place, which would change nothing) answers `null` and draws no line. `lineEdge` says
 * which item draws the line, and on which edge, so the line sits exactly where the item will land.
 */

/** What is being dragged: a section or a block of this report, or (846 item 4) a saved view from the views list. */
export type DragWhat = { kind: 'section'; id: string } | { kind: 'block'; id: string } | { kind: 'view'; viewId: string }

/** Where a drop lands: a gap among the sections, or a gap among one section's blocks. */
export type DropAt = { kind: 'section'; index: number } | { kind: 'block'; section: string; index: number }

export interface Box {
  readonly top: number
  readonly height: number
}

/** The gap nearest `y` among stacked boxes: 0 before the first … `boxes.length` after the last. */
export function slotAmong(y: number, boxes: readonly Box[]): number {
  let i = 0
  for (const b of boxes) {
    if (y > b.top + b.height / 2) i++
    else break
  }
  return i
}

/** A block or a view landing at gap `index` of `section`, or `null` when that is no drop. */
export function blockDrop(def: AnalyticsReportDefinition, drag: DragWhat | null, section: string, index: number): DropAt | null {
  if (!drag || drag.kind === 'section') return null
  const target = def.sections.find((s) => s.id === section)
  if (!target) return null
  const at = Math.max(0, Math.min(target.blocks.length, index))
  if (drag.kind === 'block') {
    const from = locateBlock(def, drag.id)
    if (!from) return null
    if (from.section === section && (at === from.index || at === from.index + 1)) return null
  }
  return { kind: 'block', section, index: at }
}

/** A section landing at gap `index` among the sections, or `null` when that is no drop. */
export function sectionDrop(def: AnalyticsReportDefinition, drag: DragWhat | null, index: number): DropAt | null {
  if (drag?.kind !== 'section') return null
  const from = def.sections.findIndex((s) => s.id === drag.id)
  if (from < 0) return null
  const at = Math.max(0, Math.min(def.sections.length, index))
  if (at === from || at === from + 1) return null
  return { kind: 'section', index: at }
}

/**
 * Whether item `index` of `count` draws the line for a drop at gap `target`: on its top edge ('before') when the gap is
 * just before it, on its bottom edge ('after') when it is the last item and the gap is the end; else none.
 */
export function lineEdge(target: number | null, index: number, count: number): 'before' | 'after' | null {
  if (target === null) return null
  if (target === index) return 'before'
  if (index === count - 1 && target === count) return 'after'
  return null
}
