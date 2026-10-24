/**
 * Ticket 547 — an ended session as the Ended tab draws it: its end in words, its sales or "never
 * invoiced", "was owed", and its after-close lines read by 544's core `afterCloseLine`. Pure.
 */
import { describe, expect, it } from 'vitest'
import type { PrescriptionSessionHqEndedRow } from '@/core/models/prescription-session'
import { endedRow } from './ended-row'

const row = (over: Partial<PrescriptionSessionHqEndedRow> = {}): PrescriptionSessionHqEndedRow => ({
  sessionId: '41',
  displayId: 'PS-41',
  sourceKind: 'NPHS',
  holdingStore: 'P001',
  state: 'CLOSED',
  route: 'COUNTER',
  createdAt: '2026-10-10T09:00:00',
  dispensedAt: '2026-10-11T12:00:00',
  endedAt: '2026-10-12T18:00:00',
  endedBy: 'ph.ali',
  endReason: null,
  endNote: null,
  invoiceOwedAt: null,
  saleNos: ['1000123'],
  wasInvoiced: true,
  afterClose: [],
  ...over,
})

describe('endedRow', () => {
  it('a closed session reads its state, source and route, its sale, and no reason', () => {
    const v = endedRow(row())
    expect(v.state).toEqual({ key: 'state.CLOSED', raw: 'CLOSED' })
    expect(v.stateSev).toBe('ok')
    expect(v.source).toEqual({ key: 'source.NPHS', raw: 'NPHS' })
    expect(v.route).toEqual({ key: 'route.COUNTER', raw: 'COUNTER' })
    expect(v.endReason).toBeNull()
    expect(v.sales).toEqual(['1000123'])
    expect(v.neverInvoiced).toBe(false)
    expect(v.wasOwed).toBe(false)
  })

  it('an abandoned session reads its abandon reason; no sale is "never invoiced"', () => {
    const v = endedRow(row({ state: 'ABANDONED', endReason: 'PATIENT_WITHDREW', saleNos: [], wasInvoiced: false, route: null }))
    expect(v.endReason).toEqual({ key: 'abandonReason.PATIENT_WITHDREW', raw: 'PATIENT_WITHDREW' })
    expect(v.neverInvoiced).toBe(true)
    expect(v.sales).toEqual([])
    expect(v.route).toEqual({ key: 'route.notChosen', raw: '' })
    expect(v.stateSev).toBe('mute')
  })

  it('a written-off session reads its write-off reason and keeps its note as written', () => {
    const v = endedRow(row({ state: 'WRITTEN_OFF', endReason: 'OTHER', endNote: '  رفض المريض الاستلام ', saleNos: [] }))
    expect(v.endReason).toEqual({ key: 'writeOffReason.OTHER', raw: 'OTHER' })
    expect(v.endNote).toBe('رفض المريض الاستلام')
    expect(v.stateSev).toBe('bad')
  })

  it('an unknown reason renders itself', () => {
    expect(endedRow(row({ state: 'WRITTEN_OFF', endReason: 'FLOODED' })).endReason).toEqual({ key: null, raw: 'FLOODED' })
  })

  it('a blank note is no note', () => {
    expect(endedRow(row({ endNote: '   ' })).endNote).toBeNull()
  })

  it('"was owed" when its business day ended owed, even though it was invoiced later', () => {
    const v = endedRow(row({ invoiceOwedAt: '2026-10-11T23:59:00' }))
    expect(v.wasOwed).toBe(true)
    expect(v.neverInvoiced).toBe(false)
  })

  it('a re-sold session lists both sales, in the server’s order', () => {
    expect(endedRow(row({ saleNos: ['1000123', '1000999'] })).sales).toEqual(['1000123', '1000999'])
  })

  it('"never invoiced" follows the sales, not the flag alone', () => {
    expect(endedRow(row({ saleNos: [], wasInvoiced: true })).neverInvoiced).toBe(true)
    expect(endedRow(row({ saleNos: undefined as unknown as string[] })).neverInvoiced).toBe(true)
  })

  it('its after-close lines are 544’s lines: kind, sentence and values', () => {
    const v = endedRow(
      row({
        afterClose: [
          { kind: 'RETURN', originalSaleNo: '1000123', documentNo: '7000001', resaleNo: null, storeCode: 'P001', recordedAt: '2026-10-13T10:00:00', recordedBy: 'ph.ali' },
          { kind: 'RESALE', originalSaleNo: '1000123', documentNo: '1000999', resaleNo: '1000999', storeCode: 'P001', recordedAt: '2026-10-13T10:05:00', recordedBy: 'ph.ali' },
          { kind: 'SWAP', originalSaleNo: '1000123', documentNo: '9', resaleNo: null, storeCode: 'P001', recordedAt: '2026-10-13T10:06:00', recordedBy: '' },
        ],
      }),
    )
    expect(v.afterClose.map((l) => [l.kind.raw, l.sentence, l.document, l.resale])).toEqual([
      ['RETURN', 'afterClose.line.RETURN', '7000001', ''],
      ['RESALE', 'afterClose.line.RESALE', '1000999', '1000999'],
      ['SWAP', 'afterClose.line.other', '9', ''],
    ])
    expect(v.afterClose[0]).toMatchObject({ sale: '1000123', storeCode: 'P001', recordedAt: '2026-10-13T10:00:00', recordedBy: 'ph.ali' })
  })

  it('no after-close array reads as none', () => {
    expect(endedRow(row({ afterClose: undefined as unknown as [] })).afterClose).toEqual([])
  })
})
