import { apiErrorCode } from '@/core/api'
import type { CopilotPromptSaveRequest, CopilotPromptVersion } from '@/core/models/copilot'

/**
 * The house-rules editor's pure seam (ticket 790, BackOffice 3395): when the draft is dirty, when it can be
 * saved, what the `COPILOT-411` dialog offers, and the history rows. The screen is `CopilotRulesPage`.
 */

/** The house rules' limit; the server refuses longer with `COPILOT-412`. */
export const RULES_MAX = 4000

/** How many versions the history shows, newest first. */
export const HISTORY_MAX = 20

/** The curator grant is missing: the same no-access state as the gate, from any door. */
export const NOT_CURATOR = 'COPILOT-410'
/** Someone saved first: the side-by-side dialog. */
export const SAVED_FIRST = 'COPILOT-411'
/** The server refused the text (blank, too long): the field's error. */
export const RULES_INVALID = 'COPILOT-412'

/** What the curator is editing: the textarea and the optional "Why the change". */
export interface RulesDraft {
  text: string
  note: string
}

const noteOf = (note: string | null | undefined): string | null => (note && note.trim() !== '' ? note.trim() : null)

/** The draft differs from the version it was edited from: its text, or a note was written. */
export function isRulesDirty(draft: RulesDraft, base: CopilotPromptVersion | null): boolean {
  if (!base) return false
  return draft.text !== base.text || noteOf(draft.note) !== null
}

export const rulesTooLong = (text: string): boolean => text.length > RULES_MAX

/** Save is open: dirty, not blank, at most 4,000 characters, and no save or restore already out. */
export function canSaveRules(draft: RulesDraft, base: CopilotPromptVersion | null, inFlight: boolean): boolean {
  return isRulesDirty(draft, base) && draft.text.trim() !== '' && !rulesTooLong(draft.text) && !inFlight
}

/** The body a save sends. */
export function saveRequest(draft: RulesDraft, baseVersion: number): CopilotPromptSaveRequest {
  return { text: draft.text, note: noteOf(draft.note), baseVersion }
}

/** The `COPILOT-411` dialog: their saved version beside my draft, and the re-post "Save mine on top" sends. */
export interface MergeOffer {
  theirs: { version: number; text: string; savedBy: string | null; savedAt: string | null }
  mine: RulesDraft
  saveMineOnTop: CopilotPromptSaveRequest
}

export function mergeOffer(theirs: CopilotPromptVersion, mine: RulesDraft): MergeOffer {
  return {
    theirs: { version: theirs.version, text: theirs.text, savedBy: theirs.savedBy, savedAt: theirs.savedAt },
    mine: { text: mine.text, note: mine.note },
    saveMineOnTop: saveRequest(mine, theirs.version),
  }
}

export interface HistoryRow {
  version: number
  savedBy: string | null
  savedAt: string | null
  note: string | null
  revertedFrom: number | null
  /** The version in force now. */
  active: boolean
  text: string
}

/** The last 20 versions, newest first, the active one marked. A reply that is not a list reads as none. */
export function historyRows(history: readonly CopilotPromptVersion[] | null | undefined, activeVersion: number): HistoryRow[] {
  if (!Array.isArray(history)) return []
  return [...history]
    .sort((a, b) => b.version - a.version)
    .slice(0, HISTORY_MAX)
    .map((h) => ({
      version: h.version,
      savedBy: h.savedBy ?? null,
      savedAt: h.savedAt ?? null,
      note: noteOf(h.note),
      revertedFrom: typeof h.revertedFrom === 'number' ? h.revertedFrom : null,
      active: h.version === activeVersion,
      text: typeof h.text === 'string' ? h.text : '',
    }))
}

/** A refusal for want of the curator grant (`COPILOT-410`), from any of the five doors. */
export const curatorRefused = (err: unknown): boolean => apiErrorCode(err) === NOT_CURATOR
