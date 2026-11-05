/**
 * Document Details' Insurance section (ticket 787, BackOffice spec 3389 / door 3390): the pure model
 * the section draws — the money verdict, the lines, how each was priced, and whether it is drawn.
 */
import { describe, expect, it } from 'vitest'
import type { OrderInsuranceRead } from '@/core/models/order-insurance'
import fixture from './__fixtures__/insurance-1006358459.json'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { asksInsurance, insuranceSectionGate, lineView, moneyTable, pricingSteps, RECEIVED_LINE_FIGURES } from './insurance-section'

const READ = fixture as unknown as OrderInsuranceRead

describe('insurance-section model: flags a gap between current and engine money', () => {
  it('1006358459: patient 63.65 current beside 13.26 engine is a gap, in SAR decimals', () => {
    const patient = moneyTable(READ).rows.find((r) => r.figure === 'patient')!
    expect(patient.channel).toEqual({ kind: 'amount', text: '63.65' })
    expect(patient.current).toEqual({ kind: 'amount', text: '63.65' })
    expect(patient.engine).toEqual({ kind: 'amount', text: '13.26' })
    expect(patient.gap).toBe(true)
  })

  it('a figure the engine agrees with is no gap (deductible VAT 0 = 0, uncovered 0 = 0)', () => {
    const rows = moneyTable(READ).rows
    expect(rows.find((r) => r.figure === 'deductibleVat')!.gap).toBe(false)
    expect(rows.find((r) => r.figure === 'uncovered')!.gap).toBe(false)
  })

  it('a float tail is not a gap: 0.1 + 0.2 against 0.3', () => {
    const read = structuredClone(READ)
    read.money.current.uncovered = 0.1 + 0.2
    read.money.engine = { ...read.money.engine, uncovered: 0.3 } as typeof read.money.engine
    expect(moneyTable(read).rows.find((r) => r.figure === 'uncovered')!.gap).toBe(false)
  })

  it('the table says it has a gap, in the order of the figures, ending on amount due', () => {
    const table = moneyTable(READ)
    expect(table.hasGap).toBe(true)
    expect(table.rows.map((r) => r.figure)).toEqual(['patient', 'deductible', 'deductibleVat', 'uncovered', 'insurer', 'amountDue'])
  })

  it('a difference below the shown decimals is no gap: 13.261 beside 13.264 both read 13.26', () => {
    const read = structuredClone(READ)
    read.money.current.patient = 13.261
    read.money.engine = { ...read.money.engine, patient: 13.264 } as typeof read.money.engine
    const patient = moneyTable(read).rows.find((r) => r.figure === 'patient')!
    expect([patient.current, patient.engine]).toEqual([{ kind: 'amount', text: '13.26' }, { kind: 'amount', text: '13.26' }])
    expect(patient.gap).toBe(false)
  })

  it('a BHD order compares at three decimals: 13.261 beside 13.264 is a gap', () => {
    const read = { ...structuredClone(READ), currency: 'BHD' }
    read.money.current.patient = 13.261
    read.money.engine = { ...read.money.engine, patient: 13.264 } as typeof read.money.engine
    expect(moneyTable(read).rows.find((r) => r.figure === 'patient')!.gap).toBe(true)
  })

  it('a BHD order draws three decimals', () => {
    const read = { ...structuredClone(READ), currency: 'BHD' }
    expect(moneyTable(read).rows[0].current).toEqual({ kind: 'amount', text: '63.650' })
  })

  it('no channel money is "none", not zero', () => {
    const read = structuredClone(READ)
    read.money.channel = null
    expect(moneyTable(read).rows[0].channel).toEqual({ kind: 'none' })
  })
})

/** The fixture with its one line unresolved: the engine cannot price it, so neither the line nor the order. */
function unpriced(): OrderInsuranceRead {
  const read = structuredClone(READ)
  const line = read.lines[0]
  line.engineDeductible = null
  line.unresolvedReason = 'SFDA code matches no item'
  line.engine = { priced: false, unpricedReason: 'No price for the item', deductible: null, deductibleVat: null, patient: null, insurer: null }
  read.money.engine = {
    priced: false,
    unpricedLines: [10],
    patient: null,
    deductible: null,
    deductibleVat: null,
    uncovered: null,
    insurer: null,
    amountDue: null,
  }
  return read
}

