/**
 * Ticket 682 — the Data pane's Form and JSON edit ONE dataset. data → form → data is identical (attributes as text,
 * empty ICD, null codes, keys the form does not know); an edit in the form lands in the data and nowhere else.
 */
import { describe, expect, it } from 'vitest'
import { SEED_DATA } from './experiment'
import { addLine, dataFromForm, formFromData, moveLine, removeLine, type DataForm } from './data-form'

const DATA = {
  request: { channel: 'nphies', store: 'P001', payer: '0001100041', policy: null, class: 'A', pharmacist: null, attributes: { region: 'R1', tier: '2' }, channelNote: 'kept' },
  patient: { birthDate: '1990-04-01', gender: 'male', idType: 'nationalId', attributes: { weightKg: '71.5' } },
  lines: [
    { line: 1, item: '200021', quantity: 2, unit: 'PC', daysSupply: 120, icd: ['E11', 'I10'], price: 120.5, eCode: null, dCode: null, sfdaCode: null, idfPriority: null, attributes: { strength: '500' }, mystery: { a: 1 } },
    { line: 2, item: '300100', quantity: 1, unit: 'BX', daysSupply: null, icd: [], price: 9, eCode: 'E-1', dCode: null, sfdaCode: '123', idfPriority: 2, attributes: {} },
  ],
  history: [{ item: '200021', date: '2026-09-01' }],
  reference: {},
  eligibility: {},
  payer: { deductibles: {} },
}

const ok = (data: unknown): DataForm => {
  const r = formFromData(data)
  if (!r) throw new Error('the form refused the data')
  return r
}

describe('dataRoundTrip', () => {
  it('data → form → data is identical, unknown keys included, key order kept', () => {
    const back = dataFromForm(ok(DATA))
    expect(back).toEqual(DATA)
    expect(JSON.stringify(back)).toBe(JSON.stringify(DATA))
  })

  it('the seed survives a round trip', () => {
    expect(JSON.stringify(dataFromForm(ok(SEED_DATA)))).toBe(JSON.stringify(SEED_DATA))
  })

  it('a value of a strange type survives when it is not edited (a number attribute, a text quantity)', () => {
    const odd = { request: { attributes: { n: 5 } }, lines: [{ line: 1, quantity: '2' }] }
    expect(dataFromForm(ok(odd))).toEqual(odd)
  })

  it('the form shows text: attributes as key/value text, ICD as one text, null as empty', () => {
    const f = ok(DATA)
    expect(f.request.fields.policy).toBe('')
    expect(f.request.attributes).toEqual([{ key: 'region', value: 'R1' }, { key: 'tier', value: '2' }])
    expect(f.lines[0].fields.quantity).toBe('2')
    expect(f.lines[0].fields.icd).toBe('E11, I10')
    expect(f.lines[1].fields.icd).toBe('')
  })

  it('sections the data does not hold are not invented', () => {
    expect(dataFromForm(ok({ lines: [] }))).toEqual({ lines: [] })
    expect(dataFromForm(ok({}))).toEqual({})
  })

  it('names the keys the form cannot show', () => {
    expect(ok(DATA).more).toEqual(['request.channelNote', 'lines[0].mystery', 'history', 'reference', 'eligibility', 'payer'])
    expect(ok({ lines: [] }).more).toEqual([])
  })

  it('data it cannot hold as a form is refused (not an object, lines not a list, a line not an object)', () => {
    expect(formFromData([1])).toBeNull()
    expect(formFromData({ request: 'x' })).toBeNull()
    expect(formFromData({ lines: {} })).toBeNull()
    expect(formFromData({ lines: [3] })).toBeNull()
  })
})

describe('a form edit lands in the data', () => {
  it('numbers become numbers, a cleared value becomes null, text that is no number stays text', () => {
    const f = ok(DATA)
    f.lines[0].fields.quantity = '3'
    f.lines[0].fields.price = ''
    f.lines[1].fields.daysSupply = 'abc'
    f.request.fields.policy = 'POL-9'
    f.request.fields.store = ''
    const d = dataFromForm(f) as typeof DATA
    expect(d.lines[0].quantity).toBe(3)
    expect(d.lines[0].price).toBeNull()
    expect(d.lines[1].daysSupply).toBe('abc')
    expect(d.request.policy).toBe('POL-9')
    expect(d.request.store).toBeNull()
    expect(d.lines[0].mystery).toEqual({ a: 1 })
  })

  it('ICD is split into codes; attributes are written as text even when they look like numbers', () => {
    const f = ok(DATA)
    f.lines[1].fields.icd = 'J45,  E66 ,'
    f.patient.attributes = [{ key: 'weightKg', value: '72' }, { key: '', value: 'dropped' }, { key: 'smoker', value: 'no' }]
    const d = dataFromForm(f) as typeof DATA
    expect(d.lines[1].icd).toEqual(['J45', 'E66'])
    expect(d.patient.attributes).toEqual({ weightKg: '72', smoker: 'no' })
  })

  it('a field typed into an absent section creates it', () => {
    const f = ok({ lines: [] })
    f.patient.fields.gender = 'female'
    expect(dataFromForm(f)).toEqual({ lines: [], patient: { gender: 'female' } })
  })

  it('add, move and remove lines; a new line takes the next number and the line shape', () => {
    let f = addLine(ok(DATA))
    expect(f.lines).toHaveLength(3)
    const added = (dataFromForm(f) as typeof DATA).lines[2]
    expect(added).toEqual({ line: 3, item: null, quantity: 1, unit: null, daysSupply: null, icd: [], price: null, eCode: null, dCode: null, sfdaCode: null, idfPriority: null, attributes: {} })
    f = moveLine(f, 2, -1)
    expect((dataFromForm(f) as typeof DATA).lines.map((l) => l.line)).toEqual([1, 3, 2])
    f = moveLine(f, 0, -1)
    expect((dataFromForm(f) as typeof DATA).lines.map((l) => l.line)).toEqual([1, 3, 2])
    f = removeLine(f, 0)
    expect((dataFromForm(f) as typeof DATA).lines.map((l) => l.line)).toEqual([3, 2])
  })

  it('adding a line to data with no lines creates the list', () => {
    expect(dataFromForm(addLine(ok({})))).toEqual({ lines: [expect.objectContaining({ line: 1, quantity: 1 })] })
  })
})
