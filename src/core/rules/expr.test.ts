/**
 * Ticket 522 — the ƒx helper keeps a text box; the stored value is the rule language's
 * operator-first JSON (ADR 0089). The codec prints the JSON as text and reads the text back, and the
 * round trip is exact on every expression of BackOffice's five 2702 campaigns
 * (Tests/Data.Tests/Rules/Fixtures/five-2702.json) and the brief's example.
 */
import { describe, expect, it } from 'vitest'
import type { RuleExpr } from '@/core/models/rule-campaign'
import { parseExpr, printExpr, type ExprContext } from './expr'

const ctx: ExprContext = {
  filters: [
    { id: 'f-eligible', name: 'Eligible' },
    { id: 'f-earning', name: 'Earning categories' },
  ],
}

const read = (text: string) => {
  const r = parseExpr(text, ctx)
  if (!r.ok) throw new Error(`${text}: ${JSON.stringify(r.problem)}`)
  return r.expr
}

/** Every expression the five 2702 campaigns store (values and formula conditions), and the brief's. */
const STORED: [RuleExpr, string][] = [
  [['sum', ['items', 'f-eligible'], '$item.net'], "sum(items('Eligible'), item.net)"],
  [['round', ['*', '$eligible', 0.1], 0, 'halfUp'], 'round(eligible * 0.1, 0, halfUp)'],
  [['>', '$back', 0], 'back > 0'],
  [['sum', ['items', 'f-earning'], '$item.net'], "sum(items('Earning categories'), item.net)"],
  [['band', '$basis', [[200, 0.1], [400, 0.12], [700, 0.15]]], 'band(basis, 200:0.1, 400:0.12, 700:0.15)'],
  [['min', ['round', ['*', '$basis', '$rate'], 0, 'halfUp'], 105], 'min(round(basis * rate, 0, halfUp), 105)'],
  [['>=', '$session.subtotal', 50], 'session.subtotal >= 50'],
  [['*', '$session.subtotal', 0.1], 'session.subtotal * 0.1'],
  ['$back', 'back'],
  [30, '30'],
]

