/**
 * **An assignment file, previewed and then committed** — ticket 318 (spec 308),
 * against the `## Web contract` of BackOffice
 * [1996](C:\Work\DMSCO\BackOffice\.issues\1996-an-assignment-file-is-previewed-and-committed-as-one-act.md).
 *
 * Finance keeps who serves which branch in its own sheet (StoreCode, AccountantId,
 * CollectorId). The Branches tab sets one row at a time and 1171's bulk flows set one
 * slot over a set; this sets many branches' two slots from that sheet, in one act.
 *
 * 🔑 **The settlement bulk upload's shape, on purpose** (`settlement/bulk.ts`): the
 * client uploads bytes and parses nothing, the preview is the server's reading of the
 * file, and the commit **re-sends the same file** with the preview's `contentHash`.
 * There is no client-held row state that could have drifted from what was reviewed.
 *
 * 🔑 **A blank cell leaves that side unchanged** (the server's rule, not this file's):
 * a file cannot clear a slot, so the preview's after-values already say what the
 * branch will hold, and nothing here re-derives them.
 *
 * Pure — no React, no i18n, no network, no clock — the seam `assignment.ts` and
 * `bulk.ts` beside it use.
 */

/** One file row as the preview grid renders it — `AssignmentUploadRowModel`. */
export interface AssignmentUploadRow {
  /** The sheet's own row number (the header is row 1). */
  rowNumber: number
  /** The Store master's spelling when the branch resolves; the file's text when not. */
  storeCode: string
  /** `Store.Description`, or the file's text again when the branch does not resolve. */
  storeName: string
  /** Before the commit; `''` = nobody. */
  currentAccountantId: string
  /** After the commit — the file's id, or the current one when the cell was blank. */
  accountantId: string
  accountantChanges: boolean
  currentCollectorId: string
  collectorId: string
  collectorChanges: boolean
  /** Either side changes. */
  changes: boolean
}

/** One bad cell, or the file's own fault at `rowNumber: 0` — `AssignmentUploadIssueModel`. */
export interface AssignmentUploadIssue {
  rowNumber: number
  storeCode: string
  /** `StoreCode`, `AccountantId`, `CollectorId`, or `''` for the file. */
  column: string
  code: string
  /** English, a newline, then Arabic — a FALLBACK. The copy is keyed off `code`. */
  message: string
}

/** `POST CollectionWeb/Assignment/Upload/Preview` → `data`. Writes nothing. */
export interface AssignmentUploadPreview {
  /** Sent back on the commit, verbatim. */
  contentHash: string
  rowCount: number
  changeCount: number
  unchangedCount: number
  /** `errors.length === 0`, stated. REQUIRED, and read `=== true`. */
  canCommit: boolean
  rows: AssignmentUploadRow[]
  errors: AssignmentUploadIssue[]
}

/** `POST CollectionWeb/Assignment/Upload/Commit` → `data`. All or nothing. */
export interface AssignmentUploadCommit {
  /** `false` = nothing was written; see `refusalReason`. REQUIRED, read `=== true`. */
  accepted: boolean
  /** `''`, `HASH_MISMATCH` or `ROW_ERRORS`. */
  refusalReason: string
  /** Branches this press wrote — `0` on a re-press of a file already applied. */
  applied: number
  appliedStoreCodes: string[]
  unchanged: number
  errors: AssignmentUploadIssue[]
  /** This act's stamp; `''` / `0001-01-01T00:00:00` when refused. */
  updatedBy: string
  updatedAt: string
}

/** The commit's two refusal reasons (`AssignmentUploadIssueCodes`). */
export const HASH_MISMATCH = 'HASH_MISMATCH'
export const COMMIT_ROW_ERRORS = 'ROW_ERRORS'

/**
 * The preview row codes this screen has its own words for. A code outside the list is
 * a rule the server grew after this screen shipped, and it is shown in the server's
 * words rather than dropped (`describeIssue`).
 */
export const UPLOAD_ISSUE_CODES = [
  'STORE_REQUIRED',
  'UNKNOWN_STORE',
  'REPEATED_STORE',
  'STAFF_UNKNOWN',
  'STAFF_INACTIVE',
  'STAFF_WRONG_ROLE',
] as const
export type UploadIssueCode = (typeof UPLOAD_ISSUE_CODES)[number]

/** The file, reviewed. */
export interface UploadReview {
  rows: AssignmentUploadRow[]
  /** Rows whose accountant or collector will change — counted off the server's own
   *  per-row flags, never by comparing ids here. */
  changed: number
  unchanged: number
  /** The refusals by sheet row, so each row wears its own. Rows with none are absent. */
  issuesByRow: Record<number, AssignmentUploadIssue[]>
  /** The file's own faults (`rowNumber: 0`) — there is no row to hang them on. */
  fileIssues: AssignmentUploadIssue[]
  /** How many ROWS are refused (one row can carry two refusals). */
  refusedRows: number
  /** A clean file that changes nothing: valid, and nothing to apply. */
  nothingToApply: boolean
  /**
   * 🔑 **Apply is offered only when all four hold**: the server said `canCommit: true`,
   * it named no error, there are rows, and at least one of them changes something.
   * The errors outrank the flag — a preview that names a bad row never commits.
   */
  canCommit: boolean
}

