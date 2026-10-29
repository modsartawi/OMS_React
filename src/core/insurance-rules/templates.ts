import { guardRuleIn, guardRuleOut } from './guard-wire'
import { requestListField, type GuardRule, type Says } from './model'

// Guard templates (BackOffice spec 3126, door 3139; oms ticket 609). The gallery holds HQ's phase-1 templates
// (`assets/3093-guard-templates.md`, each with its DUR conflict code) and team templates saved from a rule.
// A template is a rule whose BLANKS (`«…»` in 3093) are named by their JSON path in the rule; filling them
// makes an independent draft rule. In core because the Templates gallery fills them and the Guards rule
// page saves a rule as one (a feature may not import another).
//
// As BUILT (BackOffice 3139; oms 618 reconciled 609's guesses):
// - `GET InsuranceRules/Guards/Templates` → `[{ id, origin: phase1|team, name, conflictCode, rule, blanks: [path],
//   updatedBy, updatedAt }]` — read by `templateIn` (the rule through `./guard-wire`, each path a `TemplateBlank`);
// - `POST …/Templates { id, name, ruleId, blanks: [path] }` saves a rule (the draft's, else the newest version's) as
//   a team template; the same `id` replaces it, a phase-1 id is 409 `GUARDS_TEMPLATE_READ_ONLY`;
// - `POST …/Templates/{id}/Create { revision, ruleId, name?, folder?, values: { [blank path]: value } }` adds an
//   independent copy to the draft as `state: draft` and answers the DRAFT (the client names the rule; a value for a
//   path that is not a blank is 400).
// - A blank path is the rule's JSON path in the ENGINE's spelling (`when[0].windowDays`, `then[0].severity`); the
//   codec keeps every index and every value a template blanks, so the path reads the same in the editor's rule.

/** Where a template came from: HQ's phase-1 gallery (read-only) or saved by the team. HQ calls it `origin`. */
export type TemplateSource = 'phase1' | 'team'

export interface TemplateBlank {
  /** The rule's JSON path the author fills: `when[0].windowDays`, `then[0].severity`. */
  path: string
  /** What the author is asked. HQ sends paths only, so the client names a blank by its path's last key. */
  label?: Says | null
}

export interface GuardTemplate {
  id: string
  origin: TemplateSource
  name: Says
  /** The DUR conflict code (NCPDP 439-E4) the gallery shows; null when the template has none. */
  conflictCode: string | null
  /** The rule, each blank holding its default (a number) or an empty value. Its id and state are not used. */
  rule: GuardRule
  blanks: TemplateBlank[]
  /** Who last saved it and when (local); `seed` for the phase-1 rows. */
  updatedBy?: string | null
  updatedAt?: string | null
}

/** A template as `GET …/Templates` sends it (3139). */
export interface GuardTemplateReply {
  id: string
  origin: string
  name: Says
  conflictCode: string | null
  rule: unknown
  blanks: string[]
  updatedBy: string | null
  updatedAt: string | null
}

/** The reply → the gallery's template: the rule through the wire codec, each blank path a `TemplateBlank`. */
export const templateIn = (t: GuardTemplateReply): GuardTemplate => ({
  id: t.id,
  origin: t.origin === 'team' ? 'team' : 'phase1',
  name: t.name ?? { en: '', ar: '' },
  conflictCode: t.conflictCode || null,
  rule: guardRuleIn(t.rule),
  blanks: (t.blanks ?? []).map((path) => ({ path })),
  updatedBy: t.updatedBy || null,
  updatedAt: t.updatedAt || null,
})

/**
 * A template as HQ stores it (656's JSON view): its rule back in the engine's spelling, without the id and state a
 * template does not carry, and its blanks as paths.
 */
export function templateOut(t: GuardTemplate): Record<string, unknown> {
  const { id: _id, state: _state, ...rule } = guardRuleOut(t.rule)
  return { id: t.id, origin: t.origin, name: t.name, conflictCode: t.conflictCode, blanks: t.blanks.map((b) => b.path), rule }
}

