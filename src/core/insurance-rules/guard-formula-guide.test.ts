/**
 * oms 657 — the guard formula's ƒx guide. Its Fields are the `$`-paths SIS.Rules lets a guard formula read —
 * pinned here against `SIS.Rules/Language/RulesetReader.Guards.cs` (`FactPaths` + `EligibilityPathType`, whose
 * eligibility keys are `SIS.Rules/Language/GuardEligibility.cs`'s `GuardEligibilityKeys`, dates left out) —
 * every recipe and example is text `@/core/rules/expr` reads into a TRUE/FALSE expression over those paths,
 * and every word the helper builds is in both bundles.
 */
import { describe, expect, it } from 'vitest'
import type { RuleExpr } from '@/core/models/rule-campaign'
import { parseExpr } from '@/core/rules/expr'
import type { RuleFormulaType } from '@/core/rules/formula-guide'
import { insertAtCursor } from '@/core/rules/fx-helper/insert'
import en from '@/locales/en/insurance-guards.json'
import ar from '@/locales/ar/insurance-guards.json'
import { CODE_PLACEHOLDER, GUARD_FX_FIELDS, GUARD_FX_FUNCTIONS, GUARD_FX_GROUPS, GUARD_FX_OPERATORS, GUARD_FX_RECIPES, guardFieldChip } from './guard-formula-guide'

const read = (text: string) => parseExpr(text, { filters: [] })

/** A path's type, as the engine would give it: a fixed path, or a parameterised eligibility key with any code. */
function pathType(path: string): RuleFormulaType | null {
  const fixed = GUARD_FX_FIELDS.find((f) => !f.placeholder && f.path === path)
  if (fixed) return fixed.type
  const keyed = GUARD_FX_FIELDS.find((f) => f.placeholder && new RegExp(`^${f.path.split(f.placeholder).map((s) => s.replace(/[.[\]]/g, '\\$&')).join('[^\\[\\]\\s]+')}$`).test(path))
  return keyed?.type ?? null
}

type T = 'number' | 'text' | 'bool' | 'list'
/** The expression's type, the way `ExpressionReader` types a guard formula (money is a number); throws when it would refuse it. */
function typeOf(e: RuleExpr): T {
  if (typeof e === 'number') return 'number'
  if (typeof e === 'boolean') return 'bool'
  if (typeof e === 'string') {
    if (!e.startsWith('$')) return 'text'
    const t = pathType(e.slice(1))
    if (!t) throw new Error(`unknown path ${e}`)
    return t === 'money' ? 'number' : (t as T)
  }
  if (!Array.isArray(e)) throw new Error('not an expression')
  const [op, ...args] = e as [string, ...RuleExpr[]]
  const num = (...xs: RuleExpr[]) => xs.forEach((x) => expect(typeOf(x), JSON.stringify(x)).toBe('number'))
  switch (op) {
    case '+':
    case '-':
    case '*':
    case '/':
    case 'min':
    case 'max':
    case 'floor':
    case 'ceil':
    case 'abs':
      num(...args)
      return 'number'
    case 'round':
      num(args[0], args[1])
      return 'number'
    case 'band':
      num(args[0])
      return 'number'
    case '>':
    case '>=':
    case '<':
    case '<=':
      num(...args)
      return 'bool'
    case '==':
    case '!=':
      expect(typeOf(args[0])).toBe(typeOf(args[1]))
      return 'bool'
    case 'and':
    case 'or':
    case 'not':
      args.forEach((a) => expect(typeOf(a)).toBe('bool'))
      return 'bool'
    case 'if':
      expect(typeOf(args[0])).toBe('bool')
      expect(typeOf(args[1])).toBe(typeOf(args[2]))
      return typeOf(args[1])
    case 'list':
      return 'list'
    case 'in':
      expect(typeOf(args[1])).toBe('list')
      return 'bool'
    default:
      throw new Error(`a guard formula cannot use ${op}`)
  }
}