describe('insurance-section model: an unpriced line reads unpriced, not zero', () => {
  it("the line's engine deductible and engine money read unpriced, with the reason", () => {
    const view = lineView(unpriced().lines[0], 'SAR')
    expect(view.engineDeductible).toEqual({ kind: 'unpriced' })
    expect(view.unpricedReason).toBe('No price for the item')
  })

  it("the applied money beside it still reads as figures: 63.65 applied, a 0 VAT reads 0.00", () => {
    const view = lineView(unpriced().lines[0], 'SAR')
    expect(view.appliedDeductible).toEqual({ kind: 'amount', text: '63.65' })
    expect(view.vat).toEqual({ kind: 'amount', text: '0.00' })
  })

  it('unpriced engine order money reads unpriced in every figure, and is never a gap', () => {
    const table = moneyTable(unpriced())
    for (const row of table.rows) expect([row.figure, row.engine]).toEqual([row.figure, { kind: 'unpriced' }])
    expect(table.hasGap).toBe(false)
  })

  it("a priced line: engine 13.26 beside applied 63.65 is the line's gap", () => {
    const view = lineView(READ.lines[0], 'SAR')
    expect(view.engineDeductible).toEqual({ kind: 'amount', text: '13.26' })
    expect(view.deductibleGap).toBe(true)
  })

  it("a line's deductible gap is decided at the shown decimals: 13.261 applied beside 13.264 engine is none", () => {
    const line = { ...structuredClone(READ.lines[0]), appliedDeductible: 13.261, engineDeductible: 13.264 }
    expect(lineView(line, 'SAR').deductibleGap).toBe(false)
    expect(lineView(line, 'BHD').deductibleGap).toBe(true)
  })

  it("a line the channel sent no split for reads none, not zero", () => {
    const line = { ...structuredClone(READ.lines[0]), received: null }
    expect(lineView(line, 'SAR').received).toBeNull()
    expect(lineView(READ.lines[0], 'SAR').received?.patient).toEqual({ kind: 'amount', text: '63.65' })
  })

  it("the channel's per-line split shows all four of its figures, deductible VAT included", () => {
    expect(RECEIVED_LINE_FIGURES).toEqual(['deductible', 'deductibleVat', 'patient', 'insurer'])
    const line = structuredClone(READ.lines[0])
    line.received = { ...line.received!, deductibleVat: 1.99 }
    expect(lineView(line, 'SAR').received?.deductibleVat).toEqual({ kind: 'amount', text: '1.99' })
  })
})

describe("insurance-section model: an item-0 condition's money is its rate", () => {
  it('the header delivery fee (DFEE, value 0, rate 15) reads 15.00, not 0.00', () => {
    const [fee] = pricingSteps(READ.headerConditions, 'SAR')
    expect(fee.description).toBe('Delivery Fees')
    expect(fee.money).toEqual({ kind: 'amount', text: '15.00' })
    expect(fee.header).toBe(true)
  })

  it("a line's own condition reads its value: the deductible step is 63.65 on a base of 66.31", () => {
    const deductible = pricingSteps(READ.lines[0].conditions, 'SAR').find((s) => s.condType === 'ZDED')!
    expect(deductible.money).toEqual({ kind: 'amount', text: '63.65' })
    expect(deductible.base).toEqual({ kind: 'amount', text: '66.31' })
    expect(deductible.rate).toBe('20')
    expect(deductible.header).toBe(false)
  })

  it('lists the conditions in step order, whatever order they arrive in', () => {
    expect(pricingSteps(READ.lines[0].conditions, 'SAR').map((s) => s.stepNumber)).toEqual([10, 30, 40])
  })

  it('a condition with no description falls back to its code', () => {
    const blank = { ...READ.headerConditions[0], condType: 'CPRV', description: '' }
    expect(pricingSteps([blank], 'SAR')[0].description).toBe('CPRV')
  })
})

describe('insurance-section is absent without the grant or on a non-insurance order', () => {
  const GRANTED = { canOpenList: true, canOpenDetail: true, canViewInsurance: true } as OmsAccessResult
  const ORDER = { openedAs: 'document', documentCategory: 'O', access: GRANTED } as const

  it('an insurance order on Document Details, with the grant, asks the read and draws the section', () => {
    expect(asksInsurance(ORDER)).toBe(true)
    expect(insuranceSectionGate(ORDER, READ)).toBe(true)
  })

  it('without the grant: no read asked, no section — absent, false, not a strict true, probe pending', () => {
    const { canViewInsurance: _, ...without } = GRANTED
    for (const access of [without, { ...GRANTED, canViewInsurance: false }, { ...GRANTED, canViewInsurance: 'true' }, undefined, null]) {
      const ctx = { ...ORDER, access: access as OmsAccessResult | undefined }
      expect(asksInsurance(ctx)).toBe(false)
      expect(insuranceSectionGate(ctx, READ)).toBe(false)
    }
  })

  it('a non-insurance order (the read answered null, NOT_INSURANCE_ORDER) or a read not landed: no section', () => {
    expect(insuranceSectionGate(ORDER, null)).toBe(false)
    expect(insuranceSectionGate(ORDER, undefined)).toBe(false)
  })

  it('never on a delivery: not on the delivery route, nor a delivery opened by its number on the document route', () => {
    expect(asksInsurance({ ...ORDER, openedAs: 'delivery' })).toBe(false)
    expect(asksInsurance({ ...ORDER, documentCategory: 'D' })).toBe(false)
    expect(insuranceSectionGate({ ...ORDER, openedAs: 'delivery' }, READ)).toBe(false)
  })

  it('an ERX prescription (X) asks too', () => {
    expect(asksInsurance({ ...ORDER, documentCategory: 'X' })).toBe(true)
  })
})
