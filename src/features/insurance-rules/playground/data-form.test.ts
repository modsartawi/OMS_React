/**
 * Ticket 682 — the Data pane's Form and JSON edit ONE dataset. data → form → data is identical (attributes as text,
 * empty ICD, null codes, keys the form does not know); an edit in the form lands in the data and nowhere else.
 */
import { describe, expect, it } from 'vitest'
import { kindSeed, SEED_DATA } from './experiment'
import {
  addFact,
  addHistory,
  addLine,
  addReferenceRow,
  dataFromForm,
  formFromData,
  moveLine,
  readEligibility,
  removeHistory,
  removeLine,
  removeReferenceRow,
  writeEligibility,
  type DataForm,
} from './data-form'

const DATA = {
  request: { channel: 'nphies', store: 'P001', payer: '0001100041', policy: null, class: 'A', pharmacist: null, attributes: { region: 'R1', tier: '2' }, channelNote: 'kept' },
  patient: { birthDate: '1990-04-01', gender: 'male', idType: 'nationalId', attributes: { weightKg: '71.5' } },
  lines: [
    { line: 1, item: '200021', quantity: 2, unit: 'PC', daysSupply: 120, icd: ['E11', 'I10'], price: 120.5, eCode: null, dCode: null, sfdaCode: null, idfPriority: null, attributes: { strength: '500' }, mystery: { a: 1 } },
    { line: 2, item: '300100', quantity: 1, unit: 'BX', daysSupply: null, icd: [], price: 9, eCode: 'E-1', dCode: null, sfdaCode: '123', idfPriority: 2, attributes: {} },
  ],
  history: [{ item: '200021', on: '2026-09-01' }],
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
    expect(ok(DATA).more).toEqual(['request.channelNote', 'lines[0].mystery', 'payer'])
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

// ── 683: history, reference rows, eligibility facts and the coverage payer ───────────────────
const FULL = {
  request: { channel: 'nphies', store: 'P001', attributes: {} },
  lines: [{ line: 1, item: '200021', quantity: 2, sfdaCode: '1234-56', attributes: {} }],
  history: [
    { on: '2026-10-20', item: '200021', quantity: 1, daysSupply: 30, store: 'P001', payer: '0001100041', attributes: { channel: 'pos' } },
    { on: '2026-09-01', item: '300100', quantity: '2', daysSupply: null, store: 'P002', payer: null, attributes: {}, note: 'kept' },
  ],
  reference: {
    sfda: { '1234-56': { registerNumber: '1234-56', tradeName: 'Glucophage', publicPrice: 12.5, gtin: '628' } },
    mapped: { '1234-56': [{ sfdaCode: '1234-56', udfCode: 'U1' }, { sfdaCode: '1234-56', udfCode: 'U2' }] },
    formulary: { '1234-56': [{ udfCode: 'U1', icd: ['E11', 'E11.9'], minAgeYears: 18, indication: 'Diabetes' }] },
    editions: [{ list: 'sfda', editionId: 'x', editionNo: 3 }],
  },
  eligibility: {
    'benefit[66].approvalLimit': { type: 'number', number: 10000, unit: 'SAR' },
    'policy.name': { type: 'text', text: 'Gold' },
    'member.active': { type: 'flag', flag: true },
    'policy.expiry': { type: 'date', date: '2027-01-31', raw: '31/01/2027' },
  },
  payer: { deductibles: { G1: { percent: 20, max: 50 }, G2: { percent: 30, max: null }, G3: { percent: null, max: null } } },
}
const COVERAGE = { payer: true }
const okC = (data: unknown): DataForm => {
  const r = formFromData(data, COVERAGE)
  if (!r) throw new Error('the form refused the data')
  return r
}

describe('dataRoundTrip — 683 sections', () => {
  it('history, reference, eligibility of each type and the payer round-trip unchanged', () => {
    const back = dataFromForm(okC(FULL))
    expect(back).toEqual(FULL)
    expect(JSON.stringify(back)).toBe(JSON.stringify(FULL))
  })

  it('the coverage seed round-trips', () => {
    const seed: unknown = JSON.parse(kindSeed('coverage').dataText)
    expect(JSON.stringify(dataFromForm(okC(seed)))).toBe(JSON.stringify(seed))
  })

  it('empty sections stay empty arrays or objects, and the form holds them as empty', () => {
    const empty = { history: [], reference: {}, eligibility: {}, payer: {} }
    const f = okC(empty)
    expect(f.history).toEqual([])
    expect(f.reference?.rows).toEqual([])
    expect(f.eligibility?.facts).toEqual([])
    expect(JSON.stringify(dataFromForm(f))).toBe(JSON.stringify(empty))
  })

  it('the form shows every section, and lists only what it cannot show', () => {
    expect(okC(FULL).more).toEqual(['history[1].note', 'reference.editions'])
    expect(ok(SEED_DATA).more).toEqual([])
  })

  it('the payer is a form section only for coverage; otherwise it is kept as JSON', () => {
    const f = ok(FULL)
    expect(f.payer).toBeNull()
    expect(f.more).toContain('payer')
    expect(dataFromForm(f)).toEqual(FULL)
  })

  it('a section in a shape the form cannot hold is kept as JSON, the rest stays a form', () => {
    const odd = { history: 'none', reference: { sfda: 'x' }, eligibility: { k: 5 }, payer: { deductibles: [] }, lines: [] }
    const f = okC(odd)
    expect(f.more).toEqual(['history', 'reference', 'eligibility', 'payer'])
    expect(dataFromForm(f)).toEqual(odd)
  })
})

describe('683 — a form edit lands in the data', () => {
  it('a history event is added in the event shape, and its fields are typed like a line', () => {
    let f = addHistory(okC({ history: [] }))
    f.history![0].fields.on = '2026-10-01'
    f.history![0].fields.quantity = '3'
    f.history![0].attributes = [{ key: 'channel', value: 'pos' }]
    expect(dataFromForm(f)).toEqual({ history: [{ on: '2026-10-01', item: null, quantity: 3, daysSupply: null, store: null, payer: null, attributes: { channel: 'pos' } }] })
    f = removeHistory(f, 0)
    expect(dataFromForm(f)).toEqual({ history: [] })
  })

  it('an eligibility fact of each type is written in the engine shape', () => {
    let f = okC({})
    for (const [key, type, value, unit] of [
      ['benefit[66].approvalLimit', 'number', '10000', 'SAR'],
      ['policy.name', 'text', 'Gold', ''],
      ['member.active', 'flag', 'false', ''],
      ['policy.expiry', 'date', '2027-01-31', ''],
    ] as const) {
      f = addFact(f)
      const i = f.eligibility!.facts.length - 1
      f.eligibility!.facts[i] = { ...f.eligibility!.facts[i], key, type, value, unit }
    }
    expect(dataFromForm(f)).toEqual({
      eligibility: {
        'benefit[66].approvalLimit': { type: 'number', number: 10000, unit: 'SAR' },
        'policy.name': { type: 'text', text: 'Gold' },
        'member.active': { type: 'flag', flag: false },
        'policy.expiry': { type: 'date', date: '2027-01-31' },
      },
    })
  })

  it('changing a fact type moves its value to the new slot; extra keys survive; a fact with no key is not written', () => {
    const f = okC(FULL)
    const facts = f.eligibility!.facts
    facts[3] = { ...facts[3], type: 'text', value: 'end of January' }
    facts[0] = { ...facts[0], value: '9000' }
    f.eligibility!.facts = [...facts, { ...facts[1], uid: 'new', key: ' ', base: null }]
    const e = (dataFromForm(f) as typeof FULL).eligibility as Record<string, unknown>
    expect(e['policy.expiry']).toEqual({ type: 'text', raw: '31/01/2027', text: 'end of January' })
    expect(e['benefit[66].approvalLimit']).toEqual({ type: 'number', number: 9000, unit: 'SAR' })
    expect(Object.keys(e)).toHaveLength(4)
  })

  it('readEligibility / writeEligibility are a pure pair over the eligibility block', () => {
    const block = { 'benefit[66].copayPct': { type: 'number', number: 20, unit: '%' } }
    const e = readEligibility(block)!
    expect(e.facts.map((x) => [x.key, x.type, x.value, x.unit])).toEqual([['benefit[66].copayPct', 'number', '20', '%']])
    expect(writeEligibility(e)).toEqual(block)
    expect(readEligibility([1])).toBeNull()
  })

  it('a reference row is added, its fields keep their type when edited, and a removed row leaves its table', () => {
    let f = okC(FULL)
    const r = f.reference!
    expect(r.rows.map((x) => [x.table, x.code])).toEqual([
      ['sfda', '1234-56'],
      ['mapped', '1234-56'],
      ['mapped', '1234-56'],
      ['formulary', '1234-56'],
    ])
    r.rows[0].fields = r.rows[0].fields.map((x) => (x.key === 'publicPrice' ? { ...x, value: '14' } : x))
    r.rows[3].fields = r.rows[3].fields.map((x) => (x.key === 'icd' ? { ...x, value: 'E11, E10' } : x))
    f = removeReferenceRow(f, 2)
    f = addReferenceRow(f)
    const added = f.reference!.rows.length - 1
    f.reference!.rows[added] = { ...f.reference!.rows[added], table: 'sfda', code: '9999-01', fields: [{ key: 'tradeName', value: 'Panadol' }] }
    const ref = (dataFromForm(f) as typeof FULL).reference as unknown as Record<string, Record<string, unknown>>
    expect(ref.sfda).toEqual({ '1234-56': { registerNumber: '1234-56', tradeName: 'Glucophage', publicPrice: 14, gtin: '628' }, '9999-01': { tradeName: 'Panadol' } })
    expect(ref.mapped).toEqual({ '1234-56': [{ sfdaCode: '1234-56', udfCode: 'U1' }] })
    expect((ref.formulary['1234-56'] as { icd: string[] }[])[0].icd).toEqual(['E11', 'E10'])
    expect(ref.editions).toEqual(FULL.reference.editions)
  })

  it('a reference row in a new list table is written as a list; a row with no code is not written', () => {
    const f = addReferenceRow(addReferenceRow(okC({ reference: {} })))
    f.reference!.rows[0] = { ...f.reference!.rows[0], table: 'formulary', code: 'U9', fields: [{ key: 'indication', value: 'Asthma' }] }
    expect(dataFromForm(f)).toEqual({ reference: { formulary: { U9: [{ indication: 'Asthma' }] } } })
  })

  it('the payer: a deductible edit is a number, and an absent payer is written once something is typed', () => {
    const f = okC({})
    expect(f.payer!.deductibles.map((d) => d.group)).toEqual(['G1', 'G2', 'G3'])
    expect(dataFromForm(f)).toEqual({})
    f.payer!.deductibles[1] = { ...f.payer!.deductibles[1], percent: '25' }
    expect(dataFromForm(f)).toEqual({ payer: { deductibles: { G2: { percent: 25, max: null } } } })
    const g = okC(FULL)
    g.payer!.deductibles[0] = { ...g.payer!.deductibles[0], max: '' }
    expect((dataFromForm(g) as typeof FULL).payer.deductibles.G1).toEqual({ percent: 20, max: null })
  })
})