describe('the guard formula guide', () => {
  it('guardFields_areTheEnginesFormulaPaths', () => {
    // Mirrors SIS.Rules/Language/RulesetReader.Guards.cs FactPaths, in its order, with its types (price: SAR).
    const facts = GUARD_FX_FIELDS.filter((f) => f.group !== 'eligibility').map((f) => `${f.path}:${f.type}`)
    expect(facts).toEqual([
      'patient.age:number',
      'patient.gender:text',
      'patient.idType:text',
      'request.payer:text',
      'request.policy:text',
      'request.class:text',
      'request.channel:text',
      'request.store:text',
      'request.pharmacist:text',
      'line.item:text',
      'line.eCode:text',
      'line.dCode:text',
      'line.daysSupply:number',
      'line.quantity:number',
      'line.price:money',
      'line.idfPriority:number',
    ])
    // Mirrors SIS.Rules/Language/GuardEligibility.cs GuardEligibilityKeys: the fixed keys that are a text or a flag,
    // then benefit[<code>].<field> and tob[<code>]; a date key is read by a block's date tests, never in a formula.
    const eligibility = GUARD_FX_FIELDS.filter((f) => f.group === 'eligibility').map((f) => `${f.path}:${f.type}`)
    expect(eligibility).toEqual([
      'eligibility.response.payer:text',
      'eligibility.response.outcome:text',
      'eligibility.response.inForce:bool',
      'eligibility.response.eligible:bool',
      'eligibility.response.siteEligibility:text',
      'eligibility.response.transfer:bool',
      'eligibility.response.newborn:bool',
      'eligibility.response.gender:text',
      'eligibility.response.idType:text',
      'eligibility.coverage.subscriberId:text',
      'eligibility.coverage.memberId:text',
      'eligibility.coverage.inForce:bool',
      'eligibility.coverage.network:text',
      'eligibility.coverage.plan:text',
      'eligibility.coverage.class:text',
      'eligibility.coverage.group:text',
      'eligibility.coverage.holder:text',
      'eligibility.benefit[<code>].name:text',
      'eligibility.benefit[<code>].term:text',
      'eligibility.benefit[<code>].unit:text',
      'eligibility.benefit[<code>].benefit:number',
      'eligibility.benefit[<code>].approvalLimit:number',
      'eligibility.benefit[<code>].copayPct:number',
      'eligibility.benefit[<code>].copayMax:number',
      'eligibility.tob[<code>]:number',
    ])
    for (const dateOnly of ['line.icd', 'line.supplyEndsOn', 'eligibility.coverage.periodEnd', 'eligibility.coverage.periodStart', 'eligibility.response.birthDate'])
      expect(GUARD_FX_FIELDS.some((f) => f.path === dateOnly), dateOnly).toBe(false)
    expect(new Set(GUARD_FX_FIELDS.map((f) => f.group))).toEqual(new Set(GUARD_FX_GROUPS))
  })

  it('every field reads as its own $-path — a keyed one once its code is typed over the placeholder', () => {
    for (const f of GUARD_FX_FIELDS) {
      const chip = guardFieldChip(f)
      const put = insertAtCursor('', null, chip)
      if (f.placeholder) {
        expect(put.formula.slice(put.caret, put.end), f.path).toBe(CODE_PLACEHOLDER)
        // Untouched, the placeholder never reads: nothing half-written is stored.
        expect(read(put.formula).ok, f.path).toBe(false)
        const typed = put.formula.slice(0, put.caret) + 'GEN/01' + put.formula.slice(put.end)
        expect(read(typed), f.path).toEqual({ ok: true, expr: `$${typed}` })
      } else {
        expect(chip).toEqual({ text: f.path })
        expect(read(put.formula)).toEqual({ ok: true, expr: `$${f.path}` })
      }
    }
  })

  it('guardRecipes_readThroughTheCodecAndAreTrueFalse', () => {
    expect(GUARD_FX_RECIPES.length).toBeGreaterThanOrEqual(5)
    for (const r of GUARD_FX_RECIPES) {
      const got = read(r.formula)
      expect(got.ok, r.key).toBe(true)
      if (got.ok) expect(typeOf(got.expr), r.key).toBe('bool')
    }
    expect(read(GUARD_FX_RECIPES.find((r) => r.key === 'childQuantity')!.formula)).toEqual({
      ok: true,
      expr: ['and', ['<', '$patient.age', 12], ['>', '$line.quantity', 2]],
    })
  })

  it('every function example is a true/false guard formula, and no function needs an item filter', () => {
    for (const f of GUARD_FX_FUNCTIONS) {
      const got = read(f.example)
      expect(got.ok, f.name).toBe(true)
      if (got.ok) expect(typeOf(got.expr), f.name).toBe('bool')
    }
    expect(GUARD_FX_FUNCTIONS.map((f) => f.name).filter((n) => ['items', 'sum', 'count', 'filter'].includes(n))).toEqual([])
    expect(GUARD_FX_OPERATORS).toContain('and')
  })

  it.each([
    ['en', en],
    ['ar', ar],
  ] as const)('%s: the words the helper builds exist', (_l, locale) => {
    const at = (key: string): unknown => key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)
    const keys = [
      ...GUARD_FX_FIELDS.flatMap((f) => [`fx.field.${f.words}.label`, `fx.field.${f.words}.desc`]),
      ...GUARD_FX_FIELDS.map((f) => `fx.type.${f.type}`),
      ...GUARD_FX_GROUPS.map((g) => `fx.group.${g}`),
      ...GUARD_FX_FUNCTIONS.map((f) => `fx.function.${f.name}`),
      ...GUARD_FX_RECIPES.flatMap((r) => [`fx.recipe.${r.key}.title`, `fx.recipe.${r.key}.desc`]),
      ...['fields', 'functions', 'recipes'].map((k) => `fx.tab.${k}`),
      ...['empty', 'unexpected', 'unclosed', 'unknownFilter', 'roundArgs', 'bandArgs', 'pairOutsideBand'].map((k) => `fx.problem.${k}`),
      ...['toggle', 'symbol', 'tabs', 'done', 'placeholder', 'empty', 'reads', 'operators', 'insertOperator', 'insertText', 'textChip', 'hint', 'search', 'noMatch', 'insert', 'use', 'example'].map((k) => `fx.${k}`),
    ]
    for (const k of keys) expect(typeof at(k), k).toBe('string')
  })
})
