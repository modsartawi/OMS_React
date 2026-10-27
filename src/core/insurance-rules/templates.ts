import { requestListField, type GuardRule, type Says } from './model'

// Guard templates (BackOffice spec 3126, door 3139; oms ticket 609). The gallery holds HQ's phase-1 templates
// (`assets/3093-guard-templates.md`, each with its DUR conflict code) and team templates saved from a rule.
// A template is a rule whose BLANKS (`«…»` in 3093) are named by their JSON path in the rule; filling them
// makes an independent draft rule. In core because the Templates gallery fills them and the Guards rule
// page saves a rule as one (a feature may not import another).
//
// ⚠️ PROVISIONAL shapes (609), 618 reconciles — the brief names the doors only:
// - `GET InsuranceRules/Guards/Templates` → `GuardTemplate[]` (`source`, `conflictCode`, `rule`, `blanks`);
// - `POST …/Templates` body `{ ruleId, name, blanks: [path] }` → the saved `GuardTemplate`;
// - `POST …/Templates/{id}/Create` body `{ values: { [path]: value }, folder }` → the created draft `GuardRule`
//   (HQ mints its id and adds it to the draft).
// - A blank path is the rule's JSON path, the grammar of HQ's checks (`when[0].conditions[2].windowDays`).

export type TemplateSource = 'phase1' | 'team'

export interface TemplateBlank {
  /** The rule's JSON path the author fills: `name`, `filters[0].list`, `when[0].windowDays`. */
  path: string
  /** What the author is asked; a team template's blanks have none (the client names them by the path). */
  label?: Says | null
}

export interface GuardTemplate {
  id: string
  source: TemplateSource
  name: Says
  /** The DUR conflict code (NCPDP 439-E4) the gallery shows; null when the template has none. */
  conflictCode: string | null
  /** The rule, each blank holding its default (a number) or an empty value. Its id and state are not used. */
  rule: GuardRule
  blanks: TemplateBlank[]
  /** A team template's author and local moment. */
  createdBy?: string | null
  createdAt?: string | null
}

/** A blank's value: a number, a text (a list id, a day), or EN + AR words. */
export type BlankValue = number | string | Says

// Spelled out, not imported from `./api`, so this pure module loads in vitest without the http client.
export const GUARD_TEMPLATES_KEY = ['insurance-rules', 'guards', 'templates'] as const

// ── Paths ─────────────────────────────────────────────────────────────────────────────────────

type Step = string | number

/** `when[0].conditions[2].windowDays` → `['when', 0, 'conditions', 2, 'windowDays']`; null when malformed. */
export function parsePath(path: string): Step[] | null {
  const out: Step[] = []
  for (const part of path.split('.')) {
    const m = /^([A-Za-z_$][\w$]*)((?:\[\d+\])*)$/.exec(part)
    if (!m) return null
    out.push(m[1])
    for (const i of m[2].matchAll(/\[(\d+)\]/g)) out.push(Number(i[1]))
  }
  return out
}

/** The value at a path, or undefined. */
export function valueAt(root: unknown, path: string): unknown {
  const steps = parsePath(path)
  if (!steps) return undefined
  let at: unknown = root
  for (const s of steps) {
    if (at === null || typeof at !== 'object') return undefined
    at = (at as Record<Step, unknown>)[s]
  }
  return at
}

/** Sets the value at an existing path, in place; false when the path does not reach into the object. */
function setAt(root: unknown, path: string, value: unknown): boolean {
  const steps = parsePath(path)
  if (!steps) return false
  let at: unknown = root
  for (const s of steps.slice(0, -1)) {
    if (at === null || typeof at !== 'object') return false
    at = (at as Record<Step, unknown>)[s]
  }
  if (at === null || typeof at !== 'object') return false
  ;(at as Record<Step, unknown>)[steps[steps.length - 1]] = value
  return true
}

const isSays = (v: unknown): v is Says => typeof v === 'object' && v !== null && 'en' in v && 'ar' in v

/** Whether a blank's value is still empty: no number, an empty text, or words missing a language. */
export function blankIsEmpty(v: unknown): boolean {
  if (typeof v === 'number') return !Number.isFinite(v)
  if (typeof v === 'string') return v.trim() === ''
  if (isSays(v)) return !v.en.trim() || !v.ar.trim()
  return true
}

// ── Fill a template ───────────────────────────────────────────────────────────────────────────

