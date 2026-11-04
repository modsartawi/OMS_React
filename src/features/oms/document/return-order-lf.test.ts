/**
 * The return screen's LOCAL FULFILLMENT mode (spec 759 F3, ticket 761). Its own file so the bonded
 * suite (`return-order.test.ts`, spec 289 / tickets 290-294) stays byte-for-byte unchanged.
 */
import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/core/api'
import { OMS_ACCESS_KEY, revokeOnForbidden } from '@/core/oms/api'
import { omsGrants } from '@/core/oms/access'
import type { OmsAccessResult } from '@/core/models/oms-access'
import {
  RETURN_GRANT,
  buildCreateReturnRequest,
  pickupAddressFrom,
  refundableFees,
  returnableLines,
  submitGate,
} from './return-order'
import { DELIVERY_WITH_ADDRESS } from './__fixtures__/return-lines'
import type { TransactionConditionModel } from '@/core/models/sd-document'
import { PAYLOADS } from './__fixtures__/payloads'

const BASE_CONDITION = PAYLOADS['8000000253'].conditions[0]
/** A condition of the real captured shape; `condValue` at the header row's structural `0`. */
const condition = (
  condDocumentLine: number,
  condType: string,
  condCategory: string,
  condAmount: number,
  originOfCond: string,
  over: Partial<TransactionConditionModel> = {},
): TransactionConditionModel => ({
  ...BASE_CONDITION,
  condDocumentLine,
  condType,
  conditionDescription: condType === 'FLFD' ? 'Local Fulfillment Delivery Fee' : 'Delivery Fees',
  condCategory,
  condAmount,
  condValue: 0,
  originOfCond,
  ...over,
})

/** An LF delivery's conditions: the FLFD header row, its distributed copy, and a bonded-style DFEE. */
const LF_CONDITIONS = [
  condition(0, 'FLFD', 'F', 15, 'M'),
  condition(0, 'DFEE', 'F', 12, 'M'),
  condition(0, 'PTPA', 'P', 0, 'M'),
  condition(10, 'FLFD', 'F', 15, 'H'),
]

const picked = (quantity: number | null) => ({ picked: true, quantity })

describe('submitGate in LF mode (ticket 761)', () => {
  it('submitGate in LF mode opens without a reason — and the bonded gate still demands one', () => {
    expect(submitGate([picked(2)], null, 0, 'lf')).toEqual({
      ok: true,
      key: 'returnDocument.gate.summary',
      params: { count: 1 },
    })
    // The bonded gate, by default and by name, still stops on an unchosen reason.
    expect(submitGate([picked(2)], null).key).toBe('returnDocument.gate.chooseReason')
    expect(submitGate([picked(2)], null, 0, 'bonded').key).toBe('returnDocument.gate.chooseReason')
  })

  it('still names the lines and the quantity sentences first in LF mode', () => {
    expect(submitGate([{ picked: false, quantity: null }], null, 0, 'lf').key).toBe('returnDocument.gate.selectLines')
    expect(submitGate([picked(null)], null, 0, 'lf').key).toBe('returnDocument.gate.quantityAtLeastOne')
    expect(submitGate([picked(0)], null, 1, 'lf')).toEqual({ ok: false, key: 'returnDocument.gate.quantityAtLeastOne' })
  })

  it('counts a ticked FLFD in the LF summary — 1 line · 1 fee', () => {
    expect(submitGate([picked(1)], null, 1, 'lf').fees).toEqual({
      key: 'returnDocument.gate.summaryFees',
      params: { count: 1 },
    })
  })
})

describe('refundableFees in LF mode (ticket 761)', () => {
  it('refundableFees offers FLFD at its condAmount — a condValue-only row is not a zero fee', () => {
    expect(refundableFees(LF_CONDITIONS, 'lf')).toEqual([
      { condType: 'FLFD', description: 'Local Fulfillment Delivery Fee', amount: 15 },
    ])
    // The other direction of the same rule: a row whose figure sits on condValue alone is read off
    // condAmount all the same — the rate is never taken from condValue, in either direction.
    const valueOnly = [condition(0, 'FLFD', 'F', 0, 'M', { condValue: 40 })]
    expect(refundableFees(valueOnly, 'lf').map((fee) => fee.amount)).toEqual([0])
    expect(refundableFees(valueOnly, 'lf').map((fee) => fee.amount)).not.toContain(40)
  })

  it('offers FLFD and nothing else — the server allocates no other fee on an LF return (3369 D4)', () => {
    expect(refundableFees(LF_CONDITIONS, 'lf').map((fee) => fee.condType)).toEqual(['FLFD'])
    // The distributed copy is neither offered nor summed.
    expect(refundableFees(LF_CONDITIONS, 'lf')).toHaveLength(1)
    // Matched by its type, so a blank category (the 8000000121 capture's shape) still offers it.
    expect(refundableFees([condition(0, 'FLFD ', '', 15, 'M')], 'lf').map((fee) => fee.condType)).toEqual(['FLFD'])
  })

  it('leaves the bonded projection as it was — FLFD is not a bonded offer by type', () => {
    expect(refundableFees(LF_CONDITIONS).map((fee) => fee.condType)).toEqual(['FLFD', 'DFEE'])
    expect(refundableFees(LF_CONDITIONS, 'bonded').map((fee) => fee.condType)).toEqual(['FLFD', 'DFEE'])
    expect(refundableFees(null, 'lf')).toEqual([])
  })
})

