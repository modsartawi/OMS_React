import { describe, expect, it } from 'vitest'
import settlement from '@/locales/en/settlement.json'
import type { SettlementBulkPreview } from '@/core/models/settlement'
import { accountHeadline, projectAccount, remainingIsAClaim } from './account-projection'
import { approvalFor, approvalTarget, dayVarianceFor, needsDayLookup } from './approval'
import { reviewBulk } from './bulk'
import { BULK_KINDS, bulkTemplateCsv } from './bulk-template'
import { correctionFor } from './correction'
import { remainingCell } from './entry-cells'
import { LEDGER_KINDS, readCriteria } from './ledger'
import {
  buildOpenLane,
  buildPendingLane,
  buildTheftLane,
  isEntryTab,
  OPEN_LANE_ENTRY_TABS,
  OPEN_LANE_TABS,
  readOpenTab,
  tallyOpenLane,
} from './open-lane'
import {
  checkBusinessDay,
  POST_KINDS,
  postRefusalField,
  postRequest,
  standingPosition,
} from './posting'
import {
  APPROVED_THEFT_ID,
  PENDING_THEFT_ID,
  THEFT_ACCOUNT,
  THEFT_ENTRIES,
  THEFT_LEDGER,
  THEFT_STORE_NAME,
} from './theft-fixture'

/**
 * **Theft (سرقة) — the third settlement entry kind** (ticket 339, BackOffice 2150,
 * ADR 0049).
 *
 * A theft names one store and one closed business day, always waits for an accountant
 * supervisor, and **moves no cash**: nothing consumes it, it has no remaining to run
 * down, and it is never in the shortage or surplus figures. Everything below is a rule
 * that fails silently — an approved theft is stored `OPEN` with `remaining == amount`,
 * which is exactly what an open surplus looks like to a rule that tests only
 * *"not SHORTAGE"*.
 */

const byNumber = (n: number) => THEFT_ENTRIES.find((e) => e.entryNumber === n)!
const ledgerRow = (n: number) => THEFT_LEDGER.find((e) => e.entryNumber === n)!
/** `Settlement/Ledger?status=OPEN` — which, since 2150, returns approved thefts too. */
const OPEN_ANSWER = THEFT_LEDGER.filter((r) => r.status === 'OPEN')
const PENDING_ANSWER = THEFT_LEDGER.filter((r) => r.status === 'PENDING_APPROVAL')

describe('posting a theft', () => {
  it('the post dialog offers Theft as the third kind', () => {
    expect(POST_KINDS).toEqual(['SHORTAGE', 'SURPLUS', 'THEFT'])
    expect(settlement.account.kind.THEFT).toBe('Theft · سرقة')
  })

  it('post dialog requires a business day for a theft', () => {
    // Blank, or only spaces: the form is not ready, and the field says so.
    expect(checkBusinessDay('THEFT', '')).toEqual({ day: undefined, problem: 'blank' })
    expect(checkBusinessDay('THEFT', '   ')).toEqual({ day: undefined, problem: 'blank' })
    // Not a calendar day — a shape the server could not read as one.
    expect(checkBusinessDay('THEFT', '27/09/2026').problem).toBe('unreadable')
    expect(checkBusinessDay('THEFT', '2026-02-31').problem).toBe('unreadable')
    // A bare date is what goes up.
    expect(checkBusinessDay('THEFT', '2026-09-27')).toEqual({ day: '2026-09-27', problem: null })
  })

  it('…and asks for none on a shortage or a surplus', () => {
    expect(checkBusinessDay('SHORTAGE', '')).toEqual({ day: undefined, problem: null })
    // A day left in the box from a theft the accountant toggled away from is not sent.
    expect(checkBusinessDay('SURPLUS', '2026-09-27')).toEqual({ day: undefined, problem: null })
  })

  it('the body carries the bare date for a theft and no day for the other kinds', () => {
    const base = { storeId: 'P019', amount: 3000, reason: 'سرقة من الخزنة', businessDay: '2026-09-27' }
    expect(postRequest({ ...base, entryKind: 'THEFT' })).toEqual({
      storeId: 'P019',
      entryKind: 'THEFT',
      amount: 3000,
      reason: 'سرقة من الخزنة',
      businessDay: '2026-09-27',
    })
    expect(postRequest({ ...base, entryKind: 'SURPLUS' })).toEqual({
      storeId: 'P019',
      entryKind: 'SURPLUS',
      amount: 3000,
      reason: 'سرقة من الخزنة',
    })
  })

  it('the server’s refusal for an open or unknown day belongs to the day field', () => {
    expect(postRefusalField('SettlementTheftDayNotClosed')).toBe('businessDay')
    expect(postRefusalField('SettlementTheftBusinessDayRequired')).toBe('businessDay')
    // The description's two refusals stay on the description (ticket 311).
    expect(postRefusalField('SettlementReasonRequired')).toBe('reason')
    expect(postRefusalField('SettlementReasonTooLong')).toBe('reason')
    // Anything else is a toast, not a field.
    expect(postRefusalField('SettlementAmountRequired')).toBeNull()
    expect(postRefusalField(null)).toBeNull()
  })

  it('what a branch already carries is a question about consumable money only', () => {
    // An approved theft beside an open surplus: the surplus standing is the surplus alone.
    expect(standingPosition(THEFT_ENTRIES, 'SURPLUS').total).toBe(150)
    expect(standingPosition(THEFT_ENTRIES, 'SHORTAGE').total).toBe(200)
  })

  it('the wording never calls a theft a deduction', () => {
    const theftWords = JSON.stringify([
      settlement.post.kind.THEFT,
      settlement.post.theft,
      settlement.post.review.consequence.THEFT,
      settlement.post.done.summary.THEFT,
      settlement.approval.theft,
      settlement.open.empty.theft,
      settlement.open.subtitleTheft,
    ])
    expect(theftWords).not.toMatch(/deduct/i)
  })
})

