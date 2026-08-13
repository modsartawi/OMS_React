import { describe, expect, it } from 'vitest'
import type { SettlementLedgerRow } from '@/core/models/settlement'
import {
  bulkTotals,
  planBatchWithdraw,
  reviewBulk,
  summariseBatchWithdraw,
  type BatchAttempt,
} from './bulk'
import {
  BAD_HEADER_PREVIEW,
  BAD_ROW_PREVIEW,
  CLEAN_PREVIEW,
  CLEAN_ROWS,
  DUPLICATE_PREVIEW,
  MIXED_PREVIEW,
  REPLAY_PREVIEW,
} from './bulk-fixture'

/**
 * **The preview's partition, and the batch withdrawal's plan** — ticket 273's two
 * rules, and the two its Proof names by hand.
 *
 * 🔑 The subject of the first half is a single sentence from spec 267 D7: *hard
 * errors are all-or-nothing; duplicate warnings commit anyway*. Getting it backwards
 * is expensive in a different way in each direction, and neither would show up as a
 * broken screen — a batch stricter than the single form makes a genuine second
 * shortage unpostable by file, and a batch that committed over a hard error leaves
 * finance reconciling a half-posted month against their own sheet.
 */

describe('reviewBulk — the partition', () => {
  it('commits a clean file: every row resolved, nothing blocking', () => {
    const review = reviewBulk(CLEAN_PREVIEW)
    expect(review.canCommit).toBe(true)
    expect(review.blockers).toEqual([])
    expect(review.rows).toHaveLength(5)
    expect(review.warnedRows).toBe(0)
  })

  // 🔑 The ticket's own bullet: an unresolvable code is a hard error and BLOCKS THE
  // WHOLE FILE. Not that row — the file.
  it('blocks the whole file on one unresolvable code', () => {
    const review = reviewBulk(BAD_ROW_PREVIEW)
    expect(review.canCommit).toBe(false)
    // The other four rows are still previewed — finance has to see what it fixed
    // against — but nothing commits.
    expect(review.rows).toHaveLength(5)
    // ⚠️ ONE blocker for one bad row, not two: the server named it, so the client's
    // backstop stands down rather than repeating it in different words.
    expect(review.blockers.map((b) => b.rowNumber)).toEqual([4])
    expect(review.blockers[0].source).toBe('server')
  })

  // 🔑 …and the blocker stands even if the SERVER reported no error for it. The
  // preview grid's whole claim is that every row shows a resolved branch name.
  it('blocks an unnamed row the server did not complain about', () => {
    const silent = {
      ...BAD_ROW_PREVIEW,
      errors: [],
    }
    const review = reviewBulk(silent)
    expect(review.canCommit).toBe(false)
    // ⚠️ The code rides in its OWN field: `message` is typed *the server's own
    // words*, and this refusal is the screen's.
    expect(review.blockers).toEqual([
      { rowNumber: 4, column: 'storeId', message: '', source: 'unresolved', storeId: '9999' },
    ])
  })

  // 🚩 The batch must never be stricter than the single form.
  it('lets a duplicate-kind warning commit, on its own row', () => {
    const review = reviewBulk(DUPLICATE_PREVIEW)
    expect(review.canCommit).toBe(true)
    expect(review.warnedRows).toBe(1)
    expect(review.warningsByRow[2]).toEqual([
      'This branch already carries an open shortage of 500.00 (entry 143).',
    ])
    // …and no other row wears it.
    expect(review.warningsByRow[3]).toBeUndefined()
  })

  it('reads a replayed file as commitable — the content hash warns, never refuses', () => {
    const review = reviewBulk(REPLAY_PREVIEW)
    expect(review.canCommit).toBe(true)
    expect(REPLAY_PREVIEW.replay?.minutesAgo).toBe(4)
  })

  it('puts the file’s own fault first and refuses a file with no rows', () => {
    const review = reviewBulk(BAD_HEADER_PREVIEW)
    expect(review.canCommit).toBe(false)
    expect(review.blockers[0].rowNumber).toBe(0)
    expect(review.blockers[0].column).toBe('amount')
  })

  it('refuses an empty file and an absent answer alike, without throwing', () => {
    expect(reviewBulk({ ...CLEAN_PREVIEW, rows: [] }).canCommit).toBe(false)
    expect(reviewBulk(null).canCommit).toBe(false)
    expect(reviewBulk(undefined).rows).toEqual([])
  })

  it('orders blockers by sheet row — the order finance fixes them in', () => {
    const review = reviewBulk({
      ...CLEAN_PREVIEW,
      errors: [
        { rowNumber: 6, column: 'amount', message: 'Not a number.' },
        { rowNumber: 0, column: 'reason', message: 'The sheet has no "reason" column.' },
        { rowNumber: 3, column: 'amount', message: 'Negative.' },
      ],
    })
    expect(review.blockers.map((b) => b.rowNumber)).toEqual([0, 3, 6])
  })
})

