import { describe, expect, it } from 'vitest'
import {
  COMMIT_ROW_ERRORS,
  HASH_MISMATCH,
  commitOutcome,
  describeIssue,
  englishLine,
  fileRefusalKey,
  profitCenterChange,
  reviewUpload,
  withCommitRowErrors,
  type AssignmentUploadCommit,
  type AssignmentUploadPreview,
} from './assignment-upload'

/**
 * **The assignment file's preview and commit** — ticket 318 against BackOffice 1996's
 * `## Web contract`, whose samples are used VERBATIM below.
 *
 * 🔑 The screen renders the server's reading of the file and decides almost nothing —
 * but the few things it does decide are the silent kind: whether Apply is offered,
 * whether a refused commit reads as a success, and which row a refusal is hung on.
 */

/** 1996's preview sample, verbatim. */
const SAMPLE: AssignmentUploadPreview = {
  contentHash: '9f2c4e0b7d1a5c3e8b6f0a2d4c6e8f1a3b5d7f9e0c2a4b6d8f0e1c3a5b7d9f2e',
  rowCount: 3,
  changeCount: 2,
  unchangedCount: 1,
  canCommit: false,
  rows: [
    { rowNumber: 2, storeCode: 'P019', storeName: 'Al-Dawaa P019',
      currentAccountantId: '4466', accountantId: '4471', accountantChanges: true,
      currentCollectorId: '5120', collectorId: '5120', collectorChanges: false, changes: true },
    { rowNumber: 3, storeCode: 'P020', storeName: 'Al-Dawaa P020',
      currentAccountantId: '4466', accountantId: '4466', accountantChanges: false,
      currentCollectorId: '5120', collectorId: '5120', collectorChanges: false, changes: false },
    { rowNumber: 4, storeCode: 'P9X9', storeName: 'P9X9',
      currentAccountantId: '', accountantId: '4471', accountantChanges: true,
      currentCollectorId: '', collectorId: '', collectorChanges: false, changes: true },
  ],
  errors: [
    { rowNumber: 4, storeCode: 'P9X9', column: 'StoreCode', code: 'UNKNOWN_STORE',
      message: "'P9X9' is not an open branch.\n'P9X9' ليس فرعاً مفتوحاً." },
  ],
}

/** The same file with the bad row fixed — what finance uploads next. */
const CLEAN: AssignmentUploadPreview = {
  ...SAMPLE,
  rowCount: 2,
  changeCount: 1,
  unchangedCount: 1,
  canCommit: true,
  rows: SAMPLE.rows.slice(0, 2),
  errors: [],
}

/** 1996's commit sample, verbatim. */
const APPLIED: AssignmentUploadCommit = {
  accepted: true,
  refusalReason: '',
  applied: 2,
  appliedStoreCodes: ['P019', 'P021'],
  unchanged: 1,
  errors: [],
  updatedBy: '4401',
  updatedAt: '2026-09-25T10:14:32.517',
}

const REFUSED_STAMP = { updatedBy: '', updatedAt: '0001-01-01T00:00:00' }

