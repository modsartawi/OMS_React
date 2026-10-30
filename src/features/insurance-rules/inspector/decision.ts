// The inspector's reading of a decision (BackOffice spec 3271 R4–R6, R10; door 3298; oms ticket 710). The read log
// keeps typed values, a reference and a hash, never a FHIR fragment, so a decision explains itself after the kept copy
// is purged. Pure. 🚩 Every wire shape here is guessed: 3298 spells none; 711 reconciles.

/** One fact as the read log holds it. */
export interface DecisionFact {
  key: string
  /** The FHIRPath it was read from. */
  path: string
  type: string
  state: string
  value: unknown
}

/** The replay of the published version on the logged values. `matches`: it agrees with what was decided. */
export interface DecisionReplay {
  outcome: string
  matches: boolean
}

/** `GET InsuranceRules/Decisions/{id}`. */
export interface DecisionView {
  id: string
  at: string
  store: string
  pharmacist: string
  channel: string
  sourceRef: string
  /** As the door masks it; masked again on screen. */
  patient: string
  ruleId: string | null
  ruleVersion: number | null
  outcome: string
  facts: DecisionFact[]
  replay: DecisionReplay | null
  /** What survives the purge: the reference and the hash; `kept` says whether a copy is still held. */
  message: { ref: string; hash: string; kept: boolean }
}

/** `GET InsuranceRules/Decisions/{id}/Message`: the kept copy, else a re-fetch. Shown, never stored. */
export interface DecisionMessage {
  source: string | null
  check: string
  hash: string | null
  foundHash: string | null
  message: unknown
}

export type FactReading = { state: 'value'; text: string; isolate: 'ltr' | 'auto' } | { state: 'yes' | 'no' | 'unknown' | 'unparsed' }

/** The kinds of fact that are free text in either script; everything else is a machine value. */
const FREE_TEXT = new Set(['text', 'string'])

/** A fact in words. The value is the logged one, untouched: this is evidence, so it is not reformatted. */
export function factReading(f: Pick<DecisionFact, 'type' | 'state' | 'value'>): FactReading {
  if (f.state === 'unparsed') return { state: 'unparsed' }
  if (f.state !== 'value' || f.value === null || f.value === undefined || f.value === '') return { state: 'unknown' }
  if (typeof f.value === 'boolean') return { state: f.value ? 'yes' : 'no' }
  return { state: 'value', text: String(f.value), isolate: FREE_TEXT.has(f.type) ? 'auto' : 'ltr' }
}

export const MESSAGE_WORDS = ['kept.match', 'kept.differs', 'refetched.match', 'refetched.differs', 'notFound'] as const
export type MessageWords = (typeof MESSAGE_WORDS)[number]

export interface MessageReading {
  words: MessageWords
  check: 'match' | 'differs' | 'notFound'
  /** Null unless a known source and a known check stand behind it. */
  body: unknown
  hash: string | null
  foundHash: string | null
}

/** Where the message came from and how it checked. Anything the screen cannot vouch for is not found, and not shown. */
export function messageReading(r: DecisionMessage | null | undefined): MessageReading {
  const hash = r?.hash ?? null
  const hasBody = r?.message !== null && r?.message !== undefined && r?.message !== ''
  if (r && hasBody && (r.source === 'kept' || r.source === 'refetched') && (r.check === 'match' || r.check === 'differs'))
    return { words: `${r.source}.${r.check}`, check: r.check, body: r.message, hash, foundHash: r.foundHash ?? null }
  return { words: 'notFound', check: 'notFound', body: null, hash, foundHash: null }
}

/** The message laid out for reading. */
export function messageText(body: unknown): string {
  if (typeof body !== 'string') return JSON.stringify(body, null, 2)
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export type ReplayState = 'same' | 'different' | 'none'

export function replayReading(r: DecisionReplay | null | undefined): { state: ReplayState; outcome: string | null } {
  if (!r?.outcome) return { state: 'none', outcome: null }
  return { state: r.matches ? 'same' : 'different', outcome: r.outcome }
}
