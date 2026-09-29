/**
 * The central-invoice list's pure pieces (ticket 333): what it asks the server, and how it
 * reads a row back.
 */
import { describe, expect, it } from 'vitest'
import type { CentralInvoiceListRow } from '@/core/models/central-invoice'
import { criteriaProblem, defaultListCriteria, listParams, type CentralInvoiceListCriteria } from './list-criteria'
import { hasSerialDetail, pickOutcomeOf, serialLines, statusOf } from './list-rows'

const criteria = (patch: Partial<CentralInvoiceListCriteria> = {}): CentralInvoiceListCriteria => ({
  from: '2026-09-01',
  to: '2026-09-29',
  dateBasis: 'requested',
  store: '',
  status: '',
  ...patch,
})

const row = (patch: Partial<CentralInvoiceListRow> = {}): CentralInvoiceListRow => ({
  id: '01K',
  deliveryNo: '8006456897',
  storeCode: 'P983',
  requestedBy: 'msartawi',
  requestedAt: '2026-09-29T10:15:00',
  reason: 'Rollout',
  status: 'BILLED',
  refusalCode: '',
  trxNumber: 'I8006456897',
  invoiceTotal: 151.5,
  cashRemainder: 51.5,
  pickDocumentNo: 'P-000123',
  pickOutcome: 'CONSUMED',
  billedAt: '2026-09-29T10:20:00',
  country: 'SA',
  serialisedInGs1Market: true,
  serials: [],
  ...patch,
})

const serial = (serialNumber: string) => ({
  pickDocumentNo: 'P-000123',
  gtin: '06281234567890',
  serialNumber,
  batchLot: 'B1',
  expiryDate: '271231',
})

describe('defaultListCriteria', () => {
  it('lands on the last 30 days of requests, today included, every store and status', () => {
    expect(defaultListCriteria(new Date(2026, 8, 29, 17, 45))).toEqual({
      from: '2026-08-31',
      to: '2026-09-29',
      dateBasis: 'requested',
      store: '',
      status: '',
    })
  })

  it('counts back across a year end on local days', () => {
    expect(defaultListCriteria(new Date(2027, 0, 10)).from).toBe('2026-12-12')
  })
})

describe('criteriaProblem', () => {
  it('passes a range, a one-day range and either end left open', () => {
    expect(criteriaProblem(criteria())).toBeNull()
    expect(criteriaProblem(criteria({ from: '2026-09-29', to: '2026-09-29' }))).toBeNull()
    expect(criteriaProblem(criteria({ from: '' }))).toBeNull()
    expect(criteriaProblem(criteria({ from: '', to: '' }))).toBeNull()
  })

  it('refuses a range that ends before it starts — the server would 400 it', () => {
    expect(criteriaProblem(criteria({ from: '2026-09-29', to: '2026-09-28' }))).toBe('reversed')
  })

  it('refuses a billing-day range asked of a status that is never billed — the server returns nothing', () => {
    expect(criteriaProblem(criteria({ dateBasis: 'billed', status: 'STRANDED' }))).toBe('billedStatus')
    expect(criteriaProblem(criteria({ dateBasis: 'billed', status: 'QUEUED' }))).toBe('billedStatus')
    expect(criteriaProblem(criteria({ dateBasis: 'billed', status: 'BILLED' }))).toBeNull()
    expect(criteriaProblem(criteria({ dateBasis: 'billed', status: '' }))).toBeNull()
    expect(criteriaProblem(criteria({ dateBasis: 'requested', status: 'STRANDED' }))).toBeNull()
  })

  it('refuses an end that is not a date', () => {
    expect(criteriaProblem(criteria({ to: '2026-9-1' }))).toBe('badDate')
  })
})

describe('listParams', () => {
  it('names every parameter as the endpoint binds it, the store trimmed', () => {
    expect(listParams(criteria({ dateBasis: 'billed', store: '  P983 ', status: 'STRANDED' }))).toEqual({
      from: '2026-09-01',
      to: '2026-09-29',
      dateBasis: 'billed',
      store: 'P983',
      status: 'STRANDED',
    })
  })
})

describe('statusOf / pickOutcomeOf', () => {
  it('reads the server’s spellings exactly, and nothing else as one of them', () => {
    expect(['QUEUED', 'BILLED', 'STRANDED'].map(statusOf)).toEqual(['QUEUED', 'BILLED', 'STRANDED'])
    expect(statusOf('billed')).toBe('unknown')
    expect(statusOf('')).toBe('unknown')
  })

  it('reads a blank outcome as not-yet, never as NONE', () => {
    expect(pickOutcomeOf('')).toBe('pending')
    expect(pickOutcomeOf('NONE')).toBe('NONE')
    expect(pickOutcomeOf('CONSUMED')).toBe('CONSUMED')
    expect(pickOutcomeOf('consumed')).toBe('unknown')
  })
})

describe('hasSerialDetail', () => {
  it('opens for a row that carries serials', () => {
    expect(hasSerialDetail(row({ serials: [serial('S1')] }))).toBe(true)
  })

  it('🚩 opens for a GS1 row with a consumed document even with no serials — "none" is an answer', () => {
    expect(hasSerialDetail(row({ serials: [] }))).toBe(true)
  })

  it('stays shut for a row with nothing to show', () => {
    expect(hasSerialDetail(row({ serialisedInGs1Market: false }))).toBe(false)
    expect(hasSerialDetail(row({ pickOutcome: 'VOIDED' }))).toBe(false)
    expect(hasSerialDetail(row({ status: 'QUEUED', pickOutcome: '' }))).toBe(false)
  })
})

describe('serialLines', () => {
  it('is one line per pack, each naming its delivery, invoice, store, country and GS1 flag, in row order', () => {
    const lines = serialLines([
      row({ serials: [serial('S1'), serial('S2')] }),
      row({ deliveryNo: '8006456512', trxNumber: 'I8006456512', serials: [] }),
      row({
        deliveryNo: '8006473324',
        trxNumber: 'I8006473324',
        storeCode: 'B010',
        country: 'BH',
        serialisedInGs1Market: false,
        serials: [serial('S3')],
      }),
    ], (flagged) => (flagged ? 'GS1' : 'no'))
    expect(lines).toEqual([
      ['8006456897', 'I8006456897', 'P983', 'SA', 'P-000123', '06281234567890', 'S1', 'B1', '271231', 'GS1'],
      ['8006456897', 'I8006456897', 'P983', 'SA', 'P-000123', '06281234567890', 'S2', 'B1', '271231', 'GS1'],
      ['8006473324', 'I8006473324', 'B010', 'BH', 'P-000123', '06281234567890', 'S3', 'B1', '271231', 'no'],
    ])
  })
})
