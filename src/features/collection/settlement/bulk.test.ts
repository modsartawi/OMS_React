import { describe, expect, it } from 'vitest'
import { bulkTotals, reviewBulk, UNRESOLVED_BRANCH_CODE } from './bulk'
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
    // ⚠️ The store code rides in `storeCode` and the reason in `code` — the same two
    // fields the server's own issues use (274). `message` stays EMPTY, because it is
    // typed *the server's own words* and this refusal is the screen's: a sentence
    // there would read as the server's to the next caller who renders it generically.
    expect(review.blockers).toEqual([
      {
        rowNumber: 4,
        code: UNRESOLVED_BRANCH_CODE,
        storeCode: '9999',
        message: '',
        source: 'unresolved',
      },
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
    // 274: the replay notice arrives as a file-level WARNING (rowNumber 0) carrying
    // the server's own sentence, not the structured `replay` object 273 modelled.
    const review = reviewBulk(REPLAY_PREVIEW)
    expect(review.canCommit).toBe(true)
    expect(review.fileNotices).toHaveLength(1)
    expect(review.fileNotices[0]).toContain('was posted on')
  })

  it('lifts a row-0 warning out of the per-row map, so no grid can drop it', () => {
    // The defect this guards: a preview grid renders warnings BY ROW, and there is
    // no row 0 to hang one on. Left in `warningsByRow` alone, the replay notice —
    // *somebody may already have posted this month* — would render nowhere.
    const review = reviewBulk(REPLAY_PREVIEW)
    expect(review.warnedRows).toBe(0)
    expect(review.fileNotices.length).toBeGreaterThan(0)
  })

  it('puts the file’s own fault first and refuses a file with no rows', () => {
    const review = reviewBulk(BAD_HEADER_PREVIEW)
    expect(review.canCommit).toBe(false)
    expect(review.blockers[0].rowNumber).toBe(0)
    // 274: the wire locates a fault by machine CODE, not by spreadsheet column.
    expect(review.blockers[0].code).toBe('MissingColumn')
    expect(review.blockers[0].message).toContain('amount')
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
        { rowNumber: 6, storeCode: '0688', code: 'AmountNotNumeric', message: 'Not a number.' },
        {
          rowNumber: 0,
          storeCode: '',
          code: 'MissingColumn',
          message: 'The sheet has no "reason" column.',
        },
        { rowNumber: 3, storeCode: '0207', code: 'AmountNegative', message: 'Negative.' },
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

/**
 * ⚠️ **Two describe blocks stood here until ticket 274** — `planBatchWithdraw`
 * and `summariseBatchWithdraw`, ~90 lines asserting which entries of a batch a cancel
 * would attempt, and how a partly-withdrawn batch reports itself.
 *
 * 🔑 They tested a client-side re-implementation of a server door.
 * `Settlement/Bulk/Cancel` (BackOffice ticket 1186) runs that same loop over the
 * per-entry cancel and answers a row per entry with its own `accepted`,
 * `refusalReason`, `remainingAmount` and `status`. The rulings the deleted code
 * encoded are all still enforced, one layer down where the money is:
 *
 * - a batch is a handle, never a second lifecycle — a consumed row is refused and
 *   NAMED, never written off for sharing a batch;
 * - a partly-withdrawn batch is not an error and nothing rolls back;
 * - untouched is tested inside the guarded UPDATE, not by comparing two rounded
 *   decimals in a browser.
 *
 * ⚠️ The old path also stood on `Settlement/Ledger`, which does not exist (§B1) —
 * so these tests were green against a fixture for a door no server would have
 * answered. That is the failure mode this whole ticket exists to correct, and it is
 * why the replacement is asserted against the live door in 274's Proof rather than
 * re-mocked here.
 */
