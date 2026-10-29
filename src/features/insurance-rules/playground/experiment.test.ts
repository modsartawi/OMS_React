/**
 * Ticket 677 — the two JSON boxes → the Evaluate body. JSON that does not parse is named (which box) and nothing is
 * sent; the seeded guard experiment is a valid body whose one line matches its one rule.
 */
import { describe, expect, it } from 'vitest'
import { evaluateBody, SEED_DATA_TEXT, SEED_DOCUMENT_TEXT } from './experiment'

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