describe('reviewUpload — what the preview offers', () => {
  it('names the refused row and refuses the whole file (the contract sample)', () => {
    const review = reviewUpload(SAMPLE)
    expect(review.canCommit).toBe(false)
    expect(review.refusedRows).toBe(1)
    expect(Object.keys(review.issuesByRow)).toEqual(['4'])
    expect(review.issuesByRow[4][0].code).toBe('UNKNOWN_STORE')
    // The rows that are fine are still previewed — finance fixes the sheet against them.
    expect(review.rows).toHaveLength(3)
  })

  it('counts changes per store from the rows, never from a client comparison', () => {
    const review = reviewUpload(SAMPLE)
    expect(review.changed).toBe(2)
    expect(review.unchanged).toBe(1)
  })

  it('offers Apply on a clean file that changes something', () => {
    const review = reviewUpload(CLEAN)
    expect(review.canCommit).toBe(true)
    expect(review.nothingToApply).toBe(false)
  })

  // 🔑 `canCommit` is REQUIRED and read `=== true`: an answer that omits it, or says
  // anything but true, does not open the door.
  it('does not offer Apply when the server did not say canCommit: true', () => {
    const { canCommit: _dropped, ...rest } = CLEAN
    expect(reviewUpload(rest as AssignmentUploadPreview).canCommit).toBe(false)
    expect(reviewUpload({ ...CLEAN, canCommit: 'true' as unknown as boolean }).canCommit).toBe(false)
  })

  // ⚠️ …and the errors outrank the flag: a preview naming a bad row never commits,
  // whatever the boolean beside it says.
  it('refuses a file with errors even if the flag says it may commit', () => {
    expect(reviewUpload({ ...SAMPLE, canCommit: true }).canCommit).toBe(false)
  })

  // A file of the estate as it already stands is valid and writes nothing — so the
  // button that would write nothing is not offered, and the screen says why.
  it('does not offer Apply when no row changes anything', () => {
    const same = { ...CLEAN, rows: [CLEAN.rows[1]], rowCount: 1, changeCount: 0, unchangedCount: 1 }
    const review = reviewUpload(same)
    expect(review.canCommit).toBe(false)
    expect(review.nothingToApply).toBe(true)
  })

  it('holds a file-level issue (row 0) apart from the rows', () => {
    const fileIssue = { rowNumber: 0, storeCode: '', column: '', code: HASH_MISMATCH, message: 'x' }
    const review = reviewUpload({ ...SAMPLE, errors: [fileIssue, ...SAMPLE.errors] })
    expect(review.fileIssues).toEqual([fileIssue])
    expect(review.issuesByRow[0]).toBeUndefined()
    expect(review.refusedRows).toBe(1)
  })

  it('reads nothing as nothing', () => {
    const review = reviewUpload(null)
    expect(review.rows).toEqual([])
    expect(review.canCommit).toBe(false)
  })
})

describe('describeIssue — the copy is keyed off the code', () => {
  const rows = SAMPLE.rows

  it('keys a known store refusal and names the store', () => {
    expect(describeIssue(SAMPLE.errors[0], rows)).toEqual({
      kind: 'known',
      code: 'UNKNOWN_STORE',
      store: 'P9X9',
      staffId: '',
      slot: null,
    })
  })

  // The issue carries no staff id; the row's after-value in that column IS the file's
  // id (the server keeps it verbatim when it does not resolve).
  it('names the staff id of a staff refusal from its own row and column', () => {
    const issue = { rowNumber: 2, storeCode: 'P019', column: 'AccountantId', code: 'STAFF_INACTIVE', message: 'm' }
    expect(describeIssue(issue, rows)).toEqual({
      kind: 'known',
      code: 'STAFF_INACTIVE',
      store: 'P019',
      staffId: '4471',
      slot: 'accountantId',
    })
    const collector = { ...issue, column: 'CollectorId', code: 'STAFF_WRONG_ROLE' }
    expect(describeIssue(collector, rows)).toMatchObject({ staffId: '5120', slot: 'collectorId' })
  })

  // 🚩 A code this screen has not learned yet still says something true: the
  // server's own words, never a blank and never a raw code.
  // …in English only: the message is English, a newline, then Arabic, and the web is
  // English-only.
  it('falls back to the English line of the server message for a code it does not know', () => {
    const issue = { rowNumber: 2, storeCode: 'P019', column: '', code: 'SOMETHING_NEW', message: 'New rule.\nقاعدة.' }
    expect(describeIssue(issue, rows)).toEqual({ kind: 'server', message: 'New rule.' })
  })
})

describe('commitOutcome — a refusal must never read as a success', () => {
  it('reads the sample as applied', () => {
    expect(commitOutcome(APPLIED)).toBe('applied')
  })

  // 🔑 The re-press: the same file again writes nothing and says so — it is not a
  // failure, and it is not "2 branches assigned" a second time.
  it('reads a re-press (accepted, applied 0) as nothing applied', () => {
    expect(commitOutcome({ ...APPLIED, applied: 0, appliedStoreCodes: [], unchanged: 3 })).toBe('nothingApplied')
  })

  it('reads HASH_MISMATCH and ROW_ERRORS as the refusals they are', () => {
    const refused = { ...APPLIED, ...REFUSED_STAMP, accepted: false, applied: 0, appliedStoreCodes: [] }
    expect(commitOutcome({ ...refused, refusalReason: HASH_MISMATCH })).toBe('hashMismatch')
    expect(commitOutcome({ ...refused, refusalReason: COMMIT_ROW_ERRORS })).toBe('rowErrors')
    expect(commitOutcome({ ...refused, refusalReason: 'SOMETHING_NEW' })).toBe('refused')
  })

  // `accepted` is REQUIRED and read `=== true`; `applied` without it is not a write.
  it('reads an answer without accepted: true as refused', () => {
    const { accepted: _dropped, ...rest } = APPLIED
    expect(commitOutcome(rest as AssignmentUploadCommit)).toBe('refused')
    expect(commitOutcome(null)).toBe('refused')
  })
})

