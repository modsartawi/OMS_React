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