/** The value each blank ends with: the author's, else the template's default. */
const finalValue = (t: GuardTemplate, values: Readonly<Record<string, unknown>>, path: string): unknown =>
  path in values ? values[path] : valueAt(t.rule, path)

/** The blanks (by path) still empty once the values are filled in — Create waits for none. */
export function missingBlanks(t: GuardTemplate, values: Readonly<Record<string, unknown>>): string[] {
  return t.blanks.filter((b) => blankIsEmpty(finalValue(t, values, b.path))).map((b) => b.path)
}

/**
 * The draft rule a template makes: a deep copy of its rule with each blank set to the author's value (a value
 * for a path that is not a blank is ignored), under a new id, in a folder (the template rule's by default),
 * as a draft. Nothing is shared with the template: editing the rule never edits the template.
 */
export function fillTemplate(
  t: GuardTemplate,
  values: Readonly<Record<string, unknown>>,
  { id, folder }: { id: string; folder?: string | null },
): GuardRule {
  const rule = structuredClone(t.rule)
  for (const b of t.blanks) if (b.path in values) setAt(rule, b.path, structuredClone(values[b.path]))
  delete rule.shadowSince
  return { ...rule, id, folder: folder ?? rule.folder, state: 'draft' }
}

// ── Save a rule as a template ─────────────────────────────────────────────────────────────────

export interface BlankCandidate {
  path: string
  value: BlankValue
}

/** Texts in a condition worth a blank: a patient / policy list, a day, a formula. Block kinds never are. */
const TEXT_KEYS = new Set(['after', 'formula', 'list'])

function conditionCandidates(c: unknown, at: string, out: BlankCandidate[]) {
  if (c === null || typeof c !== 'object') return
  const o = c as Record<string, unknown>
  for (const [k, v] of Object.entries(o)) {
    const path = `${at}.${k}`
    if (k === 'conditions' && Array.isArray(v)) v.forEach((x, i) => conditionCandidates(x, `${path}[${i}]`, out))
    else if (typeof v === 'number') out.push({ path, value: v })
    else if (typeof v === 'string' && (TEXT_KEYS.has(k) || (k === 'inList' && (o.check === 'patient' || requestListField(o as { check: string }) !== null)))) out.push({ path, value: v })
    else if (Array.isArray(v)) v.forEach((x, i) => conditionCandidates(x, `${path}[${i}]`, out))
    else if (typeof v === 'object' && v !== null) conditionCandidates(v, path, out)
  }
}

/**
 * The values of a rule an author may make blanks when saving it as a template, in the rule's order: its
 * name, each filter's list, every number and list / day / formula of its conditions, and each message.
 * A line's `inList` (a filter alias) is not offered — its filter's list is.
 */
export function blankCandidates(rule: GuardRule): BlankCandidate[] {
  const out: BlankCandidate[] = [{ path: 'name', value: rule.name }]
  rule.filters.forEach((f, i) => out.push({ path: `filters[${i}].list`, value: f.list }))
  rule.when.forEach((c, i) => conditionCandidates(c, `when[${i}]`, out))
  rule.then.forEach((e, i) => out.push({ path: `then[${i}].says`, value: e.says }))
  return out
}

/** The word a blank is named by when it has no label: its path's last key (`windowDays`, `list`, `says`). */
export const blankKey = (path: string): string => {
  const steps = parsePath(path)
  const last = steps?.filter((s): s is string => typeof s === 'string').pop()
  return last ?? path
}

/** How a blank is typed: words in two languages, a list picked from the ruleset, a number, or a code. */
export type BlankKind = 'says' | 'list' | 'number' | 'text'

export function blankKind(t: Pick<GuardTemplate, 'rule'>, path: string): BlankKind {
  const v = valueAt(t.rule, path)
  if (isSays(v)) return 'says'
  if (typeof v === 'number') return 'number'
  return blankKey(path) === 'list' ? 'list' : 'text'
}

/** The blank keys named in words (`insurance-rules:template.blank.<key>`); any other reads `other` + its path. */
export const BLANK_WORDS = [
  'name',
  'list',
  'says',
  'windowDays',
  'atLeast',
  'above',
  'below',
  'value',
  'inList',
  'after',
  'formula',
  'eligibleDaysBeforeDue',
  'surplusDays',
  'overDays',
  'assumeDays',
  'priceAbove',
  'consumedBelow',
] as const

export const blankWord = (path: string): string => {
  const k = blankKey(path)
  return (BLANK_WORDS as readonly string[]).includes(k) ? k : 'other'
}