describe('withCommitRowErrors — a row gone bad since the preview', () => {
  it('folds the commit’s rows onto the preview and shuts the door', () => {
    const errors = [
      { rowNumber: 2, storeCode: 'P019', column: 'AccountantId', code: 'STAFF_INACTIVE', message: 'm' },
    ]
    const refused: AssignmentUploadCommit = {
      ...APPLIED,
      ...REFUSED_STAMP,
      accepted: false,
      refusalReason: COMMIT_ROW_ERRORS,
      applied: 0,
      appliedStoreCodes: [],
      errors,
    }
    const folded = withCommitRowErrors(CLEAN, refused)
    expect(folded?.errors).toEqual(errors)
    expect(reviewUpload(folded).canCommit).toBe(false)
    expect(reviewUpload(folded).issuesByRow[2]).toHaveLength(1)
  })

  it('leaves every other answer to the caller', () => {
    expect(withCommitRowErrors(CLEAN, APPLIED)).toBeNull()
    expect(
      withCommitRowErrors(CLEAN, { ...APPLIED, accepted: false, refusalReason: HASH_MISMATCH }),
    ).toBeNull()
    // An empty ROW_ERRORS list folded on would re-open a commit the server refused.
    expect(
      withCommitRowErrors(CLEAN, { ...APPLIED, accepted: false, refusalReason: COMMIT_ROW_ERRORS, errors: [] }),
    ).toBeNull()
  })
})

describe('englishLine — the server’s sentence, on an English-only screen', () => {
  it('keeps the English line and drops the Arabic after it', () => {
    expect(englishLine("'P9X9' is not an open branch.\n'P9X9' ليس فرعاً مفتوحاً.")).toBe("'P9X9' is not an open branch.")
    expect(englishLine('The file has no StoreCode column.\r\nلا يحتوي')).toBe('The file has no StoreCode column.')
  })

  it('returns a one-line message whole, and nothing as nothing', () => {
    expect(englishLine('A file is required.')).toBe('A file is required.')
    expect(englishLine(null)).toBe('')
  })
})

describe('fileRefusalKey — the 400s that cannot yield rows', () => {
  it('keys the refusals whose own words add nothing', () => {
    expect(fileRefusalKey('AssignmentUploadFileRequired')).toBe('fileRequired')
    expect(fileRefusalKey('AssignmentUploadFileTooLarge')).toBe('fileTooLarge')
    expect(fileRefusalKey('AssignmentUploadFileTypeUnsupported')).toBe('fileType')
    expect(fileRefusalKey('AssignmentUploadContentHashRequired')).toBe('hashRequired')
  })

  // 🚩 The unreadable file's message names WHICH problem (no branch column, not
  // UTF-8, over 2000 rows) — a key would say less than the server did.
  it('leaves the unreadable file, and anything else, to the server’s words', () => {
    expect(fileRefusalKey('AssignmentUploadFileUnreadable')).toBeNull()
    expect(fileRefusalKey('AssignmentUploadNoRows')).toBeNull()
    expect(fileRefusalKey('AssignmentActorRequired')).toBeNull()
    expect(fileRefusalKey(null)).toBeNull()
  })
})

/**
 * **The profit center** — ticket 338 against BackOffice 2157's `## Web contract`, which
 * amends 1996's: three added row fields, and `changes` now true when the profit center
 * alone changes. Its samples are used VERBATIM.
 */
