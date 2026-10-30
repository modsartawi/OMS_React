/**
 * Ticket 685 — a payer's eligibility answer, flattened by `POST InsuranceRules/Playground/Flatten`, becomes the
 * experiment's `eligibility` block: keyed as a rule names a fact, each fact in the engine shape `{ type, <type>: value,
 * unit }`. "Use these facts" REPLACES the prior facts (the facts are the payer's answer); an edit after Use is the
 * data's own and survives a re-read.
 */
import { describe, expect, it } from 'vitest'
import { applyFacts, flattenBody, flattenFactsIn } from './flatten'
import { dataFromForm, formFromText, formText } from './data-form'

const FACTS = [
  { key: 'benefit[66].approvalLimit', type: 'number', value: 10000, unit: 'SAR' },
  { key: 'plan.name', type: 'text', value: 'Gold', unit: null },
  { key: 'member.active', type: 'flag', value: true },
  { key: 'coverage.end', type: 'date', value: '2026-12-31' },
]

const DATA = {
  request: { channel: 'nphies', store: 'P001' },
  lines: [{ line: 1, item: '200021', quantity: 2 }],
  eligibility: { 'old.fact': { type: 'number', number: 5 }, 'benefit[66].approvalLimit': { type: 'number', number: 1 } },
}

describe('flattenBody — what the Flatten door is sent', () => {
  it('the contract: source, the parsed response, member id and policy', () => {
    expect(flattenBody({ source: 'nphies', response: '{"resourceType":"Bundle"}', memberId: ' 1023 ', policy: 'P-9' })).toEqual({
      body: { source: 'nphies', response: { resourceType: 'Bundle' }, memberId: '1023', policy: 'P-9' },
    })
  })

  it('a blank member id or policy is sent as null', () => {
    expect(flattenBody({ source: 'bupa', response: '{}', memberId: '', policy: '  ' })).toEqual({ body: { source: 'bupa', response: {}, memberId: null, policy: null } })
  })

  it('a response that is not one JSON object is never sent', () => {
    for (const response of ['', '{"a":', 'not json', '[1,2]', '"text"', 'null'])
      expect([response, flattenBody({ source: 'nphies', response, memberId: '', policy: '' })]).toEqual([response, { problem: 'invalid' }])
  })
})

describe('flattenFactsIn — the reply read', () => {
  it('keeps the facts that have a key and a type; no reply is no facts', () => {
    expect(flattenFactsIn({ facts: [FACTS[0], { key: '', type: 'number', value: 1 }, { key: 'x' }, null] })).toEqual([FACTS[0]])
    expect(flattenFactsIn(null)).toEqual([])
    expect(flattenFactsIn({ facts: 'no' })).toEqual([])
  })
})

describe('applyFacts — "Use these facts"', () => {
  it('the facts become the eligibility block, keyed as a rule names them, in the engine shape', () => {
    const r = applyFacts(JSON.stringify(DATA), FACTS)
    expect('text' in r && JSON.parse(r.text).eligibility).toEqual({
      'benefit[66].approvalLimit': { type: 'number', number: 10000, unit: 'SAR' },
      'plan.name': { type: 'text', text: 'Gold' },
      'member.active': { type: 'flag', flag: true },
      'coverage.end': { type: 'date', date: '2026-12-31' },
    })
  })

  it('replaces the prior facts, and leaves the rest of the data as it was', () => {
    const r = applyFacts(JSON.stringify(DATA), FACTS)
    const data = 'text' in r ? JSON.parse(r.text) : null
    expect(data.eligibility['old.fact']).toBeUndefined()
    expect(data.request).toEqual(DATA.request)
    expect(data.lines).toEqual(DATA.lines)
    expect(Object.keys(data)).toEqual(['request', 'lines', 'eligibility'])
  })

  it('no eligibility before: the block is added', () => {
    const r = applyFacts('{"lines":[]}', [FACTS[0]])
    expect('text' in r && JSON.parse(r.text)).toEqual({ lines: [], eligibility: { 'benefit[66].approvalLimit': { type: 'number', number: 10000, unit: 'SAR' } } })
  })

  it('a data box that is not one JSON object cannot take the facts', () => {
    expect(applyFacts('{"lines":', FACTS)).toEqual({ problem: 'invalid' })
    expect(applyFacts('[]', FACTS)).toEqual({ problem: 'invalid' })
  })

  it('the form shows them: 10000 SAR on benefit[66].approvalLimit', () => {
    const r = applyFacts(JSON.stringify(DATA), FACTS)
    const read = formFromText('text' in r ? r.text : '')
    const facts = 'form' in read ? read.form.eligibility?.facts : []
    expect(facts?.map((f) => [f.key, f.type, f.value, f.unit])).toEqual([
      ['benefit[66].approvalLimit', 'number', '10000', 'SAR'],
      ['plan.name', 'text', 'Gold', ''],
      ['member.active', 'flag', 'true', ''],
      ['coverage.end', 'date', '2026-12-31', ''],
    ])
  })

  it('an edit after Use survives a re-read of the data', () => {
    const r = applyFacts(JSON.stringify(DATA), FACTS)
    const read = formFromText('text' in r ? r.text : '')
    if (!('form' in read) || !read.form.eligibility) throw new Error('no form')
    const form = read.form
    const edited = { ...form, eligibility: { ...form.eligibility!, facts: form.eligibility!.facts.map((f, i) => (i === 0 ? { ...f, value: '12000' } : f)) } }
    const text = formText(edited)
    const again = formFromText(text)
    expect('form' in again && dataFromForm(again.form).eligibility).toMatchObject({ 'benefit[66].approvalLimit': { type: 'number', number: 12000, unit: 'SAR' } })
  })
})
