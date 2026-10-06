import { describe, expect, it } from 'vitest'
import type { DepositInquiryLine } from '@/core/models/collection'
import { acrNoText, shownAcrNo } from './acr-number'

// Ticket 425 (ADR 0066) — which ACR number to show, read by the grid and a
// deposit's lines. The server formats the number; this
// module only chooses between what the server sent.

describe('shownAcrNo', () => {
  it('shows the server’s acrNo as sent — full or legacy', () => {
    expect(shownAcrNo('6498-2610-0001', '1')).toBe('6498-2610-0001')
    expect(shownAcrNo('1834', '1834')).toBe('1834')
  })

  it('falls back only when acrNo is absent or blank', () => {
    expect(shownAcrNo(undefined, '1834')).toBe('1834')
    expect(shownAcrNo(null, '1834')).toBe('1834')
    expect(shownAcrNo('  ', '1834')).toBe('1834')
  })
})

describe('a deposit line keeps the number it was deposited under', () => {
  const line = (over: Partial<DepositInquiryLine>): DepositInquiryLine => ({
    acrId: '01J0ACR0000000000000000041',
    acrNumber: 1,
    acrDate: '2026-10-03T00:00:00',
    netCollectedAtDeposit: 100,
    netCollectedNow: 100,
    drift: 0,
    hasDrift: false,
    ...over,
  })

  it('shows the snapshot acrNo (BackOffice 2428)', () => {
    expect(acrNoText(line({ acrNo: '6498-2610-0001' }))).toBe('6498-2610-0001')
  })

  it('shows a legacy line’s plain number, and the bare count from an older SIS.Api', () => {
    expect(acrNoText(line({ acrNumber: 1834, acrNo: '1834' }))).toBe('1834')
    expect(acrNoText(line({ acrNumber: 1834 }))).toBe('1834')
  })

  it('renders nothing rather than crashing on a missing line', () => {
    expect(acrNoText(undefined)).toBe('')
  })
})
