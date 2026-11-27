/**
 * Ticket 988 (spec 983 D8): the read-back sentence the agent says before placing the
 * order — the items, the saving, the total, where, when and how they pay.
 *
 * Expected values are literals off fixture 02's own fields (two 8X4 sprays, 51.92
 * payable, cash on delivery), never re-derived the way the module derives them.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/callcenter.json'
import ar from '@/locales/ar/callcenter.json'
import type { SessionState } from '@/core/models/callcenter'
import { ATTACHED_SESSION } from './__fixtures__/payloads'
import { readBack, type ReadBackClause } from './read-back'

const HOME = {
  addressNumber: '2',
  label: 'Home',
  cityCode: 'RUH',
  cityName: 'Riyadh',
  districtCode: '011',
  districtName: 'Malqa',
  line: 'King Fahd Rd',
}

/** Fixture 02 delivered to Home, 16:00–18:00, with C1's saving. */
const DELIVER: SessionState = {
  ...ATTACHED_SESSION,
  header: {
    ...ATTACHED_SESSION.header,
    address: HOME,
    slot: { slotId: 'S16', from: '16:00', to: '18:00', isActive: true },
  },
  totals: { ...ATTACHED_SESSION.totals, beforeDiscount: 38.58, discount: 3.87 },
}

const COLLECT: SessionState = {
  ...DELIVER,
  header: { ...DELIVER.header, deliveryType: 'PickInStore', address: null, slot: null },
}

/** A clause as one readable string: its key and each slot's kind and value. */
const read = (clause: ReadBackClause) => {
  const values = Object.entries(clause.values).map(([slot, value]) =>
    value.kind === 'money' ? `${slot}=money:${value.amount}` : `${slot}=${value.kind}:${value.text}`,
  )
  const lines = clause.lines?.map((line) => `${line.qty}×${line.name}`) ?? []
  return [clause.key, ...lines, ...values].join(' ')
}
const sentence = (state: SessionState, lang = 'en') => readBack(state, lang).map(read)

describe('theSentenceFollowsTheOrder', () => {
  it('delivery: items, saving, total, the address label and the window, and how they pay', () => {
    expect(sentence(DELIVER)).toEqual([
      'readBack.items 2×8X4 DEO SPRAY MODN CHARM 150ML 1×8X4 DEO SPRAY MUSK/MARKNT 150M',
      'readBack.saving amount=money:3.87',
      'readBack.total amount=money:51.92',
      'readBack.where.deliverAt address=auto:Home window=ltr:16:00–18:00',
      'readBack.payment.cashOnDelivery',
    ])
  })

  it('collection: ready at the store (code · name, one machine pair), paid on collection, no window', () => {
    expect(sentence(COLLECT).slice(3)).toEqual([
      'readBack.where.collectFrom store=ltr:1001 · King AbdelAziz Road',
      'readBack.payment.payOnCollection',
    ])
  })

  it('no slot yet: the window is left out, not shown blank', () => {
    const noSlot = { ...DELIVER, header: { ...DELIVER.header, slot: null } }
    expect(sentence(noSlot)[3]).toBe('readBack.where.deliverTo address=auto:Home')
  })

  it('no address yet: delivery is said, with no "to" and no blank', () => {
    const noAddress = { ...DELIVER, header: { ...DELIVER.header, address: null, slot: null } }
    expect(sentence(noAddress)[3]).toBe('readBack.where.deliver')
  })

  it('no store yet under collection: collection is said, with no blank store', () => {
    const noStore = { ...COLLECT, header: { ...COLLECT.header, plant: '', plantName: '' } }
    expect(sentence(noStore)[3]).toBe('readBack.where.collect')
  })

  it('no payment the console can word yet: the payment clause is left out', () => {
    const receivable = { ...DELIVER, header: { ...DELIVER.header, paymentType: 'Receivable' as const } }
    expect(sentence(receivable).map((clause) => clause.split(' ')[0])).toEqual([
      'readBack.items',
      'readBack.saving',
      'readBack.total',
      'readBack.where.deliverAt',
    ])
  })

  it('no items and no saving: both clauses are left out; the total still stands', () => {
    const empty: SessionState = {
      ...DELIVER,
      lines: [],
      totals: { ...DELIVER.totals, discount: 0 },
    }
    expect(sentence(empty).map((clause) => clause.split(' ')[0])).toEqual([
      'readBack.total',
      'readBack.where.deliverAt',
      'readBack.payment.cashOnDelivery',
    ])
  })

  it('a v1.12 server (no discount) says no saving rather than finding one', () => {
    const v112 = { ...DELIVER, totals: ATTACHED_SESSION.totals }
    expect(sentence(v112).map((clause) => clause.split(' ')[0])).not.toContain('readBack.saving')
  })

  it('in Arabic the items take their Arabic name, and an item without one keeps its own', () => {
    const lines = [DELIVER.lines[0], { ...DELIVER.lines[1], description2: '  ' }]
    expect(sentence({ ...DELIVER, lines }, 'ar')[0]).toBe(
      'readBack.items 2×8×4 بخاخ مودرن حريمى مزيل عرق 150مل 1×8X4 DEO SPRAY MUSK/MARKNT 150M',
    )
  })

  it('every key it can name is worded in English and in Arabic', () => {
    const states = [
      DELIVER,
      COLLECT,
      { ...DELIVER, header: { ...DELIVER.header, slot: null } },
      { ...DELIVER, header: { ...DELIVER.header, address: null, slot: null } },
      { ...COLLECT, header: { ...COLLECT.header, plant: '', plantName: '' } },
      { ...DELIVER, header: { ...DELIVER.header, paymentType: 'Online' as const } },
    ]
    const keys = new Set(states.flatMap((state) => readBack(state, 'en').map((clause) => clause.key)))
    keys.add('readBack.line')
    keys.add('readBack.heading')
    const lookup = (json: unknown, key: string) =>
      key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], json)
    for (const key of keys) {
      expect(typeof lookup(en, key), `en ${key}`).toBe('string')
      expect(typeof lookup(ar, key), `ar ${key}`).toBe('string')
    }
  })
})

describe('theTotalIsThePayable', () => {
  it('🚩 the total is totals.payable verbatim, even when nothing adds up to it', () => {
    // 1 is not net + vat + fee, nor gross + fee: a sentence that summed would say otherwise.
    const odd = { ...DELIVER, totals: { ...DELIVER.totals, payable: 1, discount: 7 } }
    const clauses = sentence(odd)
    expect(clauses).toContain('readBack.total amount=money:1')
    expect(clauses).toContain('readBack.saving amount=money:7')
  })
})