describe('exprCodec_roundTrips', () => {
  it.each(STORED)('prints %j as text, and reads the text back to the same JSON', (expr, text) => {
    expect(printExpr(expr, ctx)).toBe(text)
    expect(read(text)).toEqual(expr)
  })

  it('reads text into the canonical text again (spaces, parentheses and case of a filter name)', () => {
    const canon = (t: string) => printExpr(read(t), ctx)
    expect(canon('  round( eligible*0.10 ,0,halfUp ) ')).toBe('round(eligible * 0.1, 0, halfUp)')
    expect(canon("sum(items('eligible'), item.net)")).toBe("sum(items('Eligible'), item.net)")
    expect(canon('(a + b) * c')).toBe('(a + b) * c')
    expect(canon('a + (b * c)')).toBe('a + b * c')
    expect(canon('a - (b - c)')).toBe('a - (b - c)')
    expect(canon('(a - b) - c')).toBe('a - b - c')
    expect(canon("profile.tier == 'G' or profile.tier == 'P'")).toBe("profile.tier == 'G' or profile.tier == 'P'")
    expect(canon('not (a and b)')).toBe('not (a and b)')
    expect(canon('-x * 2')).toBe('-x * 2')
  })

  it('reads the language’s own words: negatives, texts, booleans, prefix not, any call', () => {
    expect(read('-3')).toBe(-3)
    expect(read('a - 3')).toEqual(['-', '$a', 3])
    expect(read('-(a + 1)')).toEqual(['-', 0, ['+', '$a', 1]])
    expect(read("'G'")).toBe('G')
    expect(read('true and not false')).toEqual(['and', true, ['not', false]])
    expect(read("if(profile.tier == 'P', 0.15, 0.10)")).toEqual(['if', ['==', '$profile.tier', 'P'], 0.15, 0.1])
    expect(read("in(profile.tier, list('G', 'P'))")).toEqual(['in', '$profile.tier', ['list', 'G', 'P']])
    expect(read("items('f-eligible')")).toEqual(['items', 'f-eligible'])
  })

  it('a filter renamed since prints under its new name; one that is gone prints its id', () => {
    expect(printExpr(['count', ['items', 'f-eligible']], { filters: [{ id: 'f-eligible', name: 'Basket' }] })).toBe("count(items('Basket'))")
    expect(printExpr(['count', ['items', 'f-gone']], ctx)).toBe("count(items('f-gone'))")
  })

  it('cannot print what text would not give back: the screen shows the JSON instead', () => {
    expect(printExpr({ a: 1 } as unknown as RuleExpr, ctx)).toBeNull()
    expect(printExpr([], ctx)).toBeNull()
    expect(printExpr([1, 2], ctx)).toBeNull()
    expect(printExpr(['min', [1, 2]], ctx)).toBeNull()
    expect(printExpr("it's", ctx)).toBeNull()
    expect(printExpr('$not a path', ctx)).toBeNull()
    expect(printExpr(null, ctx)).toBeNull()
    // A number JavaScript writes with an exponent (1e-7, 1e+21) is not one the language reads.
    expect(printExpr(['*', '$session.total', 0.0000001], ctx)).toBeNull()
    expect(printExpr(1e21, ctx)).toBeNull()
  })

  it('says what is wrong and where', () => {
    const problem = (t: string) => {
      const r = parseExpr(t, ctx)
      return r.ok ? null : r.problem
    }
    expect(problem('  ')).toEqual({ code: 'empty', at: 0 })
    expect(problem('a +')).toEqual({ code: 'unclosed', at: 3 })
    expect(problem('min(a, 2')).toEqual({ code: 'unclosed', at: 3, token: '(' })
    expect(problem('a # b')).toEqual({ code: 'unexpected', at: 2, token: '#' })
    expect(problem('a b')).toEqual({ code: 'unexpected', at: 2, token: 'b' })
    expect(problem("'open")).toEqual({ code: 'unclosed', at: 0, token: "'" })
    expect(problem("sum(items('Nope'))")).toEqual({ code: 'unknownFilter', at: 10, token: 'Nope' })
    expect(problem('round(a, 2)')).toEqual({ code: 'roundArgs', at: 0 })
    expect(problem('band(a)')).toEqual({ code: 'bandArgs', at: 0 })
    expect(problem('min(a, 2:3)')).toEqual({ code: 'pairOutsideBand', at: 7 })
  })
})

describe('a bracketed key in a path (oms 657: the guard formula reads eligibility keys)', () => {
  const none = { filters: [] }
  it('reads and prints a path segment with one key', () => {
    for (const [text, path] of [
      ['eligibility.benefit[GEN].copayPct', '$eligibility.benefit[GEN].copayPct'],
      ['eligibility.benefit[GEN/01].copayMax', '$eligibility.benefit[GEN/01].copayMax'],
      ['eligibility.tob[PHARM-1]', '$eligibility.tob[PHARM-1]'],
    ]) {
      expect(parseExpr(text, none)).toEqual({ ok: true, expr: path })
      expect(printExpr(path, none)).toBe(text)
    }
    const expr = ['>', '$eligibility.benefit[GEN].copayPct', 20]
    expect(parseExpr('eligibility.benefit[GEN].copayPct > 20', none)).toEqual({ ok: true, expr })
    expect(printExpr(expr, none)).toBe('eligibility.benefit[GEN].copayPct > 20')
  })

  it('a placeholder, an empty key or a key glued to a name does not read', () => {
    expect(parseExpr('eligibility.benefit[<code>].copayPct', none)).toEqual({ ok: false, problem: { code: 'unexpected', at: 19, token: '[' } })
    expect(parseExpr('eligibility.tob[]', none).ok).toBe(false)
    expect(parseExpr('eligibility.tob[A]x', none).ok).toBe(false)
    expect(parseExpr('tob[A](1)', none).ok).toBe(false)
    // and a stored path the text could not give back stays JSON
    expect(printExpr('$eligibility.tob[a b]', none)).toBeNull()
  })
})

