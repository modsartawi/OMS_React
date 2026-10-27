import { CATEGORY_GROUPS, type CategoryGroup } from '@/core/insurance-rules/coverage-model'
import type { GuardLineOutcome, GuardSuggestion } from '@/core/insurance-rules/guard-check'
import type { GuardChannel, GuardSeverity, Says } from '@/core/insurance-rules/model'

// The simulator's request and answer (BackOffice spec 3126, door 3140; oms ticket 612). An author types one request
// — channel, store, payer, policy, class, the lines — and a patient key; HQ runs the guard DRAFT over it and answers
// each line's outcome, the rules that fired, and the trace of every condition it read (true / false / unknown).
// Shapes from the brief's "HQ contract: simulate and back-test (3140)" as BUILT; fields marked GUESS are 612's. Pure.

export const SIM_CHANNELS: readonly GuardChannel[] = ['nphies', 'waseel', 'oms', 'bupa']

// ── The request ───────────────────────────────────────────────────────────────────────────

export interface SimLineBody {
  /** The line's number in the request, from 1. */
  line: number
  item: string
  qty: number
  unit: string
  daysSupply?: number
  icd: string[]
  price: number
}

export interface SimulateBody {
  request: {
    channel: GuardChannel
    store: string
    /** GUESS (612): a blank payer / policy / class is sent as null. */
    payer: string | null
    policy: string | null
    class: string | null
    /** Not typed on this screen (3140 takes them optional): `user`, `dob`, `gender`. */
    user?: string
    dob?: string
    gender?: string
    lines: SimLineBody[]
  }
  patientKey: string
  /**
   * An unsaved edit to run instead of the saved draft. Never sent from this screen: the guard editor (608) keeps its
   * unsaved document in its own page state, which the simulator cannot reach, so HQ runs the SAVED draft.
   */
  document?: unknown
}

/** One line as typed: every value a string, read by `simulateBody`. */
export interface SimLineForm {
  item: string
  qty: string
  unit: string
  daysSupply: string
  /** ICD-10-AM codes, typed comma- or space-separated. */
  icd: string
  price: string
}

export interface SimForm {
  channel: GuardChannel
  store: string
  payer: string
  policy: string
  class: string
  patientKey: string
  lines: SimLineForm[]
}

/** GUESS (612): the brief names `unit`, not its words; a new line starts in pieces (`PC`). */
export const emptyLine = (): SimLineForm => ({ item: '', qty: '1', unit: 'PC', daysSupply: '', icd: '', price: '' })
export const emptySimForm = (): SimForm => ({ channel: 'nphies', store: '', payer: '', policy: '', class: '', patientKey: '', lines: [emptyLine()] })

export type SimField = 'store' | 'patientKey' | 'lines' | 'item' | 'qty' | 'unit' | 'daysSupply' | 'price'
export type SimProblemKind = 'required' | 'positive' | 'wholeNumber' | 'amount'
export interface SimProblem {
  field: SimField
  /** A line's number, from 1. */
  line?: number
  problem: SimProblemKind
}

/** Codes typed comma-, semicolon- or space-separated: upper-cased, repeats dropped. */
export function parseCodes(text: string): string[] {
  const out: string[] = []
  for (const c of text.split(/[\s,;]+/)) {
    const code = c.trim().toUpperCase()
    if (code && !out.includes(code)) out.push(code)
  }
  return out
}

const WHOLE = /^\d+$/
const AMOUNT = /^\d+(\.\d+)?$/
const blankToNull = (s: string): string | null => (s.trim() ? s.trim() : null)