describe('deciding a theft', () => {
  it('approval dialog shows the day\'s variance for a theft', () => {
    // From the queue: a ledger row, which carries the named day's three figures.
    const target = approvalTarget(ledgerRow(1412), THEFT_STORE_NAME, 'SAR')
    expect(target.entryKind).toBe('THEFT')
    expect(target.day).toEqual({
      kind: 'stated',
      day: '2026-09-27T00:00:00',
      systemCash: 3500,
      countedCash: 500,
      magnitude: 3000,
      // 🔑 The wire's sign is Cash Collections': NEGATIVE = short. The dialog says the
      // direction in a word and the magnitude as a figure, so nobody reads a sign.
      direction: 'short',
    })
    expect(needsDayLookup(target)).toBe(false)
  })

  it('…a day that counted more than the system expected is said as over, and an exact one as even', () => {
    expect(dayVarianceFor(ledgerRow(1414))).toMatchObject({ kind: 'stated', direction: 'over', magnitude: 10 })
    expect(
      dayVarianceFor({ ...ledgerRow(1412), dayCountedCash: 3500, dayCashVariance: 0 }),
    ).toMatchObject({ kind: 'stated', direction: 'even', magnitude: 0 })
  })

  it('…from the branch account the figures are not on the row, and the dialog is told to look them up', () => {
    // `Settlement/Account` rows carry `businessDay` only.
    const target = approvalTarget(byNumber(1412), THEFT_STORE_NAME, '')
    expect(target.day).toEqual({ kind: 'unstated', day: '2026-09-27T00:00:00' })
    expect(needsDayLookup(target)).toBe(true)
  })

  it('…and a surplus names no day and shows no variance', () => {
    const target = approvalTarget(ledgerRow(1411), THEFT_STORE_NAME, 'SAR')
    expect(target.day).toEqual({ kind: 'none' })
    expect(needsDayLookup(target)).toBe(false)
  })

  it('a pending theft is decided exactly as a pending surplus is', () => {
    expect(approvalFor(byNumber(1412), true)).toEqual({ kind: 'decide' })
    expect(approvalFor(byNumber(1412), false)).toEqual({ kind: 'waiting' })
    expect(approvalFor(byNumber(1414), false)).toMatchObject({ kind: 'rejected', reason: 'لا يوجد بلاغ مرفق' })
  })

  it('the queue lists a pending theft beside the pending surpluses', () => {
    const lane = buildPendingLane({ rows: PENDING_ANSWER, failed: false, mineOnly: false })
    expect(lane.count).toBe(1)
    expect(lane.view.kind === 'rows' && lane.view.sections[0].rows[0].settlementEntryId).toBe(PENDING_THEFT_ID)
  })
})

describe('finding a theft', () => {
  it('open settlements has a theft tab fed by kind THEFT', () => {
    expect(OPEN_LANE_TABS).toContain('theft')
    expect(readOpenTab(new URLSearchParams('tab=theft'))).toBe('theft')
    expect(settlement.open.tabs.theft).toBe('Theft')

    const lane = buildTheftLane({ rows: OPEN_ANSWER, failed: false, mineOnly: false })
    expect(lane.count).toBe(1)
    expect(lane.view.kind).toBe('rows')
    const rows = lane.view.kind === 'rows' ? lane.view.sections.flatMap((s) => s.rows) : []
    expect(rows.map((r) => r.settlementEntryId)).toEqual([APPROVED_THEFT_ID])
    // …listed with the day it names.
    expect(rows[0].businessDay).toBe('2026-09-20T00:00:00')
  })

  it('…its count is unknown, never 0, when the read failed', () => {
    const lane = buildTheftLane({ rows: undefined, failed: true, mineOnly: false })
    expect(lane.count).toBeNull()
    expect(lane.view).toEqual({ kind: 'failed' })
  })

  it('…and a pending theft the door sent under OPEN is not listed as approved', () => {
    const wider = [...OPEN_ANSWER, ledgerRow(1412)]
    expect(buildTheftLane({ rows: wider, failed: false, mineOnly: false }).count).toBe(1)
  })

  it('the old tab addresses are untouched by the new one', () => {
    expect(readOpenTab(new URLSearchParams('tab=owing'))).toBe('owing')
    expect(readOpenTab(new URLSearchParams('tab=owed'))).toBe('owed')
    expect(readOpenTab(new URLSearchParams(''))).toBe('owing')
  })

  it('the ledger filter accepts the kind', () => {
    expect(LEDGER_KINDS).toEqual(['SHORTAGE', 'SURPLUS', 'THEFT'])
    expect(readCriteria(new URLSearchParams('kind=THEFT')).entryKind).toBe('THEFT')
    expect(readCriteria(new URLSearchParams('kind=theft')).entryKind).toBe('THEFT')
  })
})

