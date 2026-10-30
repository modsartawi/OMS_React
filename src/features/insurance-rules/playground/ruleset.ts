import type { GuardIssue } from '@/core/insurance-rules/checks'
import { conditionAt, newGuardRule, nextGuardId } from '@/core/insurance-rules/guard-edit'
import {
  CATEGORY_GROUPS,
  COVERAGE_EFFECTS,
  COVERAGE_SEGMENTS,
  newRule,
  nextRuleId,
  type CategoryRule,
  type CoverageRule,
  type InsuranceRuleKind,
} from '@/core/insurance-rules/coverage-model'
import { guardRuleIn, guardRuleOut, guardRulesetIn, otherRuleIn, otherRuleOut, rulesetIn } from '@/core/insurance-rules/guard-wire'
import type { GuardCondition, GuardList, GuardRule } from '@/core/insurance-rules/model'
import type { PlaygroundKind, PlaygroundReaderError } from '@/core/insurance-rules/playground'

// The Rule pane's mini ruleset (oms 679): the scratch document's rules read into the editors' model through the SAME
// wire codec the rule screens save through (`core/insurance-rules/guard-wire`), and printed back. Pure.
//
// The JSON box stays the source of truth. A rule the codec cannot read back unchanged (a shape `guard-wire` does not
// draw, a value it would rewrite) is **JSON-only**: the editors leave it alone and it is printed exactly as it came
// (same keys, same order), so it still runs. An editable rule the editors did not touch is also printed as it came;
// an edited one is printed in the engine's spelling without the defaults the reader filled in (an absent `name`,
// `folder`, `state` … stays absent unless the editor changed it).
//
// Kind-agnostic by design: a kind is one `RuleCodec`. 679 registers the guard's; 680 the coverage and category ones,
// over the codec the Categories / Coverage pages save through (`guard-wire`'s `rulesetIn` / `rulesetOut` rule halves).

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** One kind's rule codec: the engine's rule → the editors' rule, and back. */
export interface RuleCodec<R> {
  in: (raw: unknown) => R
  out: (rule: R) => unknown
  /** A new blank rule (engine spelling), its id fresh among `ids`. */
  blank: (ids: readonly string[]) => Obj
  /** Whether the editors can draw the read rule at all (every block a kind they know); else it is JSON-only. */
  drawable: (rule: R) => boolean
  /** The document's own item lists, as the editors read them (the conditions name them by id). */
  lists: (doc: Obj) => GuardList[]
}

/** The blocks the guard condition editor draws (its `editor.block.*` palette; `policy` / `class` are request blocks). */
const GUARD_BLOCKS: ReadonlySet<string> = new Set(['history', 'supply', 'volume', 'line', 'sfda', 'formulary', 'patient', 'request', 'fact', 'eligibility', 'formula', 'group'])
const blocksDrawable = (conditions: unknown): boolean =>
  Array.isArray(conditions) &&
  conditions.every((c) => isObj(c) && typeof c.check === 'string' && GUARD_BLOCKS.has(c.check) && (c.check !== 'group' || blocksDrawable(c.conditions)))

const guardCodec: RuleCodec<GuardRule> = {
  in: guardRuleIn,
  out: guardRuleOut,
  blank: (ids) => {
    const id = nextGuardId(ids.map((x) => ({ id: x })))
    return { id, name: { en: '', ar: '' }, onUnknown: 'none', when: [], then: newGuardRule(id).then }
  },
  drawable: (r) => blocksDrawable(r.when) && r.then.every((e) => isObj(e) && e.effect === 'guard'),
  lists: (doc) => guardRulesetIn(doc).lists,
}

// ── coverage and category (680) ──────────────────────────────────────────────────────────────

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const optNum = (v: unknown) => v === undefined || isNum(v)

/** An effect `CoverageEffectEditor` draws faithfully: a known kind, its value of that kind's type. */
function coverageEffectDrawable(e: unknown): boolean {
  if (!isObj(e) || !(COVERAGE_EFFECTS as readonly unknown[]).includes(e.effect)) return false
  if (e.overridesPayer !== undefined && e.overridesPayer !== true) return false
  switch (e.effect) {
    case 'covered':
    case 'priorApproval':
    case 'exceptionPrescriptions':
      return typeof e.value === 'boolean'
    case 'priceCap':
    case 'quantityCap':
    case 'daysSupplyCap':
      return isNum(e.value)
    case 'deductible':
      return optNum(e.percent) && optNum(e.max)
    default:
      return (COVERAGE_SEGMENTS as readonly unknown[]).includes(e.value)
  }
}

