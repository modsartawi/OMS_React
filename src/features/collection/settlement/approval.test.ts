/**
 * Ticket 309 — **a pending surplus is labelled, excluded from every total, and a
 * supervisor approves or rejects it** (BackOffice 1977 / 1978).
 *
 * One suite across modules on purpose: the ticket's rule is ONE rule — *only `OPEN`
 * is money* — and it has to hold in every module that counts or draws a figure. A
 * suite per module would prove each in isolation and let the next module to count
 * something forget it. The fixture is `approval-fixture.ts`, the same bytes
 * `tools/settlement-approval-drive.mjs` serves.
 *
 * Rules pinned here:
 *
 * 1. **Headline totals are OPEN-only.** 0719 carries 2,050 of pending and rejected
 *    surplus and its headline keeps back 920 — the pending pair is counted BESIDE it,
 *    as entries.
 * 2. **Labelled, not dimmed** — a pending row is neither open nor closed; a rejected
 *    one is closed, and its remaining is no claim on anybody.
 * 3. **Approve and Reject only on a pending row, only with the supervision boolean.**
 * 4. **A refusal is a 200 that says what the entry is now**, and a bare 403 is named.
 * 5. **The queue is its own count**, and the open lane's counts never include a
 *    pending row, whatever the door sends.
 * 6. **The bulk preview marks and counts waiting rows and never blocks on them.**
 */
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/core/api'
import type { SettlementOpenLaneRow } from '@/core/models/settlement'
import { accountHeadline, projectAccount, remainingIsAClaim } from './account-projection'
import {
  APPROVAL_ACCOUNT,
  APPROVAL_ENTRIES,
  APPROVAL_PREVIEW,
  PENDING_LANE,
  REJECTED_REASON,
  SUPERVISOR_ID,
  UNSTAMPED,
} from './approval-fixture'
import {
  afterSupervision,
  approvalFor,
  ENTRY_NOT_PENDING,
  isStamped,
  supervisionFailure,
} from './approval'
import { auditColumn } from './audit'
import { reviewBulk } from './bulk'
import { CLEAN_PREVIEW } from './bulk-fixture'
import { correctionFor } from './correction'
import { remainingCell } from './entry-cells'
import { LEDGER_STATUSES } from './ledger'
import { ledgerRowClass } from './ledger-columns'
import { accountRowClass } from './account-columns'
import {
  buildOpenLane,
  buildPendingLane,
  isEntryTab,
  OPEN_LANE_TABS,
  readOpenTab,
  tallyOpenLane,
  tallyPendingLane,
} from './open-lane'

const byNumber = (n: number) => APPROVAL_ENTRIES.find((e) => e.entryNumber === n)!
const rows = projectAccount(APPROVAL_ACCOUNT)
const rowOf = (n: number) => rows.find((r) => r.entryNumber === n)!

describe('rule 1 — 🔑 a pending or rejected surplus is in NO total', () => {
  it('0719 keeps back 920, not the 2,970 its surplus rows add up to', () => {
    const headline = accountHeadline(APPROVAL_ENTRIES)
    // 800 (self-approved, live) + 120 (below the threshold, live). The 600 and 750
    // wait for a supervisor; the 700 was rejected.
    expect(headline.surplusTotal).toBe(920)
    expect(headline.shortageTotal).toBe(300)
    expect(headline.signedPosition).toBe(-620)
    expect(headline.direction).toBe('keeps')
  })

  it('counts the open entries alone, and the pending pair BESIDE them as a count', () => {
    const headline = accountHeadline(APPROVAL_ENTRIES)
    expect(headline.openCount).toBe(3)
    expect(headline.pendingCount).toBe(2)
  })

  it('🚩 approving one moves it INTO the figures — the status is the only switch', () => {
    const approved = APPROVAL_ENTRIES.map((e) => (e.entryNumber === 1202 ? { ...e, status: 'OPEN' as const } : e))
    const headline = accountHeadline(approved)
    expect(headline.surplusTotal).toBe(1520)
    expect(headline.openCount).toBe(4)
    expect(headline.pendingCount).toBe(1)
  })

  it('a branch holding ONLY pending surplus is square, with one entry waiting', () => {
    const headline = accountHeadline([byNumber(1202)])
    expect(headline).toMatchObject({ signedPosition: 0, direction: 'square', openCount: 0, pendingCount: 1 })
  })

  it('a rejected surplus is not even waiting — it is counted nowhere', () => {
    expect(accountHeadline([byNumber(1204)])).toMatchObject({ surplusTotal: 0, openCount: 0, pendingCount: 0 })
  })
})

