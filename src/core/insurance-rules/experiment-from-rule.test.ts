/**
 * Ticket 688 — "Open in playground": a real guard, category or coverage rule becomes a NEW experiment of its kind — a
 * one-rule document carrying exactly the lists the rule names (and the lists those lists pull in) and the fields it
 * reads, with example data and the "as of" given. A copy: the source rule and document are never mutated.
 */
import { describe, expect, it } from 'vitest'
import { experimentFromRule, readExperiment, experimentFile } from './experiment'

const AS_OF = '2026-10-30T14:05:00'

const list = (id: string, over: Record<string, unknown> = {}) => ({ id, name: { en: id, ar: id }, filters: [{ articles: ['100234'], categories: [], attributes: [] }], include: [], exclude: [], ...over })

const GUARD_DOC = {
  schema: 1,
  kind: 'guard',
  revision: 12,
  fields: [
    { key: 'HouseBrand', type: 'text' },
    { key: 'Unused', type: 'number' },
  ],
  lists: [list('glp1', { include: ['pens'] }), list('controlled'), list('pens'), list('chronic')],
  rules: [],
}

const GUARD_RULE = {
  id: 'G-007',
  name: { en: 'GLP-1 without a diabetes diagnosis', ar: 'GLP-1 بدون تشخيص سكري' },
  folder: 'Specialty medicines/GLP-1',
  state: 'live',
  onUnknown: 'warn',
  when: [
    {
      check: 'group',
      mode: 'all',
      conditions: [
        { check: 'line', inList: 'glp1' },
        { check: 'history', match: 'list:controlled', windowDays: 28, measure: 'quantity', atLeast: 5, includeThisLine: true },
        { check: 'formula', expr: ['=', '$line.field.HouseBrand', 'Y'] },
      ],
    },
  ],
  then: [{ effect: 'guard', severity: 'OVERRIDE', says: { en: 'GLP-1', ar: 'GLP-1' } }],
}

const CATEGORY_RULE = {
  id: 'K-002',
  name: { en: 'Statins are Generic', ar: 'الستاتين جنيسة' },
  state: 'live',
  when: [{ check: 'request', field: 'payer', anyOf: ['0001100052'] }],
  then: [{ effect: 'setCategory', group: 'G1' }],
}

const COVERAGE_DOC = { schema: 1, kind: 'coverage', revision: 7, lists: [list('cosmetics'), list('chronic')], rules: [] }
const COVERAGE_RULE = {
  id: 'C-002',
  name: { en: 'Bupa: cosmetics not covered', ar: 'بوبا: مستحضرات التجميل غير مغطاة' },
  state: 'live',
  when: [{ check: 'line', inList: 'cosmetics' }],
  then: [{ effect: 'covered', value: false, overridesPayer: true }],
}

describe('experimentFromRule', () => {
  it('a guard rule becomes a one-rule guard document with the lists it names (and what they include) and the fields it reads', () => {
    const e = experimentFromRule({ kind: 'guard', rule: GUARD_RULE, document: GUARD_DOC }, AS_OF)
    expect(e.kind).toBe('guard')
    expect(e.asOf).toBe(AS_OF)
    expect(e.name).toBe('G-007')
    expect(e.document).toEqual({
      schema: 1,
      kind: 'guard',
      revision: 0,
      fields: [{ key: 'HouseBrand', type: 'text' }],
      lists: [list('glp1', { include: ['pens'] }), list('controlled'), list('pens')],
      rules: [GUARD_RULE],
    })
    expect(e.raw).toBeUndefined()
    expect((e.data as { lines: unknown[] }).lines).toHaveLength(1)
    expect((e.data as { payer?: unknown }).payer).toBeUndefined()
  })

  it('a category rule that names no list carries no list, and no fields when its document declares none', () => {
    const e = experimentFromRule({ kind: 'category', rule: CATEGORY_RULE, document: { schema: 1, kind: 'category', revision: 4, rules: [] } }, AS_OF)
    expect(e.document).toEqual({ schema: 1, kind: 'category', revision: 0, fields: [], lists: [], rules: [CATEGORY_RULE] })
  })

  it('a coverage rule on an in-list condition carries exactly that list, and its data carries the payer block', () => {
    const e = experimentFromRule({ kind: 'coverage', rule: COVERAGE_RULE, document: COVERAGE_DOC }, AS_OF)
    expect(e.document).toEqual({ schema: 1, kind: 'coverage', revision: 0, fields: [], lists: [list('cosmetics')], rules: [COVERAGE_RULE] })
    expect((e.data as { payer?: unknown }).payer).toBeDefined()
  })

  it('is a copy: the source rule and document are not mutated, and editing the copy leaves them alone', () => {
    const rule = structuredClone(GUARD_RULE)
    const doc = structuredClone(GUARD_DOC)
    const e = experimentFromRule({ kind: 'guard', rule, document: doc }, AS_OF)
    expect(rule).toEqual(GUARD_RULE)
    expect(doc).toEqual(GUARD_DOC)
    const copy = e.document as { rules: { name: { en: string } }[]; lists: { id: string }[] }
    copy.rules[0].name.en = 'changed'
    copy.lists[0].id = 'changed'
    expect(rule.name.en).toBe(GUARD_RULE.name.en)
    expect(doc.lists[0].id).toBe('glp1')
  })

  it('is a valid v1 experiment (what the hand-off carries reads back through the codec)', () => {
    const e = experimentFromRule({ kind: 'coverage', rule: COVERAGE_RULE, document: COVERAGE_DOC }, AS_OF)
    expect(readExperiment(experimentFile(e))).toEqual({ ok: true, experiment: e })
  })
})
