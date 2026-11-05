/**
 * The Order / ERX list's lenses (ticket 786): All / Bupa Care Connect (type BUPA, source ERX) /
 * No delivery yet / CHANNEL / ENGINE, each a predicate over the LOADED rows, its count honest
 * about a page that came back full.
 */
import { describe, expect, it } from 'vitest'
import type { OrderDocumentRow } from '@/core/models/order-document'
import { LENS_IDS, lensCounts, lensMatches, type LensId } from './lenses'

const row = (documentNo: string, over: Partial<OrderDocumentRow> = {}): OrderDocumentRow => ({
  orderNo: `ORD-${documentNo}`,
  documentNo,
  documentCategory: 'O',
  documentType: 'CLCN',
  documentTypeDescription: 'Call centre',
  documentSource: 'CC',
  documentSourceDescription: 'Call centre',
  storeCode: '1101',
  customerName: 'Sara',
  customerPhone: '0551234567',
  entryTime: '2026-11-05T10:00:00',
  status: 'OPEN',
  statusDescription: 'Open',
  closeStatus: '',
  netTotal: 100,
  amountDue: 100,
  deliveryNo: '9000001',
  isInsuranceOrder: false,
  moneySource: null,
  patientTotal: null,
  insurerTotal: null,
  ...over,
})

// The Bupa Care Connect order of 3389 (1006358459): BUPA from ERX, no delivery yet, on the engine.
const bupa = row('1006358459', {
  documentCategory: 'X',
  documentType: 'BUPA',
  documentSource: 'ERX',
  deliveryNo: null,
  isInsuranceOrder: true,
  moneySource: 'ENGINE',
  patientTotal: 12.5,
  insurerTotal: 87.5,
})
const bupaNotErx = row('1006358460', { documentType: 'BUPA', documentSource: 'CC', isInsuranceOrder: true, moneySource: 'CHANNEL' })
const erxNotBupa = row('1006358461', { documentType: 'CLCN', documentSource: 'ERX' })
const plain = row('1006358462')

const matching = (lens: LensId) =>
  [bupa, bupaNotErx, erxNotBupa, plain].filter((r) => lensMatches(lens, r)).map((r) => r.documentNo)

describe('order-list lenses: Bupa Care Connect / No delivery yet / CHANNEL / ENGINE match their rows', () => {
  it('has the five lenses in rail order', () => {
    expect(LENS_IDS).toEqual(['all', 'bupaCareConnect', 'noDelivery', 'channel', 'engine'])
  })

  it('Bupa Care Connect is type BUPA from source ERX — both, not either', () => {
    expect(matching('bupaCareConnect')).toEqual(['1006358459'])
  })

  it('No delivery yet is an order with no latest delivery', () => {
    expect(matching('noDelivery')).toEqual(['1006358459'])
    expect(lensMatches('noDelivery', row('1', { deliveryNo: '' }))).toBe(true)
  })

  it('CHANNEL and ENGINE are the insurance order’s money source; a non-insurance order is neither', () => {
    expect(matching('channel')).toEqual(['1006358460'])
    expect(matching('engine')).toEqual(['1006358459'])
  })

  it('All is every loaded row', () => {
    expect(matching('all')).toHaveLength(4)
  })

  it('counts the loaded rows, and a full page makes every count a lower bound', () => {
    const rows = [bupa, bupaNotErx, erxNotBupa, plain]
    expect(lensCounts({ rows, limit: 500 })).toEqual({
      all: { key: 'exact', count: 4 },
      bupaCareConnect: { key: 'exact', count: 1 },
      noDelivery: { key: 'exact', count: 1 },
      channel: { key: 'exact', count: 1 },
      engine: { key: 'exact', count: 1 },
    })
    expect(lensCounts({ rows, limit: 4 }).engine).toEqual({ key: 'atLeast', count: 1 })
    expect(lensCounts(null).bupaCareConnect).toEqual({ key: 'none' })
  })
})
