import { describe, expect, it } from 'vitest'
import {
  READY_DAY,
  READY_DAY_BHD,
  READY_DAY_NO_Z,
  READY_RECEIPT,
  READY_RECEIPT_ORPHAN,
} from './ready-fixture'
import {
  ABSENT,
  isReceipt,
  readyBusinessDay,
  readyEntryNumber,
  readyKindKey,
  readyMoney,
  readyRowId,
  readyZNumber,
} from './ready-projection'

// Ticket 317's projection Proof — BackOffice 1994: "A null is an absence, never a
// zero — render a dash, not 0.000."

describe('the money cells', () => {
  it('draw a figure to its own row’s currency — 2 dp for SAR, 3 for BHD', () => {
    expect(readyMoney(READY_DAY.cashToHandOver, READY_DAY.currencyKey)).toBe('1,000.50')
    expect(readyMoney(READY_DAY.surplusDeducted, READY_DAY.currencyKey)).toBe('250.00')
    expect(readyMoney(READY_DAY_BHD.cashToHandOver, READY_DAY_BHD.currencyKey)).toBe('95.255')
  })

  it('🚩 draw a dash for a null — never 0.000', () => {
    expect(readyMoney(READY_RECEIPT.surplusDeducted, 'SAR')).toBe(ABSENT)
    expect(readyMoney(READY_DAY_NO_Z.cashToHandOver, 'SAR')).toBe(ABSENT)
    expect(readyMoney(READY_DAY_NO_Z.surplusDeducted, 'BHD')).toBe(ABSENT)
    expect(ABSENT).toBe('—')
  })

  it('…while a real zero stays a zero — "0 when none" is a fact, not an absence', () => {
    expect(readyMoney(READY_DAY_BHD.surplusDeducted, 'BHD')).toBe('0.000')
    expect(readyMoney(0, 'SAR')).toBe('0.00')
  })
})

describe('the handles', () => {
  it('a day shows its Z number; a receipt and a day without its Z show a dash', () => {
    expect(readyZNumber(READY_DAY)).toBe('412')
    expect(readyZNumber(READY_RECEIPT)).toBe(ABSENT)
    expect(readyZNumber(READY_DAY_NO_Z)).toBe(ABSENT)
  })

  it('a receipt shows its shortage entry; a day (0) and a receipt whose entry is gone (0) show a dash', () => {
    expect(readyEntryNumber(READY_RECEIPT)).toBe('143')
    expect(readyEntryNumber(READY_DAY)).toBe(ABSENT)
    expect(readyEntryNumber(READY_RECEIPT_ORPHAN)).toBe(ABSENT)
  })

  it('a day shows its business day; a receipt covers none', () => {
    expect(readyBusinessDay(READY_DAY)).toBe('2026-09-20')
    expect(readyBusinessDay(READY_RECEIPT)).toBe(ABSENT)
    expect(readyBusinessDay({ businessDay: '0001-01-01T00:00:00' })).toBe(ABSENT)
  })
})

describe('the kind', () => {
  it('names the two kinds the contract carries', () => {
    expect(readyKindKey('DAY')).toBe('ready.kinds.DAY')
    expect(readyKindKey('SETTLEMENT')).toBe('ready.kinds.SETTLEMENT')
    expect(isReceipt(READY_RECEIPT)).toBe(true)
    expect(isReceipt(READY_DAY)).toBe(false)
  })

  it('🚩 an unknown kind has no key — the cell shows the raw value rather than a raw t() key', () => {
    expect(readyKindKey('HOLD')).toBeNull()
    expect(readyKindKey('')).toBeNull()
  })
})

describe('the row identity', () => {
  it('is the kind plus the row key the contract names for it', () => {
    expect(readyRowId(READY_DAY)).toBe('DAY:01K5ZB7M2N3P4R5S6T7V8W9X0Y')
    expect(readyRowId(READY_RECEIPT)).toBe('SETTLEMENT:01K5ZC1A2B3C4D5E6F7G8H9J0K')
  })

  it('never collides across the fixture — five rows, five ids', () => {
    const rows = [READY_DAY, READY_RECEIPT, READY_DAY_NO_Z, READY_DAY_BHD, READY_RECEIPT_ORPHAN]
    expect(new Set(rows.map(readyRowId)).size).toBe(rows.length)
  })
})