/**
 * The id a rule's team template is saved under (`POST …/Templates` names it): `team-<rule id>`, letters, digits,
 * `.`, `_`, `-`, up to 40. Saving the same rule again replaces its template.
 */
export const teamTemplateId = (ruleId: string): string => `team-${ruleId}`.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 40)

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

/** The list id a list blank holds (`match` blanks carry it as `list:<id>`), and the value that picks one. */
export const listBlankId = (path: string, v: unknown): string => (blankKey(path) === 'match' ? String(v ?? '').replace(/^list:/, '') : String(v ?? ''))
export const listBlankValue = (path: string, id: string): string => (blankKey(path) === 'match' && id ? `list:${id}` : id)

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

/**
 * The blank values Create sends: only blanks whose value differs from the template's (a blank not given keeps the
 * template's value at HQ), so an untouched default is never re-sent in another spelling.
 */
export function changedValues(t: GuardTemplate, values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const b of t.blanks)
    if (b.path in values && JSON.stringify(values[b.path]) !== JSON.stringify(valueAt(t.rule, b.path))) out[b.path] = values[b.path]
  return out
}

// ── Save a rule as a template ─────────────────────────────────────────────────────────────────

export interface BlankCandidate {
  path: string
  value: BlankValue
}

/** Texts in a condition worth a blank: a patient / policy list, a day. Block kinds never are. */
const TEXT_KEYS = new Set(['after', 'list'])

/**
 * The candidates of one condition, by the path HQ reads (the ENGINE's spelling, `./guard-wire`): a line block's
 * `below` is `under` there, a `match: list:<id>` is offered whole, and a fact or formula block — spelled differently
 * on the wire — offers none.
 */
function conditionCandidates(c: unknown, at: string, out: BlankCandidate[]) {
  if (c === null || typeof c !== 'object') return
  const o = c as Record<string, unknown>
  if (o.check === 'fact' || o.check === 'formula') return
  for (const [k, v] of Object.entries(o)) {
    const key = o.check === 'line' && k === 'below' ? 'under' : k
    const path = `${at}.${key}`
    if (k === 'conditions' && Array.isArray(v)) v.forEach((x, i) => conditionCandidates(x, `${path}[${i}]`, out))
    else if (typeof v === 'number') out.push({ path, value: v })
    else if (typeof v === 'string' && k === 'match' && v.startsWith('list:')) out.push({ path, value: v })
    else if (typeof v === 'string' && (TEXT_KEYS.has(k) || (k === 'inList' && (o.check === 'patient' || o.check === 'line' || requestListField(o as { check: string }) !== null)))) out.push({ path, value: v })
    else if (Array.isArray(v)) v.forEach((x, i) => conditionCandidates(x, `${path}[${i}]`, out))
    else if (typeof v === 'object' && v !== null) conditionCandidates(v, path, out)
  }
}

/**
 * The values of a rule an author may make blanks when saving it as a template, in the rule's order: its name,
 * every number and list / day of its conditions, and each message — each by the path HQ checks it at (3139 refuses
 * a blank that is not a field of the rule it stores, which has no `filters`).
 */
export function blankCandidates(rule: GuardRule): BlankCandidate[] {
  const out: BlankCandidate[] = [{ path: 'name', value: rule.name }]
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
  const key = blankKey(path)
  if (key === 'list' || key === 'inList') return 'list'
  // A history / volume block names its list as `match: "list:<id>"` (the engine's spelling, 3130).
  return key === 'match' && typeof v === 'string' && (v === '' || v.startsWith('list:')) ? 'list' : 'text'
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
  'severity',
  'match',
  'by',
  'eligibleDaysBeforeDueFor',
] as const

export const blankWord = (path: string): string => {
  const k = blankKey(path)
  return (BLANK_WORDS as readonly string[]).includes(k) ? k : 'other'
}
