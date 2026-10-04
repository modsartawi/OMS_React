import { describe, expect, it } from 'vitest'

import { CHANGE_QUEUE_LIMIT } from './cap'
import { buildChangeQueue, queueRow, tallyChangeQueue, withEntryNow, withoutRequest } from './change-queue'
import {
  CHANGE_QUEUE,
  CONTRACT_ROW,
  DELETE_ROW,
  ORPHAN_ROW,
  RECORDED_ROW,
  THEFT_DAY_ROW,
} from './change-queue-fixture'
import { DEFAULT_OPEN_TAB, OPEN_LANE_TABS, openTabs, readOpenTab } from './open-lane'

/**
 * Ticket 353 — the supervisor's queue of waiting change requests (spec 342 W9,
 * BackOffice 2285's `Settlement/ChangeRequest/Open`).
 */
describe('queue row projection (2285 recorded sample, field for field)', () => {
  it('projects the recorded BHD row whole', () => {
    expect(queueRow(RECORDED_ROW)).toEqual({
      changeRequestId: '06GG2XW7S68WHDN66G7PYY23Q7',
      settlementEntryId: '06GG2XW7324YJ8CWQQJPYY2DW0',
      // `storeId` IS the branch code — there is no separate code field.
      storeId: 'Z42F',
      storeName: 'صيدلية المنامة / Manama',
      currencyKey: 'BHD',
      entryNumber: 18712,
      entryKind: 'SHORTAGE',
      entryStatus: 'OPEN',
      kind: 'CHANGE',
      // Only the amount differs — the Description is the same on both sides, and no day moves.
      changes: [{ field: 'amount', from: 12.345, to: 10.5 }],
      by: 'Accountant 2162',
      // Fractional seconds kept as received — local wall clock, never re-zoned.
      at: '2026-10-03T14:12:53.1934499',
      reason: 'رقم خاطئ — ٣٥٠ بدلاً من ٣٠٠',
      // The entry NOW, not the figures at the request.
      now: { amount: 12.345, remainingAmount: 12.345, spentAmount: 0 },
      request: RECORDED_ROW,
    })
  })

  it('draws the entry figures as they stand now, never the old amount', () => {
    const spent = { ...CONTRACT_ROW, oldAmount: 350, amount: 350, remainingAmount: 120, spentAmount: 230 }
    expect(queueRow(spent).now).toEqual({ amount: 350, remainingAmount: 120, spentAmount: 230 })
  })

  it('a DELETE draws no old → new: newAmount = oldAmount and the same description', () => {
    const row = queueRow(DELETE_ROW)
    expect(row.kind).toBe('DELETE')
    expect(row.changes).toEqual([])
  })

  it('a theft day-move draws amount, description and day, in that order', () => {
    expect(queueRow(THEFT_DAY_ROW).changes).toEqual([
      { field: 'amount', from: 640, to: 600 },
      { field: 'description', from: 'Till 2 theft', to: 'Till 2 theft — police report 4471' },
      { field: 'businessDay', from: '2026-09-28T00:00:00', to: '2026-09-27T00:00:00' },
    ])
    expect(queueRow(THEFT_DAY_ROW).entryKind).toBe('THEFT')
  })

  it('an amount equal at holding scale is not a change', () => {
    expect(queueRow({ ...RECORDED_ROW, newAmount: 12.3450000001 }).changes).toEqual([])
  })

  it('a request whose entry is missing still lists — no number, no kind, no figures', () => {
    const row = queueRow(ORPHAN_ROW)
    expect(row.entryNumber).toBeNull()
    expect(row.entryKind).toBeNull()
    expect(row.entryStatus).toBeNull()
    expect(row.now).toBeNull()
    expect(row.changes).toEqual([{ field: 'amount', from: 350, to: 300 }])
  })

  it('an unstamped requestedAt is null, never a year-1 date', () => {
    expect(queueRow({ ...RECORDED_ROW, requestedAt: '0001-01-01T00:00:00' }).at).toBeNull()
  })
})

