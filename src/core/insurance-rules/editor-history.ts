// The insurance-rules editor's history (oms ticket 608): past / present / future over ONE draft document —
// the guard ruleset, and the category and coverage rulesets 617 edits through the same doors — beside the
// document as HQ last saved it. The draft is saved whole (`PUT …/Draft` with its `revision`), so the history
// is of the whole document too: Undo / Redo step through snapshots, Cancel goes back to the saved document,
// Save makes HQ's answer the saved one. Pure; a page holds it in `useReducer`. Edits are pure functions of
// the present (`./guard-edit`) that give back the same document when nothing changed — no step then.
//
// The generic twin of the campaign builder's history (features/campaigns/workspace/builder-history.ts),
// which a feature may not import.

export interface EditorHistory<T> {
  /** The document as HQ last saved it (or last read it) — what Cancel goes back to. */
  saved: T
  /** The document on screen. */
  present: T
  /** Earlier presents, oldest first. */
  past: T[]
  /** Presents an Undo stepped back from, the next Redo first. */
  future: T[]
  /** The coalescing key of the last edit: typing into one field is ONE step, not one per keystroke. */
  coalesce: string | null
}

export type EditorAction<T> =
  | { type: 'edit'; edit: (doc: T) => T; coalesce?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'cancel' }
  /** HQ saved the draft and answered with this document (its new revision). */
  | { type: 'saved'; doc: T }
  /** Ends a run of typing: the next edit is a step of its own even with the same coalescing key. */
  | { type: 'seal' }
  /** The draft was (re)read from HQ. An unsaved edit is kept; only what Cancel returns to moves. */
  | { type: 'load'; doc: T }

/** How many steps Undo can go back. */
export const EDITOR_HISTORY_LIMIT = 100

/** `present`: a document that starts unsaved (a new rule added to the draft), with nothing to undo. */
export const initialEditorHistory = <T>(saved: T, present: T = saved): EditorHistory<T> => ({
  saved,
  present,
  past: [],
  future: [],
  coalesce: null,
})

/** The same document as JSON reads it. */
export const sameDoc = <T>(a: T, b: T): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)

/** True when the document on screen differs from the saved one. */
export const isDirty = <T>(h: EditorHistory<T>): boolean => !sameDoc(h.present, h.saved)
export const canUndo = <T>(h: EditorHistory<T>): boolean => h.past.length > 0
export const canRedo = <T>(h: EditorHistory<T>): boolean => h.future.length > 0

export function editorHistory<T>(h: EditorHistory<T>, action: EditorAction<T>): EditorHistory<T> {
  switch (action.type) {
    case 'edit': {
      const next = action.edit(h.present)
      if (next === h.present) return h
      const key = action.coalesce ?? null
      if (key !== null && key === h.coalesce && h.past.length > 0) return { ...h, present: next, future: [] }
      return { ...h, present: next, past: [...h.past, h.present].slice(-EDITOR_HISTORY_LIMIT), future: [], coalesce: key }
    }
    case 'undo':
      if (!h.past.length) return h
      return { ...h, present: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.present, ...h.future], coalesce: null }
    case 'redo':
      if (!h.future.length) return h
      return { ...h, present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1), coalesce: null }
    case 'cancel':
      return initialEditorHistory(h.saved)
    case 'saved':
      return initialEditorHistory(action.doc)
    case 'seal':
      return h.coalesce === null ? h : { ...h, coalesce: null }
    case 'load':
      return isDirty(h) ? { ...h, saved: action.doc } : initialEditorHistory(action.doc)
  }
}