describe('rule 2 — labelled, and its remaining is no claim on anybody', () => {
  it('a pending row is neither open nor closed', () => {
    expect(rowOf(1202)).toMatchObject({ isPending: true, isOpen: false, closure: null })
  })

  it('a rejected row is closed as `rejected` — not cancelled, not consumed', () => {
    expect(rowOf(1204)).toMatchObject({ isPending: false, isOpen: false, closure: 'rejected' })
  })

  it('🚩 neither draws a Remaining, though the wire carries one on both', () => {
    expect(byNumber(1202).remainingAmount).toBe(600)
    expect(rowOf(1202).displayRemaining).toBeNull()
    expect(rowOf(1204).displayRemaining).toBeNull()
    expect(remainingIsAClaim('PENDING_APPROVAL')).toBe(false)
    expect(remainingIsAClaim('REJECTED')).toBe(false)
    expect(remainingIsAClaim('OPEN')).toBe(true)
  })

  it('…and the ledger grid, reading the same rule, draws the em dash for both', () => {
    expect(remainingCell(byNumber(1202), 600, 'SAR')).toBe('—')
    expect(remainingCell(byNumber(1204), 700, 'SAR')).toBe('—')
    expect(remainingCell(byNumber(1206), 120, 'SAR')).not.toBe('—')
  })

  it('lands open first, then pending, then the history', () => {
    const order = rows.map((r) => r.status)
    expect(order.slice(0, 3)).toEqual(['OPEN', 'OPEN', 'OPEN'])
    expect(order.slice(3, 5)).toEqual(['PENDING_APPROVAL', 'PENDING_APPROVAL'])
    expect(order[5]).toBe('REJECTED')
  })

  it('a pending row is NOT dimmed; a rejected one is — on both grids', () => {
    expect(accountRowClass({ data: rowOf(1202) })).toBeUndefined()
    expect(accountRowClass({ data: rowOf(1204) })).toBe('opacity-60')
    const ledger = (n: number) => ({ ...byNumber(n), storeName: '', currencyKey: 'SAR' })
    expect(ledgerRowClass({ data: ledger(1202) })).toBeUndefined()
    expect(ledgerRowClass({ data: ledger(1204) })).toBe('opacity-60')
  })

  it('🚩 offers no Cancel on a pending surplus, and no write-off on a rejected one', () => {
    // Without its own case a pending entry fell through to the OPEN arithmetic and
    // offered *Cancel* — remaining equals amount on a surplus nobody has touched.
    expect(correctionFor(byNumber(1202))).toEqual({ kind: 'none', because: 'pending' })
    expect(correctionFor(byNumber(1204))).toEqual({ kind: 'none', because: 'rejected' })
  })

  it('the ledger can be asked for pending and for rejected — pending beside open', () => {
    expect(LEDGER_STATUSES).toEqual([
      'OPEN',
      'PENDING_APPROVAL',
      'CONSUMED',
      'CANCELLED',
      'CLOSED_OUT',
      'REJECTED',
    ])
  })
})