describe('the queue (count, cap, view)', () => {
  it('keeps the server order — oldest first — and counts every waiting row', () => {
    const queue = buildChangeQueue({ rows: CHANGE_QUEUE, failed: false })
    expect(queue.count).toBe(5)
    expect(queue.capReached).toBe(false)
    expect(queue.view.kind).toBe('rows')
    if (queue.view.kind === 'rows')
      expect(queue.view.rows.map((r) => r.changeRequestId)).toEqual(CHANGE_QUEUE.map((r) => r.changeRequestId))
  })

  it('an empty answer is "nothing waiting", a count of 0', () => {
    expect(buildChangeQueue({ rows: [], failed: false })).toEqual({ count: 0, capReached: false, view: { kind: 'empty' } })
  })

  it('a failed read is unknown — null, never 0', () => {
    expect(buildChangeQueue({ rows: undefined, failed: true })).toEqual({
      count: null,
      capReached: false,
      view: { kind: 'failed' },
    })
  })

  it('an answer that is not a list is a failed read — never a crash, never 0', () => {
    const notAList = {} as unknown as never[]
    expect(buildChangeQueue({ rows: notAList, failed: false })).toEqual({
      count: null,
      capReached: false,
      view: { kind: 'failed' },
    })
  })

  it('a row the door answered as anything but OPEN is not counted or drawn', () => {
    const queue = buildChangeQueue({ rows: [RECORDED_ROW, { ...CONTRACT_ROW, status: 'APPLIED' }], failed: false })
    expect(queue.count).toBe(1)
  })

  it('reaching the door limit raises the cap banner', () => {
    const rows = Array.from({ length: CHANGE_QUEUE_LIMIT }, (_, i) => ({ ...RECORDED_ROW, changeRequestId: `R${i}` }))
    expect(tallyChangeQueue({ rows, failed: false })).toEqual({ count: CHANGE_QUEUE_LIMIT, capReached: true })
    expect(tallyChangeQueue({ rows: rows.slice(1), failed: false }).capReached).toBe(false)
  })

  it('an approved request leaves the answer on screen, nothing else does', () => {
    expect(withoutRequest(CHANGE_QUEUE, RECORDED_ROW.changeRequestId)?.map((r) => r.changeRequestId)).toEqual(
      [CONTRACT_ROW, DELETE_ROW, THEFT_DAY_ROW, ORPHAN_ROW].map((r) => r.changeRequestId),
    )
    expect(withoutRequest(undefined, RECORDED_ROW.changeRequestId)).toBeUndefined()
  })
})

describe('a refused act redraws its row from the answer (W8)', () => {
  const refused = {
    accepted: false,
    refusalReason: 'BELOW_SPENT',
    changeRequestId: CONTRACT_ROW.changeRequestId,
    requestStatus: 'OPEN' as const,
    settlementEntryId: CONTRACT_ROW.settlementEntryId,
    entryNumber: 1187,
    amount: 350,
    remainingAmount: 30,
    spentAmount: 320,
    description: 'Short at close',
    entryStatus: 'OPEN' as const,
    businessDay: '0001-01-01T00:00:00',
  }

  it("the entry's figures now are the answer's, on that request's row only", () => {
    const rows = withEntryNow(CHANGE_QUEUE, refused)!
    const row = rows.find((r) => r.changeRequestId === CONTRACT_ROW.changeRequestId)!
    expect([row.amount, row.remainingAmount, row.spentAmount]).toEqual([350, 30, 320])
    // The request's own figures are untouched — what was asked is still what was asked.
    expect([row.oldAmount, row.newAmount]).toEqual([350, 300])
    expect(rows.filter((r) => r !== row)).toEqual(CHANGE_QUEUE.filter((r) => r.changeRequestId !== CONTRACT_ROW.changeRequestId))
  })

  it('an answer about another entry, or naming no entry, changes nothing', () => {
    expect(withEntryNow(CHANGE_QUEUE, { ...refused, settlementEntryId: 'OTHER' })).toEqual(CHANGE_QUEUE)
    expect(withEntryNow(CHANGE_QUEUE, { ...refused, settlementEntryId: '' })).toEqual(CHANGE_QUEUE)
    expect(withEntryNow(undefined, refused)).toBeUndefined()
  })
})

describe('the tab model', () => {
  it('the Change requests tab exists only for supervision, beside Awaiting approval', () => {
    expect(OPEN_LANE_TABS).toContain('changes')
    expect(openTabs({ supervise: false })).toEqual(['owing', 'owed', 'theft', 'cash', 'pending'])
    expect(openTabs({ supervise: true })).toEqual(['owing', 'owed', 'theft', 'cash', 'pending', 'changes'])
  })

  it('?tab=changes is the address for a supervisor; anyone else lands on the default', () => {
    expect(readOpenTab(new URLSearchParams('tab=changes'), { supervise: true })).toBe('changes')
    expect(readOpenTab(new URLSearchParams('tab=CHANGES'), { supervise: true })).toBe('changes')
    expect(readOpenTab(new URLSearchParams('tab=changes'), { supervise: false })).toBe(DEFAULT_OPEN_TAB)
    expect(readOpenTab(new URLSearchParams('tab=changes'))).toBe(DEFAULT_OPEN_TAB)
  })

  it('the earlier addresses resolve as before, whoever reads them', () => {
    for (const supervise of [true, false]) {
      expect(readOpenTab(new URLSearchParams(''), { supervise })).toBe('owing')
      expect(readOpenTab(new URLSearchParams('tab=owed'), { supervise })).toBe('owed')
      expect(readOpenTab(new URLSearchParams('tab=theft'), { supervise })).toBe('theft')
      expect(readOpenTab(new URLSearchParams('tab=cash'), { supervise })).toBe('cash')
      expect(readOpenTab(new URLSearchParams('tab=pending'), { supervise })).toBe('pending')
    }
  })
})
