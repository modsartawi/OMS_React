import { describe, expect, it } from 'vitest'
import type { StoreRecordReply } from '@/core/models/sourcing-store-record'
import fixture from './store-record.fixture.json'
import { dateOf, isBuilt, recordBoard, slotHours } from './store-record-model'

// The fixture is `GET SourcingAdvisor/StoreRecords`' `data` in the server's shape (BackOffice 4373, `StoreRecordListReply`).
const REPLY = fixture as StoreRecordReply

describe('the store record list, one tab per mode (ticket 969, owner: variant C; BackOffice 4373)', () => {
  it('says the counted-from date once per mode, as a date: Dawaa Now counts from 2026-11-02', () => {
    expect(recordBoard(REPLY, 'SLOT').countedFrom).toBe('2026-08-29')
    expect(recordBoard(REPLY, 'DAWAA_NOW').countedFrom).toBe('2026-11-02')
  })

  it("lists a mode's measures in the spec's order with the channels each one counts, as sent", () => {
    const slot = recordBoard(REPLY, 'SLOT').measures
    expect(slot.map((m) => m.measure)).toEqual(['LATE', 'RETURNED', 'CANCELLED'])
    const pickUp = recordBoard(REPLY, 'PICK_UP').measures
    expect(pickUp.map((m) => m.measure)).toEqual(['NEVER_READY', 'CANCELLED', 'READY_LATE'])
    expect(pickUp.map((m) => m.channels)).toEqual([
      ['IOS', 'ROID', 'WEB', 'category C'],
      ['IOS', 'ROID', 'WEB', 'category C'],
      ['IOS', 'ROID', 'WEB'],
    ])
  })

  it("says the like-store rate once per measure and band, read off the stores' bands", () => {
    const late = recordBoard(REPLY, 'SLOT').measures[0]
    // P911 sits in band 0, P902 in band 2, P901 in band 3; no slot store falls in band 1.
    expect(late.likeByBand).toEqual({ UNDER_30: 0.052, FROM_30: null, FROM_100: 0.041, FROM_300: 0.0377 })
  })

  it("gives a row per store with each measure's steadied, own and like-store rate and the deliveries behind it, as sent", () => {
    const rows = recordBoard(REPLY, 'SLOT').rows
    expect(rows.map((r) => r.store)).toEqual(['P901', 'P902', 'P911'])
    const p901 = rows[0]
    expect(p901.city).toBe('RUH')
    expect(p901.cells[0]).toEqual({ measure: 'LATE', steadied: 0.0314, own: 0.031, like: 0.0377, deliveries: 612, bad: 19, band: 'FROM_300', neutral: false })
    expect(p901.deliveries).toBe(612)
    expect(p901.fallback).toBe(0)
    expect(p901.slot).toEqual({ usual: 7, regularHours: ['10', '12', '16'], tillMoves: 41, tillMovesCustomer: 24 })
    expect(p901.neutral).toBe(false)
  })

  it('reads no usual slot (0) as none', () => {
    const p902 = recordBoard(REPLY, 'SLOT').rows.find((r) => r.store === 'P902')!
    expect(p902.slot).toEqual({ usual: null, regularHours: [], tillMoves: 0, tillMovesCustomer: 0 })
  })

  it('marks a measure that ran on the neutral default, and the row that holds one', () => {
    const p911 = recordBoard(REPLY, 'SLOT').rows.find((r) => r.store === 'P911')!
    expect(p911.cells.map((c) => c?.neutral)).toEqual([true, true, true])
    expect(p911.neutral).toBe(true)
  })

  it("keeps a Dawaa Now store's callout fallback count, left out of its record", () => {
    expect(recordBoard(REPLY, 'DAWAA_NOW').rows.map((r) => [r.store, r.fallback])).toEqual([
      ['P901', 4],
      ['P907', 0],
    ])
  })

  it('leaves a cell empty for a measure a pair does not carry, and appends a measure the spec does not list', () => {
    const [p901] = REPLY.pairs.filter((p) => p.mode === 'SLOT')
    const late = p901.measures.find((m) => m.measure === 'LATE')!
    const returned = p901.measures.find((m) => m.measure === 'RETURNED')!
    const reply: StoreRecordReply = {
      ...REPLY,
      pairs: [
        { ...p901, measures: [late, { ...late, measure: 'SLOT_LOAD' }] },
        { ...p901, storeCode: 'P999', measures: [returned] },
      ],
    }
    const board = recordBoard(reply, 'SLOT')
    expect(board.measures.map((m) => m.measure)).toEqual(['LATE', 'RETURNED', 'SLOT_LOAD'])
    expect(board.rows[0].cells.map((c) => c?.measure ?? null)).toEqual(['LATE', null, 'SLOT_LOAD'])
    expect(board.rows[1].cells.map((c) => c?.measure ?? null)).toEqual([null, 'RETURNED', null])
  })

  it('reads a record the nightly pass never built as not built', () => {
    expect(isBuilt(REPLY)).toBe(true)
    expect(isBuilt({ builtAt: null, windowFrom: null, windowTo: null, pairs: [] })).toBe(false)
    expect(isBuilt(null)).toBe(false)
  })

  it('reads the web JSON times as they are written: a date is the first ten characters, a time drops the T', () => {
    expect(dateOf('2026-08-29T00:00:00')).toBe('2026-08-29')
    expect(dateOf(null)).toBe('')
    expect(slotHours('10,12,16')).toEqual(['10', '12', '16'])
    expect(slotHours('')).toEqual([])
  })
})