describe('rule 3 — Approve and Reject only on a pending row, only for a supervisor', () => {
  it('a supervisor is offered the decision on a pending row', () => {
    expect(approvalFor(byNumber(1202), true)).toEqual({ kind: 'decide' })
  })

  it('an accountant is told it waits — and is offered nothing', () => {
    expect(approvalFor(byNumber(1202), false)).toEqual({ kind: 'waiting' })
  })

  it('🔑 the accountant sees a rejected entry WITH the supervisor’s reason', () => {
    for (const canSupervise of [true, false])
      expect(approvalFor(byNumber(1204), canSupervise)).toEqual({
        kind: 'rejected',
        by: SUPERVISOR_ID,
        at: '2026-09-24T18:40:02',
        reason: REJECTED_REASON,
      })
  })

  it('an open, consumed or corrected entry offers nothing, whoever is looking', () => {
    for (const n of [1201, 1205, 1206]) {
      expect(approvalFor(byNumber(n), true)).toEqual({ kind: 'none' })
      expect(approvalFor(byNumber(n), false)).toEqual({ kind: 'none' })
    }
    expect(approvalFor(null, true)).toEqual({ kind: 'none' })
  })

  it('a rejection the server did not stamp says so rather than drawing year 1', () => {
    const unstamped = { ...byNumber(1204), rejectedAt: UNSTAMPED }
    expect(approvalFor(unstamped, false)).toMatchObject({ kind: 'rejected', at: null })
  })

  it("⚠️ a stamp is a real time — `''` and the year-1 default are both unstamped", () => {
    expect(isStamped('2026-09-24T18:40:02')).toBe(true)
    expect(isStamped(UNSTAMPED)).toBe(false)
    expect(isStamped('0001-01-01T00:00:00.000')).toBe(false)
    expect(isStamped('')).toBe(false)
    expect(isStamped(null)).toBe(false)
  })

  it('the audit pane records the rejection, by the supervisor, with the reason', () => {
    const facts = auditColumn(rowOf(1204))
    expect(facts.map((f) => f.kind)).toEqual(['posted', 'rejected'])
    expect(facts[1]).toMatchObject({
      at: '2026-09-24T18:40:02',
      where: { kind: 'staff', staffId: SUPERVISOR_ID },
      note: REJECTED_REASON,
      amount: null,
    })
  })

  it('…and a self-approved surplus records its approval AFTER its posting, same minute', () => {
    const facts = auditColumn(rowOf(1205))
    expect(facts.map((f) => f.kind)).toEqual(['posted', 'approved'])
    expect(facts[1].where).toEqual({ kind: 'staff', staffId: SUPERVISOR_ID })
  })

  it('🚩 an entry that never needed approval has NO approval fact — the year-1 default is not one', () => {
    expect(auditColumn(rowOf(1201)).map((f) => f.kind)).toEqual(['posted'])
    expect(auditColumn(rowOf(1202)).map((f) => f.kind)).toEqual(['posted'])
  })
})

describe('rule 4 — what an Approve or a Reject came back with', () => {
  it('an accepted act is done, with the server’s status', () => {
    expect(
      afterSupervision('approve', { accepted: true, refusalReason: '', remainingAmount: 600, status: 'OPEN' }),
    ).toEqual({ kind: 'done', act: 'approve', status: 'OPEN' })
    expect(
      afterSupervision('reject', { accepted: true, refusalReason: '', remainingAmount: 750, status: 'REJECTED' }),
    ).toEqual({ kind: 'done', act: 'reject', status: 'REJECTED' })
  })

  it('🔑 somebody got there first — the refusal says what the entry IS now', () => {
    expect(
      afterSupervision('approve', {
        accepted: false,
        refusalReason: ENTRY_NOT_PENDING,
        remainingAmount: 750,
        status: 'OPEN',
      }),
    ).toEqual({ kind: 'decided', status: 'OPEN' })
    expect(
      afterSupervision('approve', {
        accepted: false,
        refusalReason: ENTRY_NOT_PENDING,
        remainingAmount: 750,
        status: 'REJECTED',
      }),
    ).toEqual({ kind: 'decided', status: 'REJECTED' })
  })

  it('no such entry is its own case, not a decision somebody made', () => {
    expect(
      afterSupervision('reject', {
        accepted: false,
        refusalReason: ENTRY_NOT_PENDING,
        remainingAmount: 0,
        status: '',
      }),
    ).toEqual({ kind: 'gone' })
  })

  it('⚠️ a code these doors do not define is passed through, never read as a race', () => {
    expect(
      afterSupervision('approve', { accepted: false, refusalReason: 'SOMETHING_NEW', remainingAmount: 0, status: 'OPEN' }),
    ).toEqual({ kind: 'refused', reason: 'SOMETHING_NEW' })
    expect(afterSupervision('approve', null)).toEqual({ kind: 'refused', reason: '' })
  })

  it('🔑 the bare 403 is named — the grant went between the probe and the press', () => {
    expect(supervisionFailure(new ApiError('unknown', 'Unexpected response (403)', 403))).toBe('forbidden')
    expect(supervisionFailure(new ApiError('business', 'A reason is required.', 400))).toBe('other')
    expect(supervisionFailure(new ApiError('server', 'Server error', 500))).toBe('other')
    expect(supervisionFailure(new Error('network'))).toBe('other')
  })
})