describe('buildCreateReturnRequest on an LF draft (ticket 761)', () => {
  const ROWS = returnableLines(DELIVERY_WITH_ADDRESS.lines).rows
  const FEES = refundableFees(LF_CONDITIONS, 'lf')
  const ADDRESS = pickupAddressFrom(DELIVERY_WITH_ADDRESS.shippingAddress)
  const lfDraft = (over: Partial<Parameters<typeof buildCreateReturnRequest>[0]> = {}) =>
    buildCreateReturnRequest({
      mode: 'lf',
      requestId: 'req-lf-01',
      refDeliveryNo: '8100000001',
      reason: 'RTRF',
      rows: ROWS,
      selections: { 10: { picked: true, quantity: 4 } },
      fees: FEES,
      feePicks: {},
      address: ADDRESS,
      note: '',
      ...over,
    })

  it('buildCreateReturnRequest on an LF draft carries the Return-and-Refund reason', () => {
    const body = lfDraft()
    expect(body.reason).toBe('RTRF')
    expect(body.shippingAddress).toEqual(ADDRESS)
    // Even a draft that somehow says RF posts RTRF — and keeps its pickup address: there is no LF
    // refund that skips collection (3369 D3), so the body cannot ask for one.
    const forced = lfDraft({ reason: 'RF' })
    expect(forced.reason).toBe('RTRF')
    expect(forced.shippingAddress).toEqual(ADDRESS)
  })

  it('carries FLFD by type when ticked, and nothing when it is not', () => {
    expect(lfDraft().conditionTypes).toEqual([])
    expect(lfDraft({ feePicks: { FLFD: true } }).conditionTypes).toEqual(['FLFD'])
    // A DFEE tick cannot ride along: the LF projection never offered it.
    expect(lfDraft({ feePicks: { FLFD: true, DFEE: true } }).conditionTypes).toEqual(['FLFD'])
  })

  it('the whole-body walk finds no amount on an LF body', () => {
    const body = lfDraft({
      selections: { 10: { picked: true, quantity: 4 }, 20: { picked: true, quantity: 3 } },
      feePicks: { FLFD: true },
      note: 'customer changed their mind',
    })
    const keys: string[] = []
    const numbers: number[] = []
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk)
      if (typeof value === 'number') return void numbers.push(value)
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          keys.push(key)
          walk(child)
        }
      }
    }
    walk(JSON.parse(JSON.stringify(body)))

    const money = /price|amount|discount|vat|tax|total|charge|refund|money|cost|rate|net|gross/i
    expect(keys.filter((key) => money.test(key))).toEqual([])
    // Two line numbers, two quantities and the GPS pair — nothing else is a number.
    expect([...numbers].sort((a, b) => a - b)).toEqual([10, 4, 20, 3, ADDRESS.gpsLat, ADDRESS.gpsLon].sort((a, b) => a - b))
    // FLFD's displayed rate (15) and the unit prices stay on the screen.
    const displayed = FEES.map((fee) => fee.amount).concat(ROWS.map((row) => row.unitPrice))
    expect(displayed).toContain(15)
    expect(numbers.filter((n) => displayed.includes(n))).toEqual([])
    // And no mode marker leaks onto the wire: the body is 289's, unchanged (3369 §Wire).
    expect(Object.keys(body).sort()).toEqual(
      ['conditionTypes', 'lines', 'note', 'reason', 'refDeliveryNo', 'requestId', 'shippingAddress'].sort(),
    )
  })
})

describe('a 403 from the create door revokes the grant of the return being raised (760 open item)', () => {
  const seeded = () => {
    const client = new QueryClient()
    client.setQueryData<OmsAccessResult>(OMS_ACCESS_KEY, {
      canOpenList: true,
      canOpenDetail: true,
      canCreateReturn: true,
      canCreateLocalFulfillmentReturn: true,
    })
    return client
  }
  const grantsOf = (client: QueryClient) => omsGrants(client.getQueryData<OmsAccessResult>(OMS_ACCESS_KEY))
  const forbidden = new ApiError('unknown', 'Forbidden', 403)

  it('an LF 403 revokes the LF grant, never the bonded one', () => {
    const client = seeded()
    revokeOnForbidden(client, forbidden, RETURN_GRANT.lf)
    expect(grantsOf(client).canCreateLocalFulfillmentReturn).toBe(false)
    expect(grantsOf(client).canCreateReturn).toBe(true)
  })

  it('a bonded 403 still revokes the bonded grant, and leaves the LF one', () => {
    const client = seeded()
    revokeOnForbidden(client, forbidden, RETURN_GRANT.bonded)
    expect(grantsOf(client).canCreateReturn).toBe(false)
    expect(grantsOf(client).canCreateLocalFulfillmentReturn).toBe(true)
  })
})
