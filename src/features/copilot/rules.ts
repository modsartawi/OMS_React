import { apiErrorCode, apiErrorData, isBareDenial } from '@/core/api'
import type {
  CopilotPrompt,
  CopilotPromptFieldRefusal,
  CopilotPromptSaveRequest,
  CopilotPromptTryRequest,
  CopilotPromptVersion,
  CopilotPromptVersionWire,
  CopilotPromptWire,
} from '@/core/models/copilot'

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

/** The default readings' limit when the read door names none (BackOffice 3593, A25); apart from `RULES_MAX`. */
export const READINGS_MAX = 2000

/**
 * What the read door fixes for the whole screen, beside the versions: the default readings' built-in text and
 * limit. `CopilotPrompt` is one. (Ticket 875 adds the starters' limits here.)
 */
export type RulesFrame = Pick<CopilotPrompt, 'builtInDefaultReadings' | 'defaultReadingsMaxLength'>

/** What the curator is editing: the house rules, the optional "Why the change", and the default readings (874). */
export interface RulesDraft {
  text: string
  note: string
  /** As shown: the version's own default readings, or the built-in text when it has none. */
  readings: string
}

/** A version's default readings as the screen shows them: its own, or the built-in text when it has none. */
export const readingsOf = (v: CopilotPromptVersion, frame: RulesFrame): string =>
  v.defaultReadings !== '' ? v.defaultReadings : frame.builtInDefaultReadings

/** The draft a version opens as: its texts, no note. */
export const draftOf = (v: CopilotPromptVersion, frame: RulesFrame): RulesDraft => ({
  text: v.text,
  note: '',
  readings: readingsOf(v, frame),
})

const noteOf = (note: string | null | undefined): string | null => (note && note.trim() !== '' ? note.trim() : null)

/**
 * The default readings as a door takes them (3593): the shown text, or `""` (none of its own) when it is blank or
 * still the built-in text — the built-in text is never stored as a version's own.
 */
export const readingsToSend = (readings: string, frame: RulesFrame): string =>
  readings.trim() === '' || readings === frame.builtInDefaultReadings ? '' : readings

/** The draft differs from the version it was edited from: either text, or a note was written. */
export function isRulesDirty(draft: RulesDraft, base: CopilotPromptVersion | null, frame: RulesFrame): boolean {
  if (!base) return false
  return draft.text !== base.text || readingsToSend(draft.readings, frame) !== base.defaultReadings || noteOf(draft.note) !== null
}

export const rulesTooLong = (text: string): boolean => text.length > RULES_MAX

/** The default readings are over their own limit (2,000), never the house rules' (A25). */
export const readingsTooLong = (readings: string, frame: RulesFrame): boolean => readings.length > frame.defaultReadingsMaxLength

/** Save is open: dirty, not blank, each text within its own limit, and no save or restore already out. */
export function canSaveRules(draft: RulesDraft, base: CopilotPromptVersion | null, inFlight: boolean, frame: RulesFrame): boolean {
  return (
    isRulesDirty(draft, base, frame) &&
    draft.text.trim() !== '' &&
    !rulesTooLong(draft.text) &&
    !readingsTooLong(draft.readings, frame) &&
    !inFlight
  )
}

/** The body a save sends: both texts in one version, on the version the draft was edited from. */
export function saveRequest(draft: RulesDraft, baseVersion: number, frame: RulesFrame): CopilotPromptSaveRequest {
  return { houseRules: draft.text, note: noteOf(draft.note), baseVersion, defaultReadings: readingsToSend(draft.readings, frame) }
}

/** The body "Try" sends: the question answered with both draft texts, saved or not. */
export function tryRequest(draft: RulesDraft, question: string, frame: RulesFrame): CopilotPromptTryRequest {
  return { houseRules: draft.text, question, defaultReadings: readingsToSend(draft.readings, frame) }
}

/** The `COPILOT-411` dialog: their saved version beside my draft, and the re-post "Save mine on top" sends. */
export interface MergeOffer {
  theirs: { version: number; text: string; readings: string; savedBy: string | null; savedAt: string | null }
  mine: RulesDraft
  saveMineOnTop: CopilotPromptSaveRequest
}

export function mergeOffer(theirs: CopilotPromptVersion, mine: RulesDraft, frame: RulesFrame): MergeOffer {
  return {
    theirs: {
      version: theirs.version,
      text: theirs.text,
      readings: readingsOf(theirs, frame),
      savedBy: theirs.savedBy,
      savedAt: theirs.savedAt,
    },
    mine: { text: mine.text, note: mine.note, readings: mine.readings },
    saveMineOnTop: saveRequest(mine, theirs.version, frame),
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
  /** The version's default readings as shown: its own, or the built-in text. */
  readings: string
}

/** The last 20 versions, newest first, the active one marked. A reply that is not a list reads as none. */
export function historyRows(
  history: readonly CopilotPromptVersion[] | null | undefined,
  activeVersion: number,
  frame: RulesFrame,
): HistoryRow[] {
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
      readings: readingsOf({ ...h, defaultReadings: typeof h.defaultReadings === 'string' ? h.defaultReadings : '' }, frame),
    }))
}

/**
 * A refusal for want of the curator grant, from any of the five doors: the grant filter's bare 403 first
 * (BackOffice 3395), or the service's own `COPILOT-410` second.
 */
export const curatorRefused = (err: unknown): boolean => isBareDenial(err) || apiErrorCode(err) === NOT_CURATOR

/** The field a `COPILOT-412` without `data.field` is about. */
export const HOUSE_RULES_FIELD = 'houseRules'
/** `COPILOT-412`'s `data.field` naming the default readings (3593). */
export const READINGS_FIELD = 'defaultReadings'

/**
 * The field a `COPILOT-412` is about (`CopilotPromptFieldRefusal`): `data.field` as it came (`defaultReadings`, or a
 * starter's path for 875), else the house rules. Null for any other failure.
 */
export function refusedField(err: unknown): string | null {
  if (apiErrorCode(err) !== RULES_INVALID) return null
  const data = apiErrorData(err) as Partial<CopilotPromptFieldRefusal> | null
  const field = data && typeof data === 'object' ? data.field : undefined
  return typeof field === 'string' && field.trim() !== '' ? field : HOUSE_RULES_FIELD
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const orNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const whole = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** One version off the wire: `houseRules` is the text, and an empty saver, time or note is none. */
export function fromVersionWire(w: Partial<CopilotPromptVersionWire> | null | undefined): CopilotPromptVersion {
  const v = w ?? {}
  return {
    version: whole(v.version),
    text: str(v.houseRules),
    savedBy: orNull(v.savedBy),
    savedAt: orNull(v.savedAt),
    note: orNull(v.note),
    revertedFrom: typeof v.revertedFrom === 'number' ? v.revertedFrom : null,
    defaultReadings: str(v.defaultReadings),
  }
}

/** `GET Copilot/Prompt`'s flat view as the core, the active version, and the default readings' built-in text and limit. */
export function fromPromptWire(w: Partial<CopilotPromptWire> | null | undefined): CopilotPrompt {
  const v = w ?? {}
  const max = whole(v.defaultReadingsMaxLength)
  return {
    core: str(v.core),
    active: fromVersionWire({ ...v, revertedFrom: null }),
    builtInDefaultReadings: str(v.builtInDefaultReadings),
    defaultReadingsMaxLength: max > 0 ? max : READINGS_MAX,
  }
}
