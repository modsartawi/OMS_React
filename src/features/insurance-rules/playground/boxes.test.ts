/**
 * Ticket 677 — the two JSON boxes → the Evaluate body. JSON that does not parse is named (which box) and nothing is
 * sent; the seeded guard experiment is a valid body whose one line matches its one rule.
 */
import { describe, expect, it } from 'vitest'
import { PLAYGROUND_KINDS } from '@/core/insurance-rules/playground'
import { dataForKind, evaluateBody, kindSeed, SEED_COVERAGE_PAYER, SEED_DATA_TEXT, SEED_DOCUMENT_TEXT } from './boxes'

const AS_OF = '2026-10-30T14:05:00'

describe('evaluateBody', () => {
  it('the seeded boxes make the brief body: kind guard, data, document, asOf', () => {
    const r = evaluateBody({ dataText: SEED_DATA_TEXT, documentText: SEED_DOCUMENT_TEXT, asOf: AS_OF })
    expect(r.problems).toEqual([])
    expect(r.body?.kind).toBe('guard')
    expect(r.body?.asOf).toBe(AS_OF)
    expect(Object.keys(r.body ?? {})).toEqual(['kind', 'data', 'document', 'asOf'])
    const doc = r.body?.document as { schema: number; kind: string; revision: number; fields: unknown[]; lists: unknown[]; rules: unknown[] }
    expect([doc.schema, doc.kind, doc.revision, doc.fields, doc.lists, doc.rules.length]).toEqual([1, 'guard', 0, [], [], 1])
    expect((r.body?.data as { lines: unknown[] }).lines).toHaveLength(1)
  })

  it('a box that does not parse is named and nothing is built', () => {
    expect(evaluateBody({ dataText: '{ "lines": [', documentText: SEED_DOCUMENT_TEXT, asOf: AS_OF })).toEqual({ body: null, problems: ['data'] })
    expect(evaluateBody({ dataText: SEED_DATA_TEXT, documentText: '', asOf: AS_OF })).toEqual({ body: null, problems: ['document'] })
    expect(evaluateBody({ dataText: 'nope', documentText: '{', asOf: AS_OF })).toEqual({ body: null, problems: ['data', 'document'] })
  })

  it('valid JSON that is not an object is refused too (the door takes objects)', () => {
    expect(evaluateBody({ dataText: '[1]', documentText: '42', asOf: AS_OF })).toEqual({ body: null, problems: ['data', 'document'] })
  })
})

describe('the kind seeds (678)', () => {
  it("each kind's seed is a document of that kind and example data; only coverage's data carries the payer", () => {
    for (const kind of PLAYGROUND_KINDS) {
      const seed = kindSeed(kind)
      const r = evaluateBody({ ...seed, asOf: AS_OF, kind })
      expect(r.problems).toEqual([])
      expect(r.body?.kind).toBe(kind)
      expect((r.body?.document as { kind: string }).kind).toBe(kind)
      expect('payer' in (r.body?.data as object)).toBe(kind === 'coverage')
    }
  })

  it("the guard seed is 677's", () => {
    expect(kindSeed('guard')).toEqual({ dataText: SEED_DATA_TEXT, documentText: SEED_DOCUMENT_TEXT })
  })
})

/** Ticket 684 — exactly one of `data` | `raw`: the Raw tab sends its text as it is, the JSON tab sends `data`. */
describe('evaluateBody — the Data tab picks data or raw', () => {
  it('the Raw tab sends raw and no data, even when the text is not JSON', () => {
    const r = evaluateBody({ dataTab: 'raw', rawText: '{"lines":[{"qty":2}', dataText: SEED_DATA_TEXT, documentText: SEED_DOCUMENT_TEXT, asOf: AS_OF })
    expect(r.problems).toEqual([])
    expect(Object.keys(r.body ?? {})).toEqual(['kind', 'raw', 'document', 'asOf'])
    expect(r.body?.raw).toBe('{"lines":[{"qty":2}')
    expect('data' in (r.body ?? {})).toBe(false)
  })

  it('the Raw tab does not read the data box: a broken data box is not a problem there', () => {
    const r = evaluateBody({ dataTab: 'raw', rawText: 'not json', dataText: '{ "lines": [', documentText: SEED_DOCUMENT_TEXT, asOf: AS_OF })
    expect(r.problems).toEqual([])
    expect(r.body?.raw).toBe('not json')
  })

  it('the rule box is still checked on the Raw tab', () => {
    expect(evaluateBody({ dataTab: 'raw', rawText: '{}', dataText: SEED_DATA_TEXT, documentText: '{', asOf: AS_OF })).toEqual({ body: null, problems: ['document'] })
  })

  it('the JSON tab sends data and no raw, whatever the Raw tab holds', () => {
    const r = evaluateBody({ dataTab: 'json', rawText: '{"lines":[{"qty":2}]}', dataText: SEED_DATA_TEXT, documentText: SEED_DOCUMENT_TEXT, asOf: AS_OF })
    expect(Object.keys(r.body ?? {})).toEqual(['kind', 'data', 'document', 'asOf'])
    expect('raw' in (r.body ?? {})).toBe(false)
  })
})

/** Ticket 682 — the Form tab edits the same dataset as the JSON tab, so it sends `data` too. */
describe('evaluateBody — the Form tab', () => {
  it('sends data and no raw', () => {
    const r = evaluateBody({ dataTab: 'form', rawText: 'x', dataText: SEED_DATA_TEXT, documentText: SEED_DOCUMENT_TEXT, asOf: AS_OF })
    expect(Object.keys(r.body ?? {})).toEqual(['kind', 'data', 'document', 'asOf'])
  })
})

describe('dataForKind', () => {
  it("the previous kind's unedited seed becomes the new kind's seed", () => {
    expect(dataForKind('guard', 'coverage', kindSeed('guard').dataText)).toBe(kindSeed('coverage').dataText)
    expect(dataForKind('coverage', 'category', kindSeed('coverage').dataText)).toBe(kindSeed('category').dataText)
  })

  it('edited data is kept; switching to coverage adds the seed payer it needs', () => {
    const edited = { request: { payer: 'X' }, lines: [{ line: 1, item: '999' }] }
    const out = JSON.parse(dataForKind('guard', 'coverage', JSON.stringify(edited)))
    expect(out).toEqual({ ...edited, payer: SEED_COVERAGE_PAYER })
  })

  it('edited coverage data keeps its own payer into coverage, and its edited payer out of it', () => {
    const own = { lines: [{ line: 1 }], payer: { deductibles: { G1: { percent: 5, max: 1 } } } }
    expect(JSON.parse(dataForKind('category', 'coverage', JSON.stringify(own)))).toEqual(own)
    expect(JSON.parse(dataForKind('coverage', 'guard', JSON.stringify(own)))).toEqual(own)
  })

  it("leaving coverage drops the payer only while it is still the seed's", () => {
    const edited = { lines: [{ line: 1, item: '999' }], payer: SEED_COVERAGE_PAYER }
    expect(JSON.parse(dataForKind('coverage', 'guard', JSON.stringify(edited)))).toEqual({ lines: [{ line: 1, item: '999' }] })
  })

  it('data that does not parse, or a kind that needs nothing more, is left exactly as typed', () => {
    expect(dataForKind('guard', 'coverage', '{ "lines": [')).toBe('{ "lines": [')
    const text = '{"lines":[{"line":1,"item":"999"}]}'
    expect(dataForKind('guard', 'category', text)).toBe(text)
  })
})