describe('a theft moves no cash', () => {
  it('theft is excluded from the shortage and surplus headline', () => {
    const headline = accountHeadline(THEFT_ENTRIES)
    // 200 of shortage, 150 of surplus — the approved 450.75 is in neither.
    expect(headline.shortageTotal).toBe(200)
    expect(headline.surplusTotal).toBe(150)
    expect(headline.signedPosition).toBe(50)
    // …nor among the entries a till could still consume.
    expect(headline.openCount).toBe(2)
    // It is counted BESIDE the figures, as entries and never as money.
    expect(headline.theftCount).toBe(1)
    expect(headline.pendingCount).toBe(1)
  })

  it('…and from the open settlements tabs’ Shortage and Surplus counts and lists', () => {
    const { counts } = tallyOpenLane({ rows: OPEN_ANSWER, failed: false })
    expect(counts).toEqual({ owing: 1, owed: 1 })
    const owed = buildOpenLane({ rows: OPEN_ANSWER, failed: false, tab: 'owed', mineOnly: false })
    const rows = owed.view.kind === 'rows' ? owed.view.sections.flatMap((s) => s.rows) : []
    expect(rows.map((r) => r.entryKind)).toEqual(['SURPLUS'])
  })

  it('…and the theft tab is not one of the two the front page counts', () => {
    expect(OPEN_LANE_ENTRY_TABS).toEqual(['owing', 'owed'])
    expect(isEntryTab('theft')).toBe(false)
  })

  it('its remaining is never a claim on anybody, whatever its status', () => {
    expect(remainingIsAClaim('OPEN', 'THEFT')).toBe(false)
    expect(remainingIsAClaim('OPEN', 'SURPLUS')).toBe(true)
    const row = projectAccount(THEFT_ACCOUNT).find((r) => r.entryNumber === 1413)!
    expect(row.displayRemaining).toBeNull()
    expect(remainingCell(byNumber(1413), 450.75, 'SAR')).toBe('—')
    // A live surplus beside it still draws its figure.
    expect(remainingCell(byNumber(1411), 150, 'SAR')).not.toBe('—')
  })

  it('an approved theft offers no close-out — a supervisor may cancel it, and nothing else', () => {
    expect(correctionFor(byNumber(1413))).toEqual({ kind: 'cancel', amount: 450.75 })
    // Even on a row whose remaining somehow moved: there is no remainder to write off.
    expect(correctionFor({ ...byNumber(1413), remainingAmount: 100 })).toEqual({ kind: 'cancel', amount: 450.75 })
    // Pending and rejected thefts offer nothing, as for a surplus.
    expect(correctionFor(byNumber(1412))).toEqual({ kind: 'none', because: 'pending' })
    expect(correctionFor(byNumber(1414))).toEqual({ kind: 'none', because: 'rejected' })
  })
})

describe('the bulk upload', () => {
  it('bulk template does not offer theft', () => {
    // The kinds a file may be — and the toggle draws exactly these.
    expect(BULK_KINDS).toEqual(['SHORTAGE', 'SURPLUS'])
    // Neither the blank sheet nor any help text on the upload mentions it.
    expect(bulkTemplateCsv()).not.toMatch(/theft|سرقة/i)
    expect(JSON.stringify(settlement.bulk)).not.toMatch(/theft|سرقة/i)
  })

  it('a server refusal on a theft row is shown as any other', () => {
    const preview: SettlementBulkPreview = {
      batchId: 'B0000MCP5ZGRXP7ZTZ3EHRJQT3',
      contentHash: 'hash',
      entryKind: 'THEFT',
      rows: [
        { rowNumber: 2, storeCode: 'P019', storeName: THEFT_STORE_NAME, currencyKey: 'SAR', amount: 3000, fileAmount: 3000, reason: 'x', awaitsApproval: false },
      ],
      errors: [{ rowNumber: 2, storeCode: 'P019', code: 'THEFT_NOT_IN_BULK', message: 'Row 2: a theft is not accepted in a bulk file.' }],
      warnings: [],
      rowCount: 1,
      canCommit: false,
      total: 3000,
    }
    const review = reviewBulk(preview)
    expect(review.canCommit).toBe(false)
    expect(review.errorsByRow[2]).toEqual(['Row 2: a theft is not accepted in a bulk file.'])
  })
})
