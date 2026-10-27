/**
 * Ticket 612 — the simulator's request (`POST InsuranceRules/Guards/Simulate`, door 3140): a typed form becomes the
 * brief's body, or says what is missing, field by field and line by line.
 */
import { describe, expect, it } from 'vitest'
import { emptyLine, emptySimForm, lineCategory, parseCodes, simulateBody, type SimForm } from './simulate'

const form = (o: Partial<SimForm> = {}): SimForm => ({
  ...emptySimForm(),
  channel: 'oms',
  store: 'P001',
  payer: 'BUPA',
  policy: 'POL-77',
  class: 'A',
  patientKey: '1023456783',
  lines: [{ ...emptyLine(), item: '100101', qty: '2', unit: 'PEN', daysSupply: '28', icd: 'E66.9, z71 ', price: '450.5' }],
  ...o,
})

describe('simulateBody', () => {
  it('turns the typed request into the brief’s body', () => {
    expect(simulateBody(form())).toEqual({
      body: {
        request: {
          channel: 'oms',
          store: 'P001',
          payer: 'BUPA',
          policy: 'POL-77',
          class: 'A',
          lines: [{ item: '100101', qty: 2, unit: 'PEN', daysSupply: 28, icd: ['E66.9', 'Z71'], price: 450.5 }],
        },
        patientKey: '1023456783',
      },
      problems: [],
    })
  })

  it('leaves days’ supply out when it is blank (it is optional), and trims every value', () => {
    const r = simulateBody(form({ store: ' P019 ', lines: [{ ...emptyLine(), item: ' 200101 ', qty: '1', unit: 'TAB', daysSupply: '', icd: '', price: '0' }] }))
    expect(r.body?.request.store).toBe('P019')
    expect(r.body?.request.lines).toEqual([{ item: '200101', qty: 1, unit: 'TAB', icd: [], price: 0 }])
  })

  it('names each missing or wrong field, the lines by their number', () => {
    const r = simulateBody(
      form({
        store: '',
        patientKey: ' ',
        lines: [
          { ...emptyLine(), item: '', qty: '0', unit: 'PEN', daysSupply: '-1', icd: '', price: 'x' },
          { ...emptyLine(), item: '100101', qty: '1.5', unit: '', daysSupply: '', icd: '', price: '10' },
        ],
      }),
    )
    expect(r.body).toBeNull()
    expect(r.problems).toEqual([
      { field: 'store', problem: 'required' },
      { field: 'patientKey', problem: 'required' },
      { field: 'item', line: 1, problem: 'required' },
      { field: 'qty', line: 1, problem: 'positive' },
      { field: 'daysSupply', line: 1, problem: 'wholeNumber' },
      { field: 'price', line: 1, problem: 'amount' },
      { field: 'qty', line: 2, problem: 'wholeNumber' },
      { field: 'unit', line: 2, problem: 'required' },
    ])
  })

  it('asks for at least one line', () => {
    expect(simulateBody(form({ lines: [] })).problems).toEqual([{ field: 'lines', problem: 'required' }])
  })
})

describe('parseCodes', () => {
  it('splits on commas and spaces, upper-cases and drops repeats', () => {
    expect(parseCodes(' e11.9,E11.9  e66 ;z71')).toEqual(['E11.9', 'E66', 'Z71'])
    expect(parseCodes('')).toEqual([])
  })
})

describe('lineCategory (review 3126 P6a, story 61: "the simulator shows which rule set it")', () => {
  it('lineCategory_namesTheGroupAndTheCategoryRule_orTheItemDefault', () => {
    expect(lineCategory({ outcome: 'pass', fired: [], trace: [], category: { group: 'G1', ruleId: 'K-002' } })).toEqual({ group: 'G1', ruleId: 'K-002' })
    expect(lineCategory({ outcome: 'pass', fired: [], trace: [], category: { group: 'G2', ruleId: null } })).toEqual({ group: 'G2', ruleId: null })
  })
  it('an answer without a category, or with an unknown group, shows none', () => {
    expect(lineCategory({ outcome: 'pass', fired: [], trace: [] })).toBeNull()
    expect(lineCategory({ outcome: 'pass', fired: [], trace: [], category: { group: 'G9' as 'G1', ruleId: 'K-1' } })).toBeNull()
  })
})
