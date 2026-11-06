/**
 * The designer's history (spec 819 §E, ticket 828; from the 798 prototype's `useReportState`) — a pure reducer
 * `{ past, present, future }` over whatever the designer edits (a report's draft: its words and definition).
 *
 * - Every edit is one step; at most {@link HISTORY_CAP} are kept, the oldest dropped first.
 * - Typing in one field is one step: an edit with the same `key` as the last, within {@link COALESCE_MS} of it,
 *   replaces the present instead of stacking a step (the window slides with each keystroke). An undo or redo
 *   ends the run.
 * - A new edit clears redo. An edit that changes nothing (the same `present`) is no step.
 * - Each step carries a `label` (what undo would take back): a removal's "Removed … · Undo", and an outside
 *   whole-definition replace — the copilot's edit (832) — as one step labelled with the request. `fresh` is the
 *   label of the edit just applied, `null` after an undo, a redo or a load: it is what a "Removed … · Undo"
 *   notice reads.
 * - The steps are snapshots, so undoing a removal puts the thing back exactly where it was.
 * - `saved` is the present as last saved (or loaded): `present !== saved` is the unsaved marker. A save moves it
 *   and keeps the history.
 */

export const HISTORY_CAP = 100
export const COALESCE_MS = 1500

export interface HistoryStep<T, L> {
  state: T
  /** The edit that left (undo) or reaches (redo) `state`. */
  label: L | null
}

export interface History<T, L = string> {
  past: HistoryStep<T, L>[]
  present: T
  future: HistoryStep<T, L>[]
  /** The typing run's field, and when it was last edited: the coalescing window. */
  key: string | null
  at: number
  /** The label of the edit just applied; `null` after an undo, a redo or a load. */
  fresh: L | null
  /** The present as last saved or loaded. */
  saved: T
}

export type HistoryAction<T, L> =
  | { type: 'apply'; next: T | ((present: T) => T); key?: string | null; label?: L | null; at: number }
  | { type: 'undo' }
  | { type: 'redo' }
  /** The present was saved: the unsaved marker clears; the history stays. */
  | { type: 'saved' }
  /** Start over on a new present (a reload): no past, no future. */
  | { type: 'load'; present: T }

export const startHistory = <T, L = string>(present: T): History<T, L> => ({ past: [], present, future: [], key: null, at: 0, fresh: null, saved: present })

/** Whether the present differs from the last save. */
export const unsaved = <T, L>(h: History<T, L>): boolean => h.present !== h.saved

export function historyReducer<T, L>(h: History<T, L>, action: HistoryAction<T, L>): History<T, L> {
  switch (action.type) {
    case 'apply': {
      const next = typeof action.next === 'function' ? (action.next as (present: T) => T)(h.present) : action.next
      if (next === h.present) return h
      const key = action.key ?? null
      const label = action.label ?? null
      const merge = key !== null && h.key === key && action.at - h.at < COALESCE_MS && h.past.length > 0
      return {
        ...h,
        past: merge ? h.past : [...h.past, { state: h.present, label }].slice(-HISTORY_CAP),
        present: next,
        future: [],
        key,
        at: action.at,
        fresh: label,
      }
    }
    case 'undo': {
      const last = h.past.at(-1)
      if (!last) return h
      return { ...h, past: h.past.slice(0, -1), present: last.state, future: [{ state: h.present, label: last.label }, ...h.future], key: null, at: 0, fresh: null }
    }
    case 'redo': {
      const [first, ...rest] = h.future
      if (!first) return h
      return { ...h, past: [...h.past, { state: h.present, label: first.label }].slice(-HISTORY_CAP), present: first.state, future: rest, key: null, at: 0, fresh: null }
    }
    case 'saved':
      return h.saved === h.present ? h : { ...h, saved: h.present }
    case 'load':
      return startHistory<T, L>(action.present)
  }
}
