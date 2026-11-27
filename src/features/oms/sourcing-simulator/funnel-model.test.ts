/**
 * Ticket 966 (BackOffice spec 4354 §4, 4281 decisions 26–27): the funnel — every pair, then each filter step with the
 * pairs still standing, each step's removed pairs with their code and figures, and the cut. Fed a full-level reply in
 * the server's shape (`RecordFilterStep`, BackOffice 4379).
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { funnelOf } from './funnel-model'

const reply = fixture as unknown as AdviseReply

/** A run with more pairs in reach than the cap: 20 pairs cut, two of them listed. */
const withCut: AdviseReply = {
  ...reply,
  solve: { ...reply.solve, pairs: { beforeCut: 120, cut: 20, offered: 31 } },
  filterSteps: [
    { step: 5, code: 'OUT_OF_REACH', before: 140, after: 120, removedCount: 20, removed: [] },
    {
      step: 'CUT',
      code: 'OVER_PAIR_CAP',
      before: 120,
      after: 100,
      cap: 100,
      removedCount: 20,
      removed: [
        { store: '1311', mode: 'SLOT', km: 9.6, kmKind: 'STRAIGHT_LINE' },
        { store: '1312', mode: 'SLOT', km: 9.9, kmKind: 'STRAIGHT_LINE' },
      ],
    },
    { step: 11, code: 'NO_STOCK', before: 100, after: 31, removedCount: 69, removed: [] },
  ],
}

describe('the funnel', () => {
  it('starts from every pair and gives each step the pairs still standing after it, in the run’s order', () => {
    const f = funnelOf(reply)!
    expect(f.total).toBe(64)
    expect(f.rows.map((r) => [r.step, r.code, r.standing])).toEqual([
      ['ALL', null, 64],
      [1, 'MODE_OFF', 61],
      [5, 'OUT_OF_REACH', 47],
      ['CUT', 'OVER_PAIR_CAP', 47],
      [11, 'NO_STOCK', 19],
    ])
  })

  it('each step says how many pairs it took and lists the ones the record carries, with the rule’s figures', () => {
    const step5 = funnelOf(reply)!.rows.find((r) => r.step === 5)!
    expect(step5.removedCount).toBe(14)
    expect(step5.removed).toEqual([{ store: '1203', mode: 'DAWAA_NOW', km: 6.8, kmKind: 'ROAD', reachKm: 5.0 }])
    const step11 = funnelOf(reply)!.rows.find((r) => r.step === 11)!
    expect(step11.removedCount).toBe(28)
    expect(step11.removed[0]).toMatchObject({ store: '1061', mode: 'PICK_UP', lineNo: 3, offered: 0, asked: 1 })
  })

  it('a whole-store step carries no list at the middle level: its nearest five per mode stand for it; step 1 is never listed pair by pair', () => {
    const step1 = funnelOf(reply)!.rows.find((r) => r.step === 1)!
    expect(step1.removedCount).toBe(3)
    expect(step1.removed.map((r) => `${r.store} ${r.mode}`)).toEqual(['1055 CARRIER_SAME_DAY', '1061 CARRIER_SAME_DAY', '1090 CARRIER_SAME_DAY'])
  })

  it('draws each bar as the share of every pair still standing', () => {
    const rows = funnelOf(reply)!.rows
    expect(rows[0].fraction).toBe(1)
    expect(rows.at(-1)!.fraction).toBeCloseTo(19 / 64)
  })

  it('a run with no cut keeps the cut row but says nothing was cut', () => {
    const f = funnelOf(reply)!
    expect(f.cut).toEqual({ cap: 100, pairs: 0, code: 'OVER_PAIR_CAP', listed: [] })
    expect(f.rows.find((r) => r.step === 'CUT')!.removedCount).toBe(0)
  })

  it('a run with a cut says so: the pairs cut, the cap and the code', () => {
    const f = funnelOf(withCut)!
    expect(f.cut).toEqual({
      cap: 100,
      pairs: 20,
      code: 'OVER_PAIR_CAP',
      listed: [
        { store: '1311', mode: 'SLOT', km: 9.6, kmKind: 'STRAIGHT_LINE' },
        { store: '1312', mode: 'SLOT', km: 9.9, kmKind: 'STRAIGHT_LINE' },
      ],
    })
    expect(f.rows.map((r) => r.standing)).toEqual([140, 120, 100, 31])
  })

  it('ends at the pairs offered to the solver, as the solve sent it', () => {
    expect(funnelOf(reply)!.offered).toBe(19)
    expect(funnelOf(withCut)!.offered).toBe(31)
  })

  it('a reply below the middle level has no funnel', () => {
    const plain: AdviseReply = { ...reply, level: 'plans', filterSteps: undefined }
    expect(funnelOf(plain)).toBeNull()
    expect(funnelOf({ ...reply, filterSteps: [] })).toBeNull()
  })
})