describe('bulkTotals — the figure the words are read off', () => {
  // 🔑 The Proof's own bullet: the total at the commit button matches the sum of the
  // previewed rows.
  it('folds one currency’s rows into one total', () => {
    expect(bulkTotals(CLEAN_ROWS)).toEqual([
      { currencyKey: 'SAR', total: 128_700.5, rowCount: 5 },
    ])
  })

  // A riyal added to a dinar is a figure wrong in both — the rule `figures.ts`
  // enforces estate-wide, one screen over.
  it('never folds two currencies into one figure', () => {
    expect(bulkTotals(MIXED_PREVIEW.rows)).toEqual([
      { currencyKey: 'SAR', total: 500, rowCount: 1 },
      { currencyKey: 'BHD', total: 95.25, rowCount: 1 },
    ])
  })

  it('keeps a lower-case currency code in its own total', () => {
    const rows = CLEAN_ROWS.map((r) => ({ ...r, currencyKey: 'sar' }))
    expect(bulkTotals(rows)).toEqual([{ currencyKey: 'SAR', total: 128_700.5, rowCount: 5 }])
  })

  // 🔑 Raised by `/code-review`: a row with no currency code was dropped by
  // `distinctCurrencies`, so a whole file could reach the commit button with NO
  // read-back rendered at all — the aggregate guard failing open, silently.
  it('keeps a row with NO currency code in a bucket of its own', () => {
    const rows = [
      { ...CLEAN_ROWS[0], currencyKey: 'SAR' },
      { ...CLEAN_ROWS[1], currencyKey: '' },
    ]
    const totals = bulkTotals(rows)
    expect(totals).toEqual([
      { currencyKey: 'SAR', total: 500, rowCount: 1 },
      { currencyKey: '', total: 1250.5, rowCount: 1 },
    ])
    // …and every row is still accounted for, which is what licenses the commit.
    expect(totals.reduce((n, t) => n + t.rowCount, 0)).toBe(rows.length)
    expect(reviewBulk({ ...CLEAN_PREVIEW, rows, total: 1750.5 }).canCommit).toBe(true)
  })

  it('is empty for no rows at all', () => {
    expect(bulkTotals([])).toEqual([])
    expect(bulkTotals(null)).toEqual([])
  })
})

describe('reviewBulk — the server’s scalar total, cross-checked', () => {
  it('says nothing when the rows and the server agree', () => {
    expect(reviewBulk(CLEAN_PREVIEW).disagreement).toBeNull()
  })

  // 🚩 It does not block. The rows are what was reviewed and the rows are what
  // commits — but a guard that quietly disagreed with the server's own sum would be
  // a guard nobody could trust.
  it('states a disagreement without blocking the commit', () => {
    const review = reviewBulk({ ...CLEAN_PREVIEW, total: 128_200.5 })
    expect(review.disagreement).toEqual({ server: 128_200.5, rows: 128_700.5 })
    expect(review.canCommit).toBe(true)
  })

  it('stands down on a mixed-currency file, where the scalar describes nothing', () => {
    expect(reviewBulk(MIXED_PREVIEW).disagreement).toBeNull()
  })
})

/* ── cancel as a unit ─────────────────────────────────────────────────────── */

const entry = (
  entryNumber: number,
  status: SettlementLedgerRow['status'],
  amount: number,
  remainingAmount: number,
): SettlementLedgerRow => ({
  settlementEntryId: `01J9BATCHE${entryNumber}`,
  entryNumber,
  storeId: `0${entryNumber}`,
  storeName: `Branch ${entryNumber}`,
  currencyKey: 'SAR',
  entryKind: 'SHORTAGE',
  amount,
  remainingAmount,
  reason: 'عجز جرد شهر يوليو',
  status,
  batchId: '01J9BATCHCLEAN',
  postedByStaffId: '30117',
  postedByName: 'ضحى العتيبي / Duha Al-Otaibi',
  postedAt: '2026-08-13T09:41:00',
  closedByStaffId: '',
  closedAt: '',
  closedReason: '',
})