/** A category or coverage rule's codec: `guard-wire`'s rule halves, the kind's own blank rule and effect check. */
function otherCodec<R extends CategoryRule | CoverageRule>(kind: InsuranceRuleKind, thenDrawable: (then: readonly unknown[]) => boolean): RuleCodec<R> {
  return {
    in: (raw) => otherRuleIn(raw) as R,
    out: (rule) => otherRuleOut(rule),
    blank: (ids) => {
      const { state: _state, ...rule } = newRule(nextRuleId(ids.map((id) => ({ id })), kind), kind)
      return rule as unknown as Obj
    },
    drawable: (r) => blocksDrawable(r.when) && thenDrawable(r.then),
    lists: (doc) => rulesetIn<{ lists?: GuardList[] }>(doc).lists ?? [],
  }
}

/** A category rule sets exactly one group (the editor draws one `setCategory`). */
const categoryCodec = otherCodec<CategoryRule>(
  'category',
  (then) => then.length === 1 && isObj(then[0]) && then[0].effect === 'setCategory' && (CATEGORY_GROUPS as readonly unknown[]).includes(then[0].group),
)
/** A coverage rule sets one value (the editor draws `then[0]`; a second effect it would not show). */
const coverageCodec = otherCodec<CoverageRule>('coverage', (then) => then.length <= 1 && then.every(coverageEffectDrawable))

/** The kinds whose rules the editors draw — every kind since 680. */
const CODECS: Partial<Record<PlaygroundKind, RuleCodec<unknown>>> = {
  guard: guardCodec as RuleCodec<unknown>,
  category: categoryCodec as RuleCodec<unknown>,
  coverage: coverageCodec as RuleCodec<unknown>,
}

/** The read document's own item lists, as the kind's editors read them; none for a kind without editors. */
export function rulesetLists(read: Extract<RulesetRead<unknown>, { ok: true }>): GuardList[] {
  return CODECS[read.kind]?.lists(read.doc) ?? []
}

export const hasEditors = (kind: PlaygroundKind): boolean => CODECS[kind] !== undefined

/** The fields every kind's rule shares: what an error path walks into. */
export interface EditorRule {
  id: string
  when: GuardCondition[]
  then: unknown[]
}

export type RuleSlot<R = GuardRule> =
  /** `read` is the codec's reading of `raw`; while `rule === read` the rule prints as `raw`. */
  | { key: string; editable: true; raw: unknown; read: R; rule: R }
  | { key: string; editable: false; raw: unknown }

export type RulesetRead<R = GuardRule> = { ok: true; kind: PlaygroundKind; doc: Obj; slots: RuleSlot<R>[] } | { ok: false }

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]))
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a)
    return ka.length === Object.keys(b).length && ka.every((k) => k in b && same(a[k], b[k]))
  }
  return false
}

let nextKey = 0
const freshKey = () => `r${++nextKey}`

/** `printed` without the keys `raw` did not have, when they hold only the reader's default (`blankOut`'s value). */
function withoutDefaults(printed: unknown, raw: unknown, blankOut: unknown): unknown {
  if (!isObj(printed)) return printed
  const out: Obj = { ...printed }
  const had = isObj(raw) ? raw : {}
  const blank = isObj(blankOut) ? blankOut : {}
  for (const k of Object.keys(out)) if (!(k in had) && same(out[k], blank[k])) delete out[k]
  return out
}

function slotOf<R>(codec: RuleCodec<R>, raw: unknown): RuleSlot<R> {
  const key = freshKey()
  if (!isObj(raw)) return { key, editable: false, raw }
  const read = codec.in(raw)
  if (!codec.drawable(read)) return { key, editable: false, raw }
  const back = withoutDefaults(codec.out(read), raw, codec.out(codec.in({})))
  return same(back, raw) ? { key, editable: true, raw, read, rule: read } : { key, editable: false, raw }
}

/** The Rule box's text → the document and its rules, each editable or JSON-only; not ok when it is no JSON object. */
export function readRuleset<R = GuardRule>(kind: PlaygroundKind, text: string): RulesetRead<R> {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  if (!isObj(doc)) return { ok: false }
  if (doc.rules !== undefined && !Array.isArray(doc.rules)) return { ok: false }
  const codec = CODECS[kind] as RuleCodec<R> | undefined
  const rules = (doc.rules ?? []) as unknown[]
  const slots = rules.map((raw): RuleSlot<R> => (codec ? slotOf(codec, raw) : { key: freshKey(), editable: false, raw }))
  return { ok: true, kind, doc, slots }
}

/** The ruleset → the Rule box's text (two-space JSON). */
export function printRuleset<R>(read: Extract<RulesetRead<R>, { ok: true }>): string {
  const codec = CODECS[read.kind] as RuleCodec<R> | undefined
  const rules = read.slots.map((s) => {
    if (!s.editable || !codec || s.rule === s.read) return s.raw
    return withoutDefaults(codec.out(s.rule), s.raw, codec.out(codec.in({})))
  })
  return JSON.stringify({ ...read.doc, rules }, null, 2)
}

// ── order edits ─────────────────────────────────────────────────────────────────────────────

export function moveSlot<S>(slots: readonly S[], from: number, to: number): S[] {
  if (from === to || from < 0 || to < 0 || from >= slots.length || to >= slots.length) return [...slots]
  const out = [...slots]
  const [s] = out.splice(from, 1)
  out.splice(to, 0, s)
  return out
}

