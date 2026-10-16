import type { CampaignRule } from '@/core/models/rule-campaign'

// The rule builder's edit history (ticket 505): past / present / future over the campaign's rules,
// beside the rules as HQ last saved them. Pure — the page holds it in a `useReducer` and stays a
// thin renderer. Every edit is a pure function of the present rules (`./rule-edit`); Undo and
// Redo step through whole snapshots, Cancel goes back to the saved rules, Save makes the present
// the saved.

export interface BuilderHistory {
  /** The rules as HQ last saved them — what Cancel goes back to. */
  saved: CampaignRule[]
  /** The rules on screen. */
  present: CampaignRule[]
  /** Earlier presents, oldest first. */
  past: CampaignRule[][]
  /** Presents an Undo stepped back from, the next Redo first. */
  future: CampaignRule[][]
  /**
   * The coalescing key of the last edit, if it had one. Typing into one field is ONE step of the
   * history, not one per keystroke: an edit with the same key as the one before it replaces the
   * present without pushing a new step.
   */
  coalesce: string | null
}

export type BuilderAction =
  | { type: 'edit'; edit: (rules: CampaignRule[]) => CampaignRule[]; coalesce?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'cancel' }
  /**
   * HQ saved the draft and answered with these rules. `sent` is the present that was sent: an edit
   * made while the save was in flight is kept (unsaved, its history with it) rather than dropped.
   */
  | { type: 'saved'; rules: CampaignRule[]; sent?: CampaignRule[] }
  /** Ends a run of typing: the next edit is a step of its own even with the same coalescing key. */
  | { type: 'seal' }
  /** The campaign was (re)read from HQ. Taken only while nothing is unsaved. */
  | { type: 'load'; rules: CampaignRule[] }

/** How many steps Undo can go back. */
export const HISTORY_LIMIT = 100

export const initialHistory = (rules: CampaignRule[]): BuilderHistory => ({
  saved: rules,
  present: rules,
  past: [],
  future: [],
  coalesce: null,
})

const same = (a: CampaignRule[], b: CampaignRule[]) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** True when the rules on screen differ from the saved ones. */
export const isDirty = (h: BuilderHistory): boolean => !same(h.present, h.saved)

export const canUndo = (h: BuilderHistory): boolean => h.past.length > 0
export const canRedo = (h: BuilderHistory): boolean => h.future.length > 0

export function builderHistory(h: BuilderHistory, action: BuilderAction): BuilderHistory {
  switch (action.type) {
    case 'edit': {
      const next = action.edit(h.present)
      if (next === h.present) return h
      const key = action.coalesce ?? null
      if (key !== null && key === h.coalesce && h.past.length > 0) return { ...h, present: next, future: [] }
      return { ...h, present: next, past: [...h.past, h.present].slice(-HISTORY_LIMIT), future: [], coalesce: key }
    }
    case 'undo': {
      if (!h.past.length) return h
      return { ...h, present: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.present, ...h.future], coalesce: null }
    }
    case 'redo': {
      if (!h.future.length) return h
      return { ...h, present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1), coalesce: null }
    }
    case 'cancel':
      return initialHistory(h.saved)
    case 'saved':
      if (action.sent !== undefined && action.sent !== h.present) return { ...h, saved: action.rules }
      return initialHistory(action.rules)
    case 'seal':
      return h.coalesce === null ? h : { ...h, coalesce: null }
    case 'load':
      // An unsaved edit is never lost to a re-read; the next Save is HQ's to accept or refuse.
      return isDirty(h) ? { ...h, saved: action.rules } : initialHistory(action.rules)
  }
}