describe('planBatchWithdraw — 272’s decision, across a batch', () => {
  it('attempts only the untouched entries, and names every row it will not', () => {
    const plan = planBatchWithdraw([
      entry(901, 'OPEN', 500, 500),
      entry(902, 'OPEN', 1250.5, 900), // a till took part of it
      entry(903, 'CONSUMED', 4300, 0),
      entry(904, 'CANCELLED', 120_000, 120_000),
      entry(905, 'CLOSED_OUT', 2650, 0),
    ])

    expect(plan.cancellable.map((r) => r.entryNumber)).toEqual([901])
    expect(plan.skipped.map((s) => [s.row.entryNumber, s.because])).toEqual([
      [902, 'partly-consumed'],
      [903, 'consumed'],
      [904, 'cancelled'],
      [905, 'written-off'],
    ])
  })

  // ⚠️ 272's ruling, unchanged: a BHD entry consumed by one fils is partly consumed,
  // and rounding that away at the branch's display precision would attempt a cancel
  // the server refuses.
  it('tests untouched at the scale money is HELD at', () => {
    const fils = { ...entry(906, 'OPEN', 95.25, 95.249), currencyKey: 'BHD' }
    expect(planBatchWithdraw([fils]).cancellable).toEqual([])
    expect(planBatchWithdraw([fils]).skipped[0].because).toBe('partly-consumed')
  })

  it('plans nothing from nothing', () => {
    expect(planBatchWithdraw(null)).toEqual({ cancellable: [], skipped: [] })
  })
})

describe('summariseBatchWithdraw — a partly-withdrawn batch is not an error', () => {
  // 🔑 The ticket's own requirement: report which rows a till already consumed and
  // therefore could not be cancelled — NAMED, not counted.
  it('separates what was withdrawn from what a till got to first', () => {
    const withdrawn = entry(901, 'OPEN', 500, 500)
    const raced = entry(902, 'OPEN', 1250.5, 1250.5)
    const attempts: BatchAttempt[] = [
      { row: withdrawn, result: { accepted: true, refusalReason: '', remainingAmount: 500 } },
      {
        row: raced,
        result: {
          accepted: false,
          refusalReason: 'A till consumed part of this entry.',
          remainingAmount: 900,
        },
      },
    ]

    const outcome = summariseBatchWithdraw(attempts)
    expect(outcome.withdrawn.map((r) => r.entryNumber)).toEqual([901])
    expect(outcome.refused).toEqual([
      { row: raced, reason: 'A till consumed part of this entry.', remaining: 900 },
    ])
    expect(outcome.failed).toEqual([])
  })

  it('reports the entry’s last known remaining when a refusal carried no figure', () => {
    const raced = entry(902, 'OPEN', 1250.5, 1250.5)
    const outcome = summariseBatchWithdraw([
      {
        row: raced,
        result: {
          accepted: false,
          refusalReason: 'No.',
          remainingAmount: Number.NaN,
        },
      },
    ])
    expect(outcome.refused[0].remaining).toBe(1250.5)
  })

  // 🔑 Raised by `/standards-review`: a BUSINESS refusal that arrives as an error
  // (the envelope saying no) is still a refusal, and `api-envelope` forbids
  // flattening the server's words into *"the state is unknown"*.
  it('reports a refusal that arrived as an ERROR with the refusals, named', () => {
    const row = entry(904, 'OPEN', 120_000, 120_000)
    const outcome = summariseBatchWithdraw([
      { row, result: null, refusedBecause: 'This entry belongs to a batch being cancelled.' },
    ])
    expect(outcome.refused).toEqual([
      { row, reason: 'This entry belongs to a batch being cancelled.', remaining: 120_000 },
    ])
    expect(outcome.failed).toEqual([])
  })

  // A call that never completed leaves the entry's state UNKNOWN, not decided —
  // reporting it as surviving would be a lie about money.
  it('keeps a transport failure apart from a refusal', () => {
    const row = entry(903, 'OPEN', 4300, 4300)
    const outcome = summariseBatchWithdraw([{ row, result: null, failed: true }])
    expect(outcome.failed.map((r) => r.entryNumber)).toEqual([903])
    expect(outcome.refused).toEqual([])
    expect(outcome.withdrawn).toEqual([])
  })
})
