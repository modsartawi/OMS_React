/**
 * Bulk Mark Tested on the bulk change screen (BackOffice spec 4190 stories 40–43, server ticket 4194;
 * oms 959). The tester grant shows the action; the request is the numbers, versions and one note; the
 * answer is a result per row and a batch id.
 *
 * Fixtures are BackOffice pricing2 9317c4cd6's wire shape (`BbyBulkResult`, BbyBulkChangeModels.cs).
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import type { BbyBulkListRow, BbyBulkMarkTestedResult, BbyBulkRowResult } from '@/core/models/bonus-buy-bulk'
import type { BbyRefusal } from '@/core/models/bonus-buy-maintenance'
import { BULK_TEST_NOTE_MAX, canMarkBulkTested, markTestedRequest, markTestedTargets, readMarkTested } from './mark-tested'

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
  locked: bbyStatus !== '1',
  version,
  engineRules: null,
})

describe('the request carries the numbers, their versions and the one note', () => {
  it('sends each bonus buy with its version as loaded, and the note trimmed', () => {
    const targets = [
      { bbyNumber: 'OMS000000001', version: '202611231015300000000' },
      { bbyNumber: 'OMS000000002', version: '202611231015300000001' },
    ]
    expect(markTestedRequest(targets, '  Checked in the simulator, seat C  ')).toEqual({
      bonusBuys: [
        { bbyNumber: 'OMS000000001', version: '202611231015300000000' },
        { bbyNumber: 'OMS000000002', version: '202611231015300000001' },
      ],
      note: 'Checked in the simulator, seat C',
    })
  })

  it('the note input leaves room for the batch reference the server appends', () => {
    // BO BbyMaintainWebService.BulkTested.cs BatchNote: BbyTestMark.Note is 200 wide; the server appends
    // " (batch <26-char ULID>)" and clamps the note, never the reference.
    expect(BULK_TEST_NOTE_MAX).toBe(200 - ' (batch 01JD3M2B8QK0F7V4N6T9X1Y5ZC)'.length)
    expect(BULK_TEST_NOTE_MAX).toBe(165)
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
  english: "Bonus buy 'OMS000000002': the get line has no material.",
  arabic: 'سطر الحصول لا يحتوي على مادة.',
}
const stale = {
  code: 'BBY-STALE',
  english: "Bonus buy 'OMS000000004': someone changed this bonus buy after you loaded it.",
  arabic: 'قام شخص آخر بتغيير عرض الشراء هذا بعد تحميله.',
}

/** One row as bulk Mark Tested fills BO's `BbyBulkRowResult`: no rules and no changed fields. */
const mark = (number: string, status: string, refusals: BbyRefusal[] = [], version: string | null = 'v'): BbyBulkRowResult => ({
  number,
  status,
  refusals,
  warnings: [],
  version,
  changedFields: [],
  before: null,
  after: null,
})

/** BO 4194's answer: two tested, one re-validation refusal, one stale, one status word it does not know, one not found. */
const FIXTURE: BbyBulkMarkTestedResult = {
  status: 'saved',
  batchId: '01JD3M2B8QK0F7V4N6T9X1Y5ZC',
  dryRun: false,
  saved: 2,
  skipped: 0,
  refused: 3,
  refusals: [],
  bonusBuys: [
    mark('OMS000000001', 'saved'),
    mark('OMS000000002', 'refused', [invalid]),
    mark('OMS000000003', 'saved'),
    mark('OMS000000004', 'refused', [stale]),
    mark('OMS000000005', 'later'),
    mark('OMS000000006', 'notFound', [], null),
  ],
}

describe('the answer: a result per row and the batch id', () => {
  const read = readMarkTested(FIXTURE)

  it('carries the batch id and counts each outcome (notFound is a refusal)', () => {
    expect(read.batchId).toBe('01JD3M2B8QK0F7V4N6T9X1Y5ZC')
    expect(read.counts).toEqual({ tested: 2, refuse: 3, unknown: 1 })
  })

  it('each row keeps its number, its outcome and its refusals in both languages', () => {
    expect(read.rows).toEqual([
      { number: 'OMS000000001', outcome: 'tested', refusals: [], warnings: [] },
      { number: 'OMS000000002', outcome: 'refuse', refusals: [invalid], warnings: [] },
      { number: 'OMS000000003', outcome: 'tested', refusals: [], warnings: [] },
      { number: 'OMS000000004', outcome: 'refuse', refusals: [stale], warnings: [] },
      { number: 'OMS000000005', outcome: 'unknown', refusals: [], warnings: [] },
      { number: 'OMS000000006', outcome: 'refuse', refusals: [], warnings: [] },
    ])
  })

  it('a batch refused whole (over the cap, nothing sent) carries the batch refusals and no rows', () => {
    const tooMany = {
      code: 'BBY-BULK-TOO-MANY',
      english: '201 bonus buys are selected; one bulk request takes at most 200. Nothing was changed.',
      arabic: 'تم اختيار 201 من عروض الشراء؛ والطلب الجماعي الواحد يقبل 200 على الأكثر.',
    }
    const whole = readMarkTested({ status: 'refused', batchId: null, dryRun: false, refusals: [tooMany], bonusBuys: [] })
    expect(whole.refusedWhole).toBe(true)
    expect(whole.batchRefusals).toEqual([tooMany])
    expect(whole.rows).toEqual([])
    expect(whole.batchId).toBeNull()
  })

  it('🚩 a whole-batch refusal with no rows at all (bonusBuys null) reads as refused whole', () => {
    const whole = readMarkTested({ status: 'refused', batchId: null, refusals: [], bonusBuys: null } as unknown as BbyBulkMarkTestedResult)
    expect(whole.refusedWhole).toBe(true)
    expect(whole.rows).toEqual([])
  })

  it('only `saved` is tested: the server never answers `tested`, so that word is unknown, never tested', () => {
    const read2 = readMarkTested({ ...FIXTURE, bonusBuys: [mark('OMS000000001', 'tested')] })
    expect(read2.rows[0].outcome).toBe('unknown')
  })
})
