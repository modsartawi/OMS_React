import type { AnalyticsBoardPanel, Bindings } from '@/core/models/analytics'
import { sectionOf } from './layout'

/**
 * The board editor's undo and redo (ticket 846 item 4) — pure. A history of CHECKPOINTS: `at` is the board as last
 * recorded, `past` the boards before it, `future` the ones undone. The editor records its live state after each
 * change; while a gesture runs (a pointer drag, a resize) it records nothing, so the whole drag is one step, from
 * where it started to where it ended — never every cell it passed.
 *
 * - Typing in one field is one step: a change with the same `key` as the last, within {@link COALESCE_MS} of it,
 *   moves the checkpoint without a new step (the window slides with each keystroke).
 * - A `rebase` moves the checkpoint without a step: what the editor learns by itself (a view's chart minimum, a v1
 *   board's bindings worked out once its views load) is not the author's change to take back.
 * - A change that changes nothing (`same`) is no step; a new change clears redo; at most {@link HISTORY_CAP} kept.
 * - The copilot's edit (836) is recorded like any change: one step, so its Undo is this history's.
 */

export const HISTORY_CAP = 100
export const COALESCE_MS = 1500

export interface BoardHistory<T> {
  past: T[]
  at: T
  future: T[]
  key: string | null
  time: number
}

export const startHistory = <T>(at: T): BoardHistory<T> => ({ past: [], at, future: [], key: null, time: 0 })
export const canUndo = <T>(h: BoardHistory<T>) => h.past.length > 0
export const canRedo = <T>(h: BoardHistory<T>) => h.future.length > 0

export function record<T>(
  h: BoardHistory<T>,
  now: T,
  same: (a: T, b: T) => boolean,
  opts: { time: number; key?: string | null; gesture?: boolean; rebase?: boolean },
): BoardHistory<T> {
  if (opts.gesture || same(now, h.at)) return h
  if (opts.rebase) return { ...h, at: now }
  const key = opts.key ?? null
  const merge = key !== null && key === h.key && opts.time - h.time < COALESCE_MS && h.past.length > 0
  return {
    past: merge ? h.past : [...h.past, h.at].slice(-HISTORY_CAP),
    at: now,
    future: merge ? h.future : [],
    key,
    time: opts.time,
  }
}

/** Back one step: `at` becomes the step before. The caller puts the board back to the new `at`. */
export function undo<T>(h: BoardHistory<T>): BoardHistory<T> {
  const last = h.past.at(-1)
  if (last === undefined) return h
  return { past: h.past.slice(0, -1), at: last, future: [h.at, ...h.future], key: null, time: 0 }
}

export function redo<T>(h: BoardHistory<T>): BoardHistory<T> {
  const [next, ...rest] = h.future
  if (next === undefined) return h
  return { past: [...h.past, h.at].slice(-HISTORY_CAP), at: next, future: rest, key: null, time: 0 }
}

/** 846 item 7: the outline's entries — the panels in reading order, a section's panels one level under its header. */
export function outlineOf(panels: readonly AnalyticsBoardPanel[]): { id: string; kind: AnalyticsBoardPanel['kind']; depth: 0 | 1 }[] {
  return [...panels]
    .sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)
    .map((p) => ({ id: p.id, kind: p.kind, depth: p.kind !== 'section' && sectionOf(panels, p.id) ? 1 : 0 }))
}

/** 846 item 6: a duplicated panel is bound wherever the original is, with the same target. */
export function copyBindings(bindings: Bindings, from: string, to: string): Bindings {
  return Object.fromEntries(Object.entries(bindings).map(([name, bound]) => [name, from in bound ? { ...bound, [to]: bound[from] } : bound]))
}