/** The typed form → the brief's body, or what is missing / wrong (request fields first, then line by line). */
export function simulateBody(form: SimForm): { body: SimulateBody | null; problems: SimProblem[] } {
  const problems: SimProblem[] = []
  if (!form.store.trim()) problems.push({ field: 'store', problem: 'required' })
  if (!form.patientKey.trim()) problems.push({ field: 'patientKey', problem: 'required' })
  if (form.lines.length === 0) problems.push({ field: 'lines', problem: 'required' })
  const lines: SimLineBody[] = form.lines.map((l, i) => {
    const line = i + 1
    const item = l.item.trim()
    const qty = l.qty.trim()
    const unit = l.unit.trim()
    const days = l.daysSupply.trim()
    const price = l.price.trim()
    if (!item) problems.push({ field: 'item', line, problem: 'required' })
    if (!WHOLE.test(qty)) problems.push({ field: 'qty', line, problem: 'wholeNumber' })
    else if (Number(qty) <= 0) problems.push({ field: 'qty', line, problem: 'positive' })
    if (!unit) problems.push({ field: 'unit', line, problem: 'required' })
    if (days && !WHOLE.test(days)) problems.push({ field: 'daysSupply', line, problem: 'wholeNumber' })
    if (!AMOUNT.test(price)) problems.push({ field: 'price', line, problem: 'amount' })
    // The brief's key order: line, item, qty, unit, daysSupply (only when typed), icd, price.
    return { line, item, qty: Number(qty), unit, ...(days ? { daysSupply: Number(days) } : {}), icd: parseCodes(l.icd), price: Number(price) }
  })
  if (problems.length) return { body: null, problems }
  return {
    body: {
      request: {
        channel: form.channel,
        store: form.store.trim(),
        payer: blankToNull(form.payer),
        policy: blankToNull(form.policy),
        class: blankToNull(form.class),
        lines,
      },
      patientKey: form.patientKey.trim(),
    },
    problems,
  }
}

/** A field's problem on screen, or undefined. */
export const problemOf = (problems: readonly SimProblem[], field: SimField, line?: number): SimProblem | undefined =>
  problems.find((p) => p.field === field && p.line === line)

// ── The answer ────────────────────────────────────────────────────────────────────────────

export type TraceValue = true | false | 'unknown'

/** One condition HQ read: its rule, its place in the rule (the Validate `blockPath` grammar), and its value. */
export interface SimTrace {
  ruleId: string
  blockPath: string
  /** GUESS (612): the value AFTER the condition's NOT, as the sentence reads (NOT folded in). */
  value: TraceValue
  /** GUESS (612): the brief names `why`, not its shape — read as EN + AR, or one text. */
  why?: Says | string | null
}

export interface SimFired {
  ruleId: string
  /** The published version the rule answered from (null for a draft-only rule). */
  version?: number | null
  severity: GuardSeverity
  en: string
  ar: string
  codes?: { conflict?: string | null; nphies?: string | null } | null
  suggestion?: GuardSuggestion | null
}

/**
 * The line's insurance category as the category rules set it (story 61; 617). GUESS (review 3126 P6a): the brief's
 * Simulate answer names no category; read as `{ group, ruleId }`, `ruleId` null when no category rule matched and the
 * item master's category stands.
 */
export interface SimLineCategory {
  group: CategoryGroup
  ruleId: string | null
}

export interface SimLineResult {
  /** The request line it answers (the body's `line`). */
  line: number
  outcome: GuardLineOutcome
  fired: SimFired[]
  /** GUESS (612): the rules that could not decide on this line (a fact unknown), read as their ids. */
  unknowns: string[]
  trace: SimTrace[]
  category?: SimLineCategory | null
}

/** The rule ids a line could not decide, whatever spelling HQ used (`"G-007"` or `{ ruleId }`). */
export function lineUnknowns(line: Pick<SimLineResult, 'unknowns'>): string[] {
  const out: string[] = []
  for (const u of (line.unknowns ?? []) as unknown[]) {
    const id = typeof u === 'string' ? u : u && typeof u === 'object' && 'ruleId' in u ? String((u as { ruleId: unknown }).ruleId) : ''
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

/** The category a line was given and by which rule, or null when the answer names none (or a group this build does not know). */
export function lineCategory(line: SimLineResult): SimLineCategory | null {
  const c = line.category
  if (!c || !(CATEGORY_GROUPS as readonly string[]).includes(c.group)) return null
  return { group: c.group, ruleId: c.ruleId ?? null }
}

export interface SimulateResult {
  /** One per request line, in the request's order. */
  lines: SimLineResult[]
}
