import type {
  SettlementBulkPreview,
  SettlementBulkRow,
} from '@/core/models/settlement'

/**
 * **A month's audit, as four files** — ticket 273's fixture, shared by
 * `bulk.test.ts` and served by `tools/settlement-drive.mjs` over the two bulk
 * doors.
 *
 * 🔑 **They are the four outcomes the preview exists to tell apart**, and each one
 * broke something on the way here:
 *
 * | file | what it proves |
 * |---|---|
 * | `CLEAN_PREVIEW` | the ordinary month — every code resolved, one currency, commits |
 * | `BAD_ROW_PREVIEW` | 🔑 one unresolvable code **blocks the whole file** (the ticket's all-or-nothing rule) |
 * | `DUPLICATE_PREVIEW` | 🔑 a duplicate-kind row **warns on its row and commits anyway** |
 * | `REPLAY_PREVIEW` | the content hash **warns and never refuses** — *posted 4 minutes ago by ضحى* |
 *
 * ⚠️ **`CLEAN_PREVIEW` is deliberately single-currency**, so its scalar `total` is
 * checkable against the rows' own fold. The mixed case lives in `MIXED_PREVIEW`,
 * where D8's scalar describes nothing and the screen reads back one sentence per
 * currency (D10). `BAD_HEADER_PREVIEW` is the file's own fault rather than a row's.
 *
 * 🚩 The Arabic is real, not transliterated back — `settlement-fixture.ts`'s ruling:
 * a retyped Arabic string looks right and is a different sequence of code points.
 */

const row = (
  rowNumber: number,
  storeCode: string,
  storeName: string,
  amount: number,
  reason: string,
  currencyKey = 'SAR',
): SettlementBulkRow => ({
  rowNumber,
  // ⚠️ 274: the wire calls it `storeCode` — the code as the SHEET spelled it, echoed
  // back whether or not it resolved. Every other door on this contract says
  // `storeId`; this one row type is the server's own exception.
  storeCode,
  storeName,
  currencyKey,
  amount,
  // ✅ 274: the pre-rounding figure. Equal to `amount` on a file that needed no
  // rounding, which is every row here except where a case says otherwise.
  fileAmount: amount,
  reason,
})

/** One server issue — errors and warnings share a shape (274: `SettlementBulkIssueModel`). */
const issue = (rowNumber: number, storeCode: string, code: string, message: string) => ({
  rowNumber,
  storeCode,
  code,
  message,
})

/** The ordinary month: five branches, one kind, one currency, nothing wrong. */
export const CLEAN_ROWS: SettlementBulkRow[] = [
  row(2, '0142', 'الروضة / Al-Rawdah', 500, 'عجز جرد شهر يوليو'),
  row(3, '0207', 'العليا / Al-Olaya', 1250.5, 'عجز جرد شهر يوليو'),
  row(4, '0331', 'النسيم / Al-Naseem', 4300, 'عجز جرد شهر يوليو'),
  row(5, '0455', 'قرطبة / Qurtubah', 120_000, 'عجز جرد شهر يوليو'),
  row(6, '0688', 'حطين / Hittin', 2650, 'عجز جرد شهر يوليو'),
]

const CLEAN_TOTAL = 128_700.5

export const CLEAN_PREVIEW: SettlementBulkPreview = {
  batchId: '01J9BATCHCLEAN',
  contentHash: 'sha256:9f2b1c',
  entryKind: 'SHORTAGE',
  rows: CLEAN_ROWS,
  errors: [],
  warnings: [],
  rowCount: CLEAN_ROWS.length,
  canCommit: true,
  total: CLEAN_TOTAL,
}

/**
 * 🔑 **One unresolvable code, and the whole file stops.**
 *
 * The bad row carries a `storeName` of `''` **and** a server error, because that is
 * how the live door will answer — but `bulk.ts` blocks on the empty name alone, so
 * a server that resolved nothing and reported nothing still cannot commit money onto
 * a branch this screen cannot name.
 */
export const BAD_ROW_PREVIEW: SettlementBulkPreview = {
  batchId: '01J9BATCHBAD',
  contentHash: 'sha256:44ae07',
  entryKind: 'SHORTAGE',
  rows: [
    ...CLEAN_ROWS.slice(0, 2),
    row(4, '9999', '', 3000, 'عجز جرد شهر يوليو'),
    ...CLEAN_ROWS.slice(3),
  ],
  errors: [issue(4, '9999', 'StoreNotFound', 'No branch has the code 9999.')],
  warnings: [],
  rowCount: 5,
  canCommit: false,
  total: 126_450.5,
}

/** A file whose header row is missing a required column — the file's own fault,
 *  reported at `rowNumber: 0` and naming what it expected (the ticket's open
 *  question, built against rather than guessed at). */
export const BAD_HEADER_PREVIEW: SettlementBulkPreview = {
  batchId: '01J9BATCHHDR',
  contentHash: 'sha256:0c11de',
  entryKind: 'SHORTAGE',
  rows: [],
  errors: [
    issue(
      0,
      '',
      'MissingColumn',
      'The sheet has no "amount" column. Expected: store, amount, reason.',
    ),
  ],
  warnings: [],
  rowCount: 0,
  canCommit: false,
  total: 0,
}

/**
 * 🔑 **A duplicate warns on its row and commits.** 0142 already carries an open
 * shortage on the account fixture — the batch must never be stricter than the single
 * form, which warns and posts.
 */
export const DUPLICATE_PREVIEW: SettlementBulkPreview = {
  batchId: '01J9BATCHDUP',
  contentHash: 'sha256:71bb92',
  entryKind: 'SHORTAGE',
  rows: CLEAN_ROWS,
  errors: [],
  warnings: [
    issue(
      2,
      '0142',
      'DuplicateOpenEntry',
      'This branch already carries an open shortage of 500.00 (entry 143).',
    ),
  ],
  rowCount: CLEAN_ROWS.length,
  canCommit: true,
  total: CLEAN_TOTAL,
}

/**
 * The same file, uploaded twice — the content hash **warns and never refuses**.
 *
 * ⚠️ **274: the notice is a warning at `rowNumber: 0`**, carrying the server's own
 * sentence, not the structured `replay` object 273 modelled. Row 0 is the FILE's, so
 * a grid rendering warnings per row would drop it — which is why `bulk.ts` lifts it
 * into `fileNotices`.
 */
export const REPLAY_PREVIEW: SettlementBulkPreview = {
  ...CLEAN_PREVIEW,
  batchId: '01J9BATCHREPLAY',
  warnings: [
    issue(
      0,
      '',
      'RecentIdenticalBatch',
      `A file with these ${CLEAN_ROWS.length} rows was posted on 2026-08-13 09:41 by ضحى العتيبي / Duha Al-Otaibi.`,
    ),
  ],
}

/** Riyals and dinars in one file: D8's scalar `total` describes nothing, so the
 *  read-back is one sentence per currency and the cross-check stands down. */
export const MIXED_PREVIEW: SettlementBulkPreview = {
  batchId: '01J9BATCHMIXED',
  contentHash: 'sha256:aa30f1',
  entryKind: 'SURPLUS',
  rows: [
    row(2, '0142', 'الروضة / Al-Rawdah', 500, 'مرتجع شبكة'),
    row(3, '0900', 'المنامة / Manama', 95.25, 'مرتجع شبكة', 'BHD'),
  ],
  errors: [],
  warnings: [],
  rowCount: 2,
  canCommit: true,
  total: 595.25,
}