describe('the profit center column (BackOffice 2157)', () => {
  /** 2157's preview row sample, verbatim. */
  const PC_ROW = {
    rowNumber: 2, storeCode: 'P019', storeName: 'Al-Dawaa P019',
    currentAccountantId: '4466', accountantId: '4466', accountantChanges: false,
    currentCollectorId: '5120', collectorId: '5120', collectorChanges: false,
    currentProfitCenter: '', profitCenter: 'PH-019', profitCenterChanges: true,
    changes: true,
  }
  /** 2157's refusal sample, verbatim. */
  const TOO_LONG = {
    rowNumber: 5, storeCode: 'P021', column: 'ProfitCenter', code: 'PROFIT_CENTER_TOO_LONG',
    message: "The profit center 'PH-021000000000000000' is 21 characters; at most 20 fit.\nمركز الربح 'PH-021000000000000000' طوله 21 حرفاً، والحد الأقصى 20.",
  }
  const PC_ONLY: AssignmentUploadPreview = {
    contentHash: SAMPLE.contentHash,
    rowCount: 1,
    changeCount: 1,
    unchangedCount: 0,
    canCommit: true,
    rows: [PC_ROW],
    errors: [],
  }

  it('preview shows current and new profit center', () => {
    expect(profitCenterChange(PC_ROW)).toEqual({ before: '', after: 'PH-019', changes: true })
    // A replaced value: the case is the server's call (it compares case-sensitively), and
    // the screen draws its flag rather than comparing the two strings itself.
    const recased = { ...PC_ROW, currentProfitCenter: 'PH-019', profitCenter: 'ph-019' }
    expect(profitCenterChange(recased)).toEqual({ before: 'PH-019', after: 'ph-019', changes: true })
    // A blank cell (or no column) leaves it: after = current, and nothing changes.
    const kept = { ...PC_ROW, currentProfitCenter: 'PH-019', profitCenter: 'PH-019', profitCenterChanges: false }
    expect(profitCenterChange(kept)).toEqual({ before: 'PH-019', after: 'PH-019', changes: false })
  })

  // ⚠️ A door that predates 2157 sends none of the three fields — the column reads as
  // nothing recorded and unchanged, never as a change the server did not report.
  it('reads a row from a door without the fields as unchanged and blank', () => {
    expect(profitCenterChange(SAMPLE.rows[0])).toEqual({ before: '', after: '', changes: false })
    expect(profitCenterChange({ ...PC_ROW, profitCenterChanges: 'true' as unknown as boolean }).changes).toBe(false)
  })

  // 🔑 The row's only change is its profit center: it counts, and Apply is offered on it.
  it('a profit-center-only row is shown as a change', () => {
    const review = reviewUpload(PC_ONLY)
    expect(review.changed).toBe(1)
    expect(review.unchanged).toBe(0)
    expect(review.nothingToApply).toBe(false)
    expect(review.canCommit).toBe(true)
  })

  // The over-long value is a row refusal like the others: hung on its row, the file
  // refused, and worded in the server's sentence (which names the value, its length and
  // the limit — read off the live column, so a key of this screen's could not know it).
  it('shows an over-long profit center as a row refusal, in the server’s words', () => {
    const rows = [{ ...PC_ROW, rowNumber: 5, storeCode: 'P021', profitCenter: 'PH-021000000000000000' }]
    const review = reviewUpload({ ...PC_ONLY, canCommit: false, rows, errors: [TOO_LONG] })
    expect(review.canCommit).toBe(false)
    expect(review.issuesByRow[5]).toEqual([TOO_LONG])
    expect(describeIssue(TOO_LONG, rows)).toEqual({
      kind: 'server',
      message: "The profit center 'PH-021000000000000000' is 21 characters; at most 20 fit.",
    })
  })

  // `PROFIT_CENTER_UNAVAILABLE` is one file-level entry (row 0): it heads the list, it is
  // not hung on a row, and it refuses the file.
  it('holds the file-level unavailable refusal apart from the rows', () => {
    const unavailable = {
      rowNumber: 0, storeCode: '', column: 'ProfitCenter', code: 'PROFIT_CENTER_UNAVAILABLE',
      message: 'The profit center cannot be stored yet.\nلا يمكن',
    }
    const review = reviewUpload({ ...PC_ONLY, canCommit: false, errors: [unavailable] })
    expect(review.fileIssues).toEqual([unavailable])
    expect(review.refusedRows).toBe(0)
    expect(review.canCommit).toBe(false)
  })
})
