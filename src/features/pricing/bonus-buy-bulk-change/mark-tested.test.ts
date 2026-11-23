/**
 * Bulk Mark Tested on the bulk change screen (BackOffice spec 4190 stories 40–43, server ticket 4194;
 * oms 959). The tester grant shows the action; the request is the numbers, versions and one note; the
 * answer is a result per row and a batch id.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import type { BbyBulkListRow, BbyBulkMarkTestedResult } from '@/core/models/bonus-buy-bulk'
import { canMarkBulkTested, markTestedRequest, markTestedTargets, readMarkTested } from './mark-tested'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

describe('the Mark Tested action is shown only with the tester grant', () => {
  it('is hidden on the screen grant alone', () => {
    expect(canMarkBulkTested(holding('BbyMaintain:03'))).toBe(false)
  })

  it('is shown with the screen grant and the tester grant', () => {
    expect(canMarkBulkTested(holding('BbyMaintain:03', 'BbyMaintain:04'))).toBe(true)
  })

  it('🚩 is hidden on the tester grant without the screen grant, and on a failed answer', () => {
    expect(canMarkBulkTested(holding('BbyMaintain:04'))).toBe(false)
    expect(canMarkBulkTested(permissionsOf(null))).toBe(false)
  })
})

const row = (bbyNumber: string, bbyStatus: string, version: string): BbyBulkListRow => ({
  bbyNumber,
  description: null,
  promoNumber: 'P00000001',
  bbyStatus,
  version,
  engineRules: null,
})

describe('the request carries the numbers, their versions and the one note', () => {
  it('sends each bonus buy with its version as loaded, and the note trimmed', () => {
    const targets = [
      { bbyNumber: 'OMS000000001', version: 'AAAAAAAAB9E=' },
      { bbyNumber: 'OMS000000002', version: 'AAAAAAAAB9F=' },
    ]
    expect(markTestedRequest(targets, '  Checked in the simulator, seat C  ')).toEqual({
      bonusBuys: [
        { bbyNumber: 'OMS000000001', version: 'AAAAAAAAB9E=' },
        { bbyNumber: 'OMS000000002', version: 'AAAAAAAAB9F=' },
      ],
      note: 'Checked in the simulator, seat C',
    })
  })

  it('a blank note is sent as null, as the single Mark Tested does', () => {
    expect(markTestedRequest([{ bbyNumber: 'OMS000000001', version: 'v1' }], '   ').note).toBeNull()
  })

  it('the selected rows are the batch, at their loaded versions', () => {
    const list = [row('OMS000000001', '1', 'v1'), row('OMS000000002', '1', 'v2')]
    expect(markTestedTargets([list[1]], ['OMS000000001'], list)).toEqual([{ bbyNumber: 'OMS000000002', version: 'v2' }])
  })

  it('with nothing selected, the batch is the rows the last apply saved, at their refreshed versions, still Planned', () => {
    const list = [
      row('OMS000000001', '1', 'v1-after-apply'),
      row('OMS000000002', '3', 'v2'), // tested meanwhile: locked, left out
      row('OMS000000003', '1', 'v3'), // not in the apply: left out
    ]
    expect(markTestedTargets([], ['OMS000000001', 'OMS000000002', 'OMS000000009'], list)).toEqual([
      { bbyNumber: 'OMS000000001', version: 'v1-after-apply' },
    ])
  })

  it('nothing selected and no apply is an empty batch', () => {
    expect(markTestedTargets([], [], [row('OMS000000001', '1', 'v1')])).toEqual([])
  })
})

const invalid = {
  code: 'BBY-GET-EMPTY',
  english: 'The get line has no material.',
  arabic: 'سطر الحصول لا يحتوي على مادة.',
}
const stale = {
  code: 'BBY-STALE',
  english: 'Someone changed this bonus buy after you loaded it.',
  arabic: 'قام شخص آخر بتغيير عرض الشراء هذا بعد تحميله.',
}

/** 🚩 A guessed 4194 answer: two tested, one re-validation refusal, one stale, one status word it does not know. */
const FIXTURE: BbyBulkMarkTestedResult = {
  status: 'saved',
  batchId: '01JD3M2B8QK0F7V4N6T9X1Y5ZC',
  refusals: [],
  warnings: [],
  bonusBuys: [
    { number: 'OMS000000001', status: 'saved', refusals: [], warnings: [] },
    { number: 'OMS000000002', status: 'refused', refusals: [invalid], warnings: [] },
    { number: 'OMS000000003', status: 'saved', refusals: [], warnings: [] },
    { number: 'OMS000000004', status: 'refused', refusals: [stale], warnings: [] },
    { number: 'OMS000000005', status: 'later', refusals: [], warnings: [] },
  ],
}

describe('the answer: a result per row and the batch id', () => {
  const read = readMarkTested(FIXTURE)

  it('carries the batch id and counts each outcome', () => {
    expect(read.batchId).toBe('01JD3M2B8QK0F7V4N6T9X1Y5ZC')
    expect(read.counts).toEqual({ tested: 2, refuse: 2, unknown: 1 })
  })

  it('each row keeps its number, its outcome and its refusals in both languages', () => {
    expect(read.rows).toEqual([
      { number: 'OMS000000001', outcome: 'tested', refusals: [], warnings: [] },
      { number: 'OMS000000002', outcome: 'refuse', refusals: [invalid], warnings: [] },
      { number: 'OMS000000003', outcome: 'tested', refusals: [], warnings: [] },
      { number: 'OMS000000004', outcome: 'refuse', refusals: [stale], warnings: [] },
      { number: 'OMS000000005', outcome: 'unknown', refusals: [], warnings: [] },
    ])
  })

  it('🚩 a batch refused whole (no tester grant, over the cap) carries the batch refusals and no rows', () => {
    const grant = { code: 'BBY-TEST-GRANT', english: 'You cannot mark bonus buys Tested.', arabic: 'لا يمكنك تعليم عروض الشراء كمختبرة.' }
    const whole = readMarkTested({ status: 'refused', batchId: null, refusals: [grant], warnings: [], bonusBuys: [] })
    expect(whole.refusedWhole).toBe(true)
    expect(whole.batchRefusals).toEqual([grant])
    expect(whole.rows).toEqual([])
    expect(whole.batchId).toBeNull()
  })

  it('a `tested` status word is read as tested too', () => {
    const read2 = readMarkTested({ ...FIXTURE, bonusBuys: [{ number: 'OMS000000001', status: 'tested', refusals: [], warnings: [] }] })
    expect(read2.rows[0].outcome).toBe('tested')
  })
})