export const removeSlot = <S>(slots: readonly S[], at: number): S[] => slots.filter((_, i) => i !== at)

const idOf = (s: RuleSlot<unknown>): string => {
  const r = s.editable ? (s.rule as { id?: unknown }) : s.raw
  return isObj(r) && typeof r.id === 'string' ? r.id : ''
}

/** A blank rule of the ruleset's kind appended; nothing when the kind has no editors. */
export function addSlot<R>(kind: PlaygroundKind, slots: readonly RuleSlot<R>[]): RuleSlot<R>[] {
  const codec = CODECS[kind] as RuleCodec<R> | undefined
  if (!codec) return [...slots]
  const raw = codec.blank(slots.map((s) => idOf(s as RuleSlot<unknown>)))
  const read = codec.in(raw)
  return [...slots, { key: freshKey(), editable: true, raw, read, rule: read }]
}

// ── reader errors → blocks ──────────────────────────────────────────────────────────────────

export interface BlockAt {
  /** The rule's index in the document. */
  rule: number
  /** null: the rule itself (`rules[0]`, `rules[0].name.en`). */
  section: 'when' | 'then' | null
  /** `when`: the condition path down through groups; `then`: `[effect index]`; `[]` for the rule. */
  path: number[]
  /** The rest of the path, in the engine's spelling (`expr`, `says.en`); null when none. */
  field: string | null
}

/**
 * A reader error's path (`rules[0].when[1].expr`, `rules[0].when[0].conditions[2].inList`, `rules[1].then[0].says.en`)
 * → the block it names on screen; null when that block is not shown (no such rule, block or effect, a JSON-only rule,
 * or a path outside `rules`).
 */
export function errorAtBlock(path: string, slots: readonly RuleSlot<unknown>[]): BlockAt | null {
  const m = /^rules\[(\d+)\](?:\.(.*))?$/.exec(path ?? '')
  if (!m) return null
  const rule = Number(m[1])
  const slot = slots[rule]
  if (!slot || !slot.editable) return null
  const r = slot.rule as EditorRule
  const parts = m[2] ? m[2].split('.') : []
  const head = parts.length ? /^(when|then)\[(\d+)\]$/.exec(parts[0]) : null
  if (!head) return { rule, section: null, path: [], field: parts.length ? parts.join('.') : null }
  const section = head[1] as 'when' | 'then'
  const at = [Number(head[2])]
  let i = 1
  if (section === 'when')
    for (; i < parts.length; i++) {
      const c = /^conditions\[(\d+)\]$/.exec(parts[i])
      if (!c) break
      at.push(Number(c[1]))
    }
  const exists = section === 'when' ? conditionAt(r.when ?? [], at) !== undefined : (r.then ?? [])[at[0]] !== undefined
  if (!exists) return null
  const rest = parts.slice(i)
  return { rule, section, path: at, field: rest.length ? rest.join('.') : null }
}

/** An engine field → the editors' name for it on that block (the editor draws `below`, `formula`, a fact's `value`). */
function editorField(field: string | null, block: GuardCondition | undefined): string | null {
  if (!field) return null
  const [first, ...rest] = field.split('.')
  const name = first.replace(/\[\d+\]$/, '')
  let mapped = name
  if (name === 'expr') mapped = 'formula'
  else if (block?.check === 'fact' && (name === 'atLeast' || name === 'under' || name === 'anyOf')) mapped = 'value'
  else if (block?.check === 'fact' && name === 'field') mapped = 'path'
  else if (name === 'under') mapped = 'below'
  return [mapped, ...rest].join('.')
}

/**
 * The reader's errors placed on the rules on screen: per rule (by index) its issues in the editors' shape — the same
 * `GuardIssue` the guard editor's Validate marks with `indexChecks` / `fieldIssues` — and the errors no shown block
 * holds, which stay in the outcome's error list.
 */
export function rulesetIssues(
  errors: readonly PlaygroundReaderError[],
  slots: readonly RuleSlot<unknown>[],
): { perRule: GuardIssue[][]; rest: PlaygroundReaderError[] } {
  const perRule: GuardIssue[][] = slots.map(() => [])
  const rest: PlaygroundReaderError[] = []
  for (const e of errors) {
    const at = errorAtBlock(e.path, slots)
    if (!at) {
      rest.push(e)
      continue
    }
    const slot = slots[at.rule] as Extract<RuleSlot<unknown>, { editable: true }>
    const r = slot.rule as EditorRule
    const block = at.section === 'when' ? conditionAt(r.when ?? [], at.path) : undefined
    const blockPath = at.section === null ? null : `${at.section}[${at.path[0]}]${at.path.slice(1).map((n) => `.conditions[${n}]`).join('')}`
    perRule[at.rule].push({ ruleId: r.id, blockPath, field: editorField(at.field, block), severity: 'error', en: e.message, ar: e.message })
  }
  return { perRule, rest }
}