describe('rule 5 — the queue is its own count, and never in the open lane’s', () => {
  it('awaiting approval is a fourth tab, addressable, and not an entry tab', () => {
    expect(OPEN_LANE_TABS).toContain('pending')
    expect(readOpenTab(new URLSearchParams('tab=pending'))).toBe('pending')
    expect(isEntryTab('pending')).toBe(false)
    expect(isEntryTab('cash')).toBe(false)
    expect(isEntryTab('owed')).toBe(true)
  })

  it('counts the estate’s pending surpluses, across branches, oldest first as sent', () => {
    const lane = buildPendingLane({ rows: PENDING_LANE, failed: false, mineOnly: false })
    expect(lane.count).toBe(3)
    expect(lane.view.kind).toBe('rows')
    if (lane.view.kind !== 'rows') return
    const drawn = lane.view.sections.flatMap((s) => s.rows.map((r) => r.entryNumber))
    expect(drawn.sort()).toEqual([1202, 1203, 1207])
    // Yours above everyone else's, exactly as every other tab.
    expect(lane.view.sections.map((s) => s.which)).toEqual(['mine', 'theirs'])
  })

  it('⚠️ claims its order only when the door sent ages — §6 unbuilt means unsorted', () => {
    expect(buildPendingLane({ rows: PENDING_LANE, failed: false, mineOnly: false }).aged).toBe(true)
    const unaged = PENDING_LANE.map(({ ageDays: _a, ...r }) => r)
    expect(buildPendingLane({ rows: unaged, failed: false, mineOnly: false }).aged).toBe(false)
  })

  it('a failed queue is unknown — never `0`, which reads as nothing waiting', () => {
    expect(tallyPendingLane({ rows: undefined, failed: true })).toEqual({ count: null, capReached: false })
    expect(buildPendingLane({ rows: PENDING_LANE, failed: true, mineOnly: false }).view.kind).toBe('failed')
  })

  it('an empty queue is good news, and its own state', () => {
    expect(buildPendingLane({ rows: [], failed: false, mineOnly: false })).toMatchObject({
      count: 0,
      view: { kind: 'empty' },
    })
  })

  it('🚩 the queue counts only what is still pending, whatever the door sent', () => {
    const decided = PENDING_LANE.map((r, i) => (i === 0 ? { ...r, status: 'OPEN' as const } : r))
    expect(tallyPendingLane({ rows: decided, failed: false }).count).toBe(2)
  })

  it('🚩 and the OPEN lane’s counts never include a pending or rejected row', () => {
    const open: SettlementOpenLaneRow = { ...PENDING_LANE[0], status: 'OPEN', entryKind: 'SURPLUS' }
    const wider = [open, ...PENDING_LANE, { ...PENDING_LANE[1], status: 'REJECTED' as const }]
    expect(tallyOpenLane({ rows: wider, failed: false }).counts).toEqual({ owing: 0, owed: 1 })
    const lane = buildOpenLane({ rows: wider, failed: false, tab: 'owed', mineOnly: false })
    expect(lane.view.kind === 'rows' && lane.view.sections.flatMap((s) => s.rows).length).toBe(1)
  })
})

describe('rule 6 — the bulk preview marks the rows that will wait, and never blocks', () => {
  it('counts the rows the server marked, and only those', () => {
    const review = reviewBulk(APPROVAL_PREVIEW)
    expect(review.awaitingApproval).toBe(2)
    expect(review.rows.filter((r) => r.awaitsApproval).map((r) => r.rowNumber)).toEqual([3, 4])
  })

  it('🚩 waiting is neither an error nor a warning — the file still commits', () => {
    const review = reviewBulk(APPROVAL_PREVIEW)
    expect(review.canCommit).toBe(true)
    expect(review.blockers).toEqual([])
    expect(review.warnedRows).toBe(0)
  })

  it('a SHORTAGE month marks nothing', () => {
    expect(reviewBulk(CLEAN_PREVIEW).awaitingApproval).toBe(0)
  })

  it('⚠️ the client derives nothing — a 500 row the server did not mark does not wait', () => {
    const unmarked = {
      ...APPROVAL_PREVIEW,
      rows: APPROVAL_PREVIEW.rows.map((r) => ({ ...r, awaitsApproval: false })),
    }
    expect(reviewBulk(unmarked).awaitingApproval).toBe(0)
  })
})