describe('registry fields and the request’s lines (oms 681, ADR 0117)', () => {
  const none = { filters: [] }
  it('`<scope>.field.Key` reads and prints round-trip for line, request and patient', () => {
    for (const [text, path] of [
      ['line.field.HouseBrand', '$line.field.HouseBrand'],
      ['request.field.X', '$request.field.X'],
      ['patient.field.Y', '$patient.field.Y'],
      ['line.field.eCode', '$line.field.eCode'],
    ]) {
      expect(parseExpr(text, none)).toEqual({ ok: true, expr: path })
      expect(printExpr(path, none)).toBe(text)
    }
    const expr = ['==', '$line.field.HouseBrand', 'Y']
    expect(parseExpr("line.field.HouseBrand == 'Y'", none)).toEqual({ ok: true, expr })
    expect(printExpr(expr, none)).toBe("line.field.HouseBrand == 'Y'")
  })

  it('`field` is reserved: a path holding it must be exactly <line|request|patient>.field.<one key>', () => {
    const problem = (t: string) => {
      const r = parseExpr(t, none)
      return r.ok ? null : r.problem
    }
    expect(problem('line.field')).toEqual({ code: 'badField', at: 0, token: 'line.field' })
    expect(problem('line.field.A.B')).toEqual({ code: 'badField', at: 0, token: 'line.field.A.B' })
    expect(problem('eligibility.field.X')).toEqual({ code: 'badField', at: 0, token: 'eligibility.field.X' })
    expect(problem('patient.age > 1 and field')).toEqual({ code: 'badField', at: 20, token: 'field' })
    expect(problem('line.field.field')?.code).toBe('badField')
    expect(problem('line.field[A]')?.code).toBe('badField')
    expect(problem('line.field.A[b]')?.code).toBe('badField')
    expect(problem('x.line.field.A')?.code).toBe('badField')
    // and a stored path the text would refuse stays JSON
    expect(printExpr('$line.field', none)).toBeNull()
    expect(printExpr('$eligibility.field.X', none)).toBeNull()
    expect(printExpr(['>', '$line.field.A.B', 1], none)).toBeNull()
    // a segment merely starting with "field" is not the reserved one
    expect(parseExpr('line.fieldCount', none)).toEqual({ ok: true, expr: '$line.fieldCount' })
  })

  it('`request.lines` reads and prints round-trip inside filter, sum, count and lines', () => {
    const cases: [string, RuleExpr][] = [
      ['request.lines', '$request.lines'],
      ['lines(request.lines)', ['lines', '$request.lines']],
      ["filter(request.lines, line.item == '200021')", ['filter', '$request.lines', ['==', '$line.item', '200021']]],
      ['filter(request.lines, line.quantity > 1)', ['filter', '$request.lines', ['>', '$line.quantity', 1]]],
      ['sum(filter(request.lines, line.quantity > 1), line.price)', ['sum', ['filter', '$request.lines', ['>', '$line.quantity', 1]], '$line.price']],
      ["count(filter(request.lines, line.item == '200021')) > 0", ['>', ['count', ['filter', '$request.lines', ['==', '$line.item', '200021']]], 0]],
      ["lines(filter(request.lines, line.field.HouseBrand == 'Y')) >= 2", ['>=', ['lines', ['filter', '$request.lines', ['==', '$line.field.HouseBrand', 'Y']]], 2]],
    ]
    for (const [text, expr] of cases) {
      expect(parseExpr(text, none)).toEqual({ ok: true, expr })
      expect(printExpr(expr, none)).toBe(text)
    }
  })
})
