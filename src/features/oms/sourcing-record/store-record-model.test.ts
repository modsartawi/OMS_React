import { describe, expect, it } from 'vitest'
import type { StoreRecordReply } from '@/core/models/sourcing-store-record'
import fixture from './store-record.fixture.json'
import { carrierPairs, isBuilt, recordBoard } from './store-record-model'

const REPLY = fixture as StoreRecordReply

describe('the store record list, one tab per mode (ticket 969, owner: variant C)', () => {
  it('says the counted-from date once per mode: Dawaa Now counts from 2026-11-02', () => {
    expect(recordBoard(REPLY, 'SLOT').countedFrom).toBe('2026-08-29')
    expect(recordBoard(REPLY, 'DAWAA_NOW').countedFrom).toBe('2026-11-02')
  })

  it("lists a mode's measures in the spec's order with the channels each one counts", () => {
    const slot = recordBoard(REPLY, 'SLOT').measures
    expect(slot.map((m) => m.measure)).toEqual(['late', 'returned', 'cancelled'])
    expect(slot.map((m) => m.price)).toEqual([10, 25, 30])
    const pickUp = recordBoard(REPLY, 'PICK_UP').measures
    expect(pickUp.map((m) => m.measure)).toEqual(['neverMadeReady', 'cancelled', 'readyLate'])
    expect(pickUp.map((m) => m.channels)).toEqual([
      ['APP', 'SITE', 'CALL_CENTRE'],
      ['APP', 'SITE', 'CALL_CENTRE'],
      ['APP', 'SITE'],
    ])
  })

  it('says the like-store rate once per measure and band', () => {
    const late = recordBoard(REPLY, 'SLOT').measures[0]
    expect(late.likeByBand).toEqual({ UNDER_30: 0.052, FROM_30: 0.046, FROM_100: 0.041, FROM_300: 0.0377 })
    // No Dawaa Now store reached 300 deliveries in the window: that band has no like-store rate to say.
    const callout = recordBoard(REPLY, 'DAWAA_NOW').measures[0]
    expect(callout.likeByBand).toEqual({ UNDER_30: 0.12, FROM_30: 0.105, FROM_100: 0.094, FROM_300: null })
  })

  it("gives a row per store with each measure's rate, like stores, deliveries and cost or credit, as sent", () => {
    const rows = recordBoard(REPLY, 'SLOT').rows
    expect(rows.map((r) => r.store)).toEqual(['P901', 'P902', 'P903', 'P904', 'P905', 'P906', 'P907', 'P908', 'P911'])
    const p901 = rows[0]
    expect(p901.cells[0]).toEqual({ measure: 'late', rate: 0.0314, ownRate: 0.031, likeStores: 0.0377, count: 612, bad: 19, cost: -0.063, neutral: null })
    expect(p901.cost).toBe(-0.287)
    expect(p901.band).toBe('FROM_300')
    expect(p901.slot?.usual).toBe(7)
    expect(p901.tillMoves).toEqual({ customerShare: 0.58, likeStores: 0.52, moves: 41 })
    expect(p901.shown).toEqual({ store: 'P901', lastCount: '2026-10-14', countFactor: 1.08, donorRefusals: 3 })
    expect(p901.neutral).toBe(false)
  })

  it('marks a measure that ran on the neutral default, and the row that holds one', () => {
    const p911 = recordBoard(REPLY, 'SLOT').rows.find((r) => r.store === 'P911')!
    expect(p911.cells.map((c) => c?.neutral)).toEqual(['NO_DELIVERIES', 'NO_DELIVERIES', 'NO_DELIVERIES'])
    expect(p911.cells.map((c) => c?.rate)).toEqual([null, null, null])
    expect(p911.neutral).toBe(true)
  })

  it('leaves a cell empty for a measure a pair does not carry, and appends a measure the spec does not list', () => {
    const reply: StoreRecordReply = {
      ...REPLY,
      pairs: [
        { ...REPLY.pairs[0], measures: [REPLY.pairs[0].measures[0], { ...REPLY.pairs[0].measures[0], measure: 'slotLoad', channels: ['APP'] }] },
        { ...REPLY.pairs[0], store: 'P999', measures: [{ ...REPLY.pairs[0].measures[1], channels: ['SITE', 'APP'] }] },
      ],
    }
    const board = recordBoard(reply, 'SLOT')
    expect(board.measures.map((m) => m.measure)).toEqual(['late', 'returned', 'slotLoad'])
    expect(board.measures[1].channels).toEqual(['APP', 'SITE'])
    expect(board.rows[0].cells.map((c) => c?.measure ?? null)).toEqual(['late', null, 'slotLoad'])
    expect(board.rows[1].cells.map((c) => c?.measure ?? null)).toEqual([null, 'returned', null])
  })

  it('lists the pairs of the modes that keep no record apart, each on the neutral default', () => {
    expect(carrierPairs(REPLY).map((p) => `${p.store} ${p.mode}`)).toEqual([
      'P901 CARRIER_SAME_DAY',
      'P901 CARRIER_NEXT_DAY',
      'P901 BEYOND_BORDER',
      'P907 CARRIER_SAME_DAY',
      'P907 CARRIER_NEXT_DAY',
      'P907 BEYOND_BORDER',
    ])
  })

  it('reads a record the nightly pass never built as not built', () => {
    expect(isBuilt(REPLY)).toBe(true)
    expect(isBuilt({ builtAt: null, windowFrom: null, windowTo: null, pairs: [], shown: [] })).toBe(false)
    expect(isBuilt(null)).toBe(false)
  })
})
