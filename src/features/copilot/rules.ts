import { apiErrorCode, apiErrorData, isBareDenial } from '@/core/api'
import type {
  CopilotAnswer,
  CopilotReaderKind,
  CopilotStarter,
  CopilotStarterProof,
  CopilotStarterSet,
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
 * limit, and whether the starters are on with their limits (875). `CopilotPrompt` is one.
 */
export type RulesFrame = Pick<
  CopilotPrompt,
  'builtInDefaultReadings' | 'defaultReadingsMaxLength' | 'startersOn' | 'startersPerKind' | 'starterMaxLength'
>

/** The starters' limits when the read door names none (3600, A51). */
export const STARTERS_PER_KIND = 6
export const STARTER_MAX = 200

/** The two kinds of reader, in the screen's order. */
export const READER_KINDS: readonly CopilotReaderKind[] = ['executive', 'operations']

/**
 * What the curator is editing: the house rules, the optional "Why the change", the default readings (874), and the
 * starters (875).
 */
export interface RulesDraft {
  text: string
  note: string
  /** As shown: the version's own default readings, or the built-in text when it has none. */
  readings: string
  starters: StartersDraft
}

/** A version's default readings as the screen shows them: its own, or the built-in text when it has none. */
export const readingsOf = (v: CopilotPromptVersion, frame: RulesFrame): string =>
  v.defaultReadings !== '' ? v.defaultReadings : frame.builtInDefaultReadings

/** A version's starters as the screen edits them: each with its stored proof (sent back unchanged when untouched). */
export const startersOf = (set: CopilotStarterSet): StartersDraft => ({
  executive: set.executive.map(starterDraftOf),
  operations: set.operations.map(starterDraftOf),
})

const starterDraftOf = (s: CopilotStarter): StarterDraft => ({
  en: s.question.en,
  ar: s.question.ar,
  blank: s.blank,
  proof: s.blank ? null : (s.proof ?? null),
})

/** The draft a version opens as: its texts and starters, no note. */
export const draftOf = (v: CopilotPromptVersion, frame: RulesFrame): RulesDraft => ({
  text: v.text,
  note: '',
  readings: readingsOf(v, frame),
  starters: startersOf(v.starters),
})

const noteOf = (note: string | null | undefined): string | null => (note && note.trim() !== '' ? note.trim() : null)

/**
 * The default readings as a door takes them (3593): the shown text, or `""` (none of its own) when it is blank or
 * still the built-in text — the built-in text is never stored as a version's own.
 */
export const readingsToSend = (readings: string, frame: RulesFrame): string =>
  readings.trim() === '' || readings === frame.builtInDefaultReadings ? '' : readings

/** The draft's starters differ from the version's (text, blank mark, order, a proof taken or cleared). */
const startersChanged = (starters: StartersDraft, base: CopilotPromptVersion): boolean =>
  JSON.stringify(starters) !== JSON.stringify(startersOf(base.starters))

/** The draft differs from the version it was edited from: either text, the starters, or a note was written. */
export function isRulesDirty(draft: RulesDraft, base: CopilotPromptVersion | null, frame: RulesFrame): boolean {
  if (!base) return false
  return (
    draft.text !== base.text ||
    readingsToSend(draft.readings, frame) !== base.defaultReadings ||
    (frame.startersOn && startersChanged(draft.starters, base)) ||
    noteOf(draft.note) !== null
  )
}

export const rulesTooLong = (text: string): boolean => text.length > RULES_MAX

/** The default readings are over their own limit (2,000), never the house rules' (A25). */
export const readingsTooLong = (readings: string, frame: RulesFrame): boolean => readings.length > frame.defaultReadingsMaxLength

/**
 * Save is open: dirty, not blank, each text within its own limit, every starter fit to save (875, with the starters
 * on), and no save or restore already out.
 */
export function canSaveRules(draft: RulesDraft, base: CopilotPromptVersion | null, inFlight: boolean, frame: RulesFrame): boolean {
  return (
    isRulesDirty(draft, base, frame) &&
    draft.text.trim() !== '' &&
    !rulesTooLong(draft.text) &&
    !readingsTooLong(draft.readings, frame) &&
    !(frame.startersOn && starterIssue(draft.starters, frame) !== null) &&
    !inFlight
  )
}

/** One starter as the save takes it: both texts trimmed, the proof unless it has a blank (3600). */
const starterToSend = (s: StarterDraft): CopilotStarter => ({
  question: { en: s.en.trim(), ar: s.ar.trim() },
  blank: s.blank,
  ...(!s.blank && s.proof ? { proof: s.proof } : {}),
})

/** The starters as the save takes them: every one, in order, with its proof (a stored one sent back unchanged). */
export const startersToSend = (starters: StartersDraft): CopilotStarterSet => ({
  executive: starters.executive.map(starterToSend),
  operations: starters.operations.map(starterToSend),
})

/**
 * The body a save sends: both texts and the starters in one version, on the version the draft was edited from. With
 * the starters off (875) it sends none, and the server keeps the version's own.
 */
export function saveRequest(draft: RulesDraft, baseVersion: number, frame: RulesFrame): CopilotPromptSaveRequest {
  return {
    houseRules: draft.text,
    note: noteOf(draft.note),
    baseVersion,
    defaultReadings: readingsToSend(draft.readings, frame),
    ...(frame.startersOn ? { starters: startersToSend(draft.starters) } : {}),
  }
}

/** The body "Try" sends: the question answered with both draft texts, saved or not. */
export function tryRequest(draft: RulesDraft, question: string, frame: RulesFrame): CopilotPromptTryRequest {
  return { houseRules: draft.text, question, defaultReadings: readingsToSend(draft.readings, frame) }
}

/**
 * One starter as the curator edits it (875, BackOffice 3600 A51/A52): both languages, the "has a blank" mark, and the
 * tool call its last successful try answered with — null until tried, and again once its text changes.
 */
export interface StarterDraft {
  en: string
  ar: string
  blank: boolean
  proof: CopilotStarterProof | null
}

/** The starters for each kind of reader, in their order. */
export type StartersDraft = Record<CopilotReaderKind, StarterDraft[]>

/** The outcomes a try counts as answered: a lookup that answered, with or without the model's own words (3590). */
const PROVEN_OUTCOMES: ReadonlySet<CopilotAnswer['outcome']> = new Set(['answered', 'figures-only'])

/**
 * The proof a try keeps (A52): the last tool call of its trace that succeeded, as `{ tool, input }`. None when the try
 * did not answer ("can't answer", a refusal, a question back) or answered with no lookup.
 */
export function trialProof(answer: CopilotAnswer): CopilotStarterProof | null {
  if (!PROVEN_OUTCOMES.has(answer.outcome)) return null
  const trace = Array.isArray(answer.trace) ? answer.trace : []
  for (let i = trace.length - 1; i >= 0; i--) {
    if (trace[i].ok) return { tool: trace[i].tool, input: trace[i].input }
  }
  return null
}

const withStarter = (starters: StartersDraft, kind: CopilotReaderKind, index: number, f: (s: StarterDraft) => StarterDraft): StartersDraft => ({
  ...starters,
  [kind]: starters[kind].map((s, i) => (i === index ? f(s) : s)),
})

/**
 * A try's answer on the starter it was run for: its proof is the try's (or none). Dropped when the starter's English
 * text is no longer the text tried — the curator edited it while the try was out.
 */
export function applyTrial(starters: StartersDraft, kind: CopilotReaderKind, index: number, triedText: string, answer: CopilotAnswer): StartersDraft {
  const s = starters[kind][index]
  if (!s || s.en !== triedText) return starters
  return withStarter(starters, kind, index, (x) => ({ ...x, proof: trialProof(answer) }))
}

/**
 * The curator edits a starter: a change to its text in either language clears its proof (the try answered the old
 * text); the blank mark leaves it.
 */
export function editStarter(
  starters: StartersDraft,
  kind: CopilotReaderKind,
  index: number,
  patch: Partial<Pick<StarterDraft, 'en' | 'ar' | 'blank'>>,
): StartersDraft {
  return withStarter(starters, kind, index, (s) => {
    const next = { ...s, ...patch }
    return next.en !== s.en || next.ar !== s.ar ? { ...next, proof: null } : next
  })
}

/** A kind's list has room for one more (at most `startersPerKind`, 6). */
export const canAddStarter = (starters: StartersDraft, kind: CopilotReaderKind, frame: RulesFrame): boolean =>
  starters[kind].length < frame.startersPerKind

/** One more, empty and unproven, at the end of the kind's list; the same set when the list is full. */
export const addStarter = (starters: StartersDraft, kind: CopilotReaderKind, frame: RulesFrame): StartersDraft =>
  canAddStarter(starters, kind, frame) ? { ...starters, [kind]: [...starters[kind], { en: '', ar: '', blank: false, proof: null }] } : starters

export const removeStarter = (starters: StartersDraft, kind: CopilotReaderKind, index: number): StartersDraft => ({
  ...starters,
  [kind]: starters[kind].filter((_, i) => i !== index),
})

/** Why a starter keeps the save shut: a language missing or over the limit (`lang` says which), or no proof. */
export type StarterProblem = 'missing' | 'tooLong' | 'unproven'

/** The first starter that keeps the save shut, in screen order; the screen names it (counting from 1). */
export interface StarterIssue {
  kind: CopilotReaderKind
  index: number
  problem: StarterProblem
  lang?: 'en' | 'ar'
}

const LANGS = ['en', 'ar'] as const

/**
 * The first starter the save would be refused for, or null: each language present and at most `starterMaxLength`
 * after trimming, then a proof unless it has a blank for the reader (A52). The server checks it all again (3600);
 * this is for the curator's convenience.
 */
export function starterIssue(starters: StartersDraft, frame: RulesFrame): StarterIssue | null {
  for (const kind of READER_KINDS) {
    const list = starters[kind]
    for (let index = 0; index < list.length; index++) {
      const s = list[index]
      for (const lang of LANGS) {
        const text = s[lang].trim()
        if (text === '') return { kind, index, problem: 'missing', lang }
        if (text.length > frame.starterMaxLength) return { kind, index, problem: 'tooLong', lang }
      }
      if (!s.blank && s.proof === null) return { kind, index, problem: 'unproven' }
    }
  }
  return null
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
    mine: { text: mine.text, note: mine.note, readings: mine.readings, starters: mine.starters },
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
  /** The version's starters (875), restored with it. */
  starters: StartersDraft
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
      starters: startersOf(starterSetFromWire(h.starters)),
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

/** The starter (or a kind's whole list, `index` null) a `COPILOT-412` names. */
export interface RefusedStarter {
  kind: CopilotReaderKind
  index: number | null
}

const STARTER_PATH = /^starters\.(executive|operations)(?:\[(\d+)\])?(?:\.|$)/

/**
 * The starter a refused field names (3600): `starters.<kind>[<i>]…` (zero-based) is that starter, `starters.<kind>`
 * its list (over the limit). Null for any other field.
 */
export function starterOfField(field: string | null): RefusedStarter | null {
  const m = field ? STARTER_PATH.exec(field) : null
  if (!m) return null
  return { kind: m[1] as CopilotReaderKind, index: m[2] !== undefined ? Number(m[2]) : null }
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
    starters: starterSetFromWire(v.starters),
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** One starter off the wire, or null when it is not one. A blank starter carries no proof (3600). */
function starterFromWire(w: unknown): CopilotStarter | null {
  if (!isRecord(w) || !isRecord(w.question)) return null
  const blank = w.blank === true
  const p = w.proof
  const proof = !blank && isRecord(p) && typeof p.tool === 'string' && p.tool !== '' ? { tool: p.tool, input: isRecord(p.input) ? p.input : {} } : undefined
  return { question: { en: str(w.question.en), ar: str(w.question.ar) }, blank, ...(proof ? { proof } : {}) }
}

/** A version's starters off the wire: absent (the switch off, an older server) or odd reads as none. */
export function starterSetFromWire(w: unknown): CopilotStarterSet {
  const list = (v: unknown): CopilotStarter[] =>
    Array.isArray(v) ? v.map(starterFromWire).filter((s): s is CopilotStarter => s !== null) : []
  return isRecord(w) ? { executive: list(w.executive), operations: list(w.operations) } : { executive: [], operations: [] }
}

/**
 * `GET Copilot/Prompt`'s flat view as the core, the active version, the default readings' built-in text and limit,
 * and the starters' switch and limits (the switch is on when the door carries `starters`).
 */
export function fromPromptWire(w: Partial<CopilotPromptWire> | null | undefined): CopilotPrompt {
  const v = w ?? {}
  const max = whole(v.defaultReadingsMaxLength)
  const perKind = whole(v.startersPerKind)
  const starterMax = whole(v.starterMaxLength)
  return {
    core: str(v.core),
    active: fromVersionWire({ ...v, revertedFrom: null }),
    builtInDefaultReadings: str(v.builtInDefaultReadings),
    defaultReadingsMaxLength: max > 0 ? max : READINGS_MAX,
    startersOn: isRecord(v.starters),
    startersPerKind: perKind > 0 ? perKind : STARTERS_PER_KIND,
    starterMaxLength: starterMax > 0 ? starterMax : STARTER_MAX,
  }
}
