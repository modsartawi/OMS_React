/**
 * BackOffice ticket 4224 — the parked-returns doors' answers read field by field (BackOffice 4218's contract): optional
 * times read as '', a return the store never mirrored has no header, and nothing beyond the agreed fields is kept.
 */
import { describe, expect, it } from 'vitest'
import { readDetail, readListPage } from './wire'

describe('the list', () => {
  it('reads total, needs-HQ total and rows; a missing optional time is blank', () => {
    const page = readListPage({
      total: 2,
      needsHqTotal: 1,
      page: 1,
      pageSize: 50,
      rows: [
        {
          transactionId: 'T-1',
          storeCode: 'P077',
          registerId: '02',
          operatorId: 'C9',
          parkedAt: '2026-11-20T10:00:00',
          state: 'NEEDS_HQ',
          needsHqReasons: ['NO_STATUS_API', 'AGED'],
          storeDetailsReceived: false,
          mirrorStatus: '',
          partners: ['TABBY'],
          ledgerStatuses: ['PENDING'],
          grainCount: 1,
          refundAmount: 99.5,
          parkDeadline: null,
          escalated: true,
          cashRuled: false,
          lastSettledBy: null,
          lastSettledTime: null,
          secret: 'never kept',
        },
      ],
    })
    expect(page.total).toBe(2)
    expect(page.needsHqTotal).toBe(1)
    expect(page.rows).toStrictEqual([
      {
        transactionId: 'T-1',
        storeCode: 'P077',
        registerId: '02',
        operatorId: 'C9',
        parkedAt: '2026-11-20T10:00:00',
        state: 'NEEDS_HQ',
        needsHqReasons: ['NO_STATUS_API', 'AGED'],
        storeDetailsReceived: false,
        mirrorStatus: '',
        partners: ['TABBY'],
        ledgerStatuses: ['PENDING'],
        grainCount: 1,
        refundAmount: 99.5,
        parkDeadline: '',
        escalated: true,
        cashRuled: false,
        lastSettledBy: '',
        lastSettledTime: '',
      },
    ])
  })

  it('a malformed answer is an empty page', () => {
    expect(readListPage(null)).toEqual({ total: 0, needsHqTotal: 0, rows: [] })
  })
})

describe('the detail', () => {
  it('a return the store never mirrored has no header, and its grains still read', () => {
    const d = readDetail({
      transactionId: 'T-2',
      state: 'NEEDS_HQ',
      needsHqReasons: ['UNCHECKED_FAILURE'],
      storeDetailsReceived: false,
      resumeResolution: 'PENDING',
      canFinalize: false,
      header: null,
      lines: [],
      tenders: [],
      grains: [{ refundId: 'R1', partner: 'TAMARA', status: 'FAILED', amount: 12.345, awaitingHq: true, settledBy: null, cashReason: null }],
    })
    expect(d.header).toBeNull()
    expect(d.grains).toHaveLength(1)
    expect(d.grains[0]).toMatchObject({ refundId: 'R1', partner: 'TAMARA', status: 'FAILED', amount: 12.345, awaitingHq: true, settledBy: '', cashReason: '', cashRuled: false })
  })

  it('a mirrored return reads its header, lines and the slip’s refund reference', () => {
    const d = readDetail({
      transactionId: 'T-3',
      header: { storeCode: 'B001', currency: 'BHD', grandTotal: -4.125, parkReason: 'AMBIGUOUS_ANSWER', originalReceiptNumber: '000123' },
      lines: [{ lineNumber: 1, materialNumber: '100200', description: 'Panadol', quantity: -2, isVoided: false }],
      tenders: [{ tenderNumber: 1, tenderType: 'TABBY', amount: -4.125, isRefund: true, isParked: true, refundReference: 'SLIP-9' }],
    })
    expect(d.header).toMatchObject({ storeCode: 'B001', currency: 'BHD', grandTotal: -4.125, parkReason: 'AMBIGUOUS_ANSWER', originalReceiptNumber: '000123', customerId: '' })
    expect(d.lines[0]).toMatchObject({ lineNumber: 1, materialNumber: '100200', description: 'Panadol', quantity: -2 })
    expect(d.tenders[0]).toMatchObject({ refundReference: 'SLIP-9', isParked: true })
  })
})