export function reviewUpload(preview: AssignmentUploadPreview | null | undefined): UploadReview {
  const rows = preview?.rows ?? []
  const errors = preview?.errors ?? []

  const issuesByRow: Record<number, AssignmentUploadIssue[]> = {}
  const fileIssues: AssignmentUploadIssue[] = []
  for (const issue of errors) {
    if (issue.rowNumber > 0) (issuesByRow[issue.rowNumber] ??= []).push(issue)
    else fileIssues.push(issue)
  }

  const changed = rows.filter((row) => row.changes === true).length
  const clean = preview?.canCommit === true && errors.length === 0 && rows.length > 0

  return {
    rows,
    changed,
    unchanged: rows.length - changed,
    issuesByRow,
    fileIssues,
    refusedRows: Object.keys(issuesByRow).length,
    nothingToApply: clean && changed === 0,
    canCommit: clean && changed > 0,
  }
}

/** What a refusal says: this screen's own words for a code it knows, the server's
 *  for one it does not. */
export type IssueCopy =
  | {
      kind: 'known'
      code: UploadIssueCode
      store: string
      /** The id in the refused cell, `''` for a store refusal. */
      staffId: string
      /** Which slot the refused cell is, `null` for the store column. */
      slot: 'accountantId' | 'collectorId' | null
    }
  | { kind: 'server'; message: string }

/**
 * One refusal, ready to be worded.
 *
 * ⚠️ The issue carries no staff id — but the row's after-value in the refused column
 * IS the file's id: the server keeps it (verbatim when it does not resolve), and a
 * refused cell is never blank. So the sentence can name the id without a field the
 * contract does not have.
 */
export function describeIssue(
  issue: AssignmentUploadIssue,
  rows: readonly AssignmentUploadRow[],
): IssueCopy {
  if (!(UPLOAD_ISSUE_CODES as readonly string[]).includes(issue.code)) {
    return { kind: 'server', message: englishLine(issue.message) }
  }

  const row = rows.find((r) => r.rowNumber === issue.rowNumber)
  const slot = COLUMN_SLOT[issue.column] ?? null

  return {
    kind: 'known',
    code: issue.code as UploadIssueCode,
    store: issue.storeCode ?? '',
    staffId: slot && row ? (row[slot] ?? '') : '',
    slot,
  }
}

/** The file's staff columns, as the Branches tab's slots. The store column has none. */
const COLUMN_SLOT: Record<string, 'accountantId' | 'collectorId'> = {
  AccountantId: 'accountantId',
  CollectorId: 'collectorId',
}

/**
 * **The English line of a server sentence.** Every message on these two doors is English, a
 * newline, then Arabic (1996's contract); the web is English-only (spec 308), so where the
 * screen falls back on the server's words it shows the first line and not the Arabic.
 * A message with no newline is returned whole.
 */
export function englishLine(message: string | null | undefined): string {
  return (message ?? '').split(/\r?\n/)[0].trim()
}

/** What one press of Apply came back with. */
export type CommitOutcome = 'applied' | 'nothingApplied' | 'hashMismatch' | 'rowErrors' | 'refused'

/**
 * 🔑 **A refusal arrives on a 200**, so reading `applied` without reading `accepted`
 * would report a refused file as a written one. And a re-press of an applied file is
 * `accepted` with `applied: 0` — its own outcome, so the screen neither calls it a
 * failure nor claims the branches were assigned a second time.
 */
export function commitOutcome(result: AssignmentUploadCommit | null | undefined): CommitOutcome {
  if (result?.accepted !== true) {
    if (result?.refusalReason === HASH_MISMATCH) return 'hashMismatch'
    if (result?.refusalReason === COMMIT_ROW_ERRORS) return 'rowErrors'
    return 'refused'
  }
  return (result.applied ?? 0) > 0 ? 'applied' : 'nothingApplied'
}

/**
 * **A commit refused over its rows, folded back onto the preview** — or `null` when the
 * refusal is not that one (settlement's `withCommitRowErrors`, the same ruling).
 *
 * The commit re-checks every row against the branches as they are NOW, so a person
 * deactivated since the preview refuses the file. What finance needs is the preview
 * again with those rows named, and the answer's errors replace the preview's — they
 * are the newer reading of the same file.
 */
export function withCommitRowErrors(
  preview: AssignmentUploadPreview,
  result: Pick<AssignmentUploadCommit, 'accepted' | 'refusalReason' | 'errors'> | null | undefined,
): AssignmentUploadPreview | null {
  if (!result || result.accepted === true || result.refusalReason !== COMMIT_ROW_ERRORS) return null
  const errors = result.errors ?? []
  if (errors.length === 0) return null
  return { ...preview, errors, canCommit: false }
}

/**
 * The `400` envelope codes (`errors[0].errorCode`) this screen words itself — the ones
 * whose server sentence adds nothing to a sentence of its own.
 *
 * ⚠️ `AssignmentUploadFileUnreadable` is deliberately absent: its message says WHICH
 * problem it is (no branch column, not UTF-8, two columns for one side, over 2000
 * rows), and a key would say less than the server did. The service's unreachable
 * `AssignmentUploadNoRows` / `…TooManyRows` are treated like it, as the contract asks.
 */
const FILE_REFUSALS: Record<string, string> = {
  AssignmentUploadFileRequired: 'fileRequired',
  AssignmentUploadFileTooLarge: 'fileTooLarge',
  AssignmentUploadFileTypeUnsupported: 'fileType',
  AssignmentUploadContentHashRequired: 'hashRequired',
}

export function fileRefusalKey(code: string | null | undefined): string | null {
  return (code && FILE_REFUSALS[code]) || null
}
