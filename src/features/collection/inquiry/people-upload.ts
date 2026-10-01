/**
 * **A people file, previewed and then committed** — ticket 337 (spec 334 item 3),
 * against the `## Web contract` of BackOffice
 * [2156](C:\Work\DMSCO\BackOffice-2149\.issues\2156-a-people-file-is-previewed-and-committed-as-one-act.md).
 *
 * Finance keeps the collection roster in a sheet (StaffId, Name, Role, SupervisorId).
 * The People tab saves one person at a time; this upserts many from that sheet, in one
 * act. People not in the file are left as they are; nobody is ever removed.
 *
 * 🔑 **The assignment upload's shape, on purpose** (`assignment-upload.ts`, ticket 318):
 * the client uploads bytes and parses nothing, the preview is the server's reading of
 * the file, and the commit **re-sends the same file** with the preview's `contentHash`.
 *
 * ⚠️ **Unlike the assignment upload, a blank cell is a VALUE** (the server's rule): a
 * blank Role is the pure manager, a blank SupervisorId is nobody and clears an existing
 * supervisor. The preview's after-values already say so, and nothing here re-derives them.
 *
 * Pure — no React, no i18n, no network, no clock.
 */
import { COLLECTION_ROLES } from './served-by'
import { COMMIT_ROW_ERRORS, HASH_MISMATCH, englishLine } from './assignment-upload'

/** What the file does to one person — the server's per-row verdict. */
export type PeopleChange = 'ADDED' | 'UPDATED' | 'UNCHANGED'

/** One file row as the preview renders it. A refused row is listed too, its `change`
 *  computed as if the refusal did not exist. */
export interface PeopleUploadRow {
  /** The sheet's own row number (the header is row 1). */
  rowNumber: number
  /** The roster's spelling when the person exists, the file's otherwise. */
  staffId: string
  change: PeopleChange
  /** `''` when added. Compared case-SENSITIVELY: `sara` → `Sara` is a change. */
  currentName: string
  name: string
  nameChanges: boolean
  /** `''` = the blank role (the pure manager). `role` is upper-cased. */
  currentRole: string
  role: string
  roleChanges: boolean
  /** `''` = nobody. After is in the roster's spelling when the supervisor is on it. */
  currentSupervisorId: string
  supervisorId: string
  supervisorChanges: boolean
}

/** One bad cell, or the file's own fault at `rowNumber: 0`. */
export interface PeopleUploadIssue {
  rowNumber: number
  staffId: string
  /** `StaffId`, `Name`, `Role`, `SupervisorId`, or `''` for the file. */
  column: string
  code: string
  /** English, a newline, then Arabic — a FALLBACK. The copy is keyed off `code`. */
  message: string
}

/** `POST CollectionWeb/Assignment/People/Upload/Preview` → `data`. Writes nothing. */
export interface PeopleUploadPreview {
  /** Sent back on the commit, verbatim. */
  contentHash: string
  rowCount: number
  addedCount: number
  updatedCount: number
  unchangedCount: number
  /** `errors.length === 0`, stated. REQUIRED, and read `=== true`. */
  canCommit: boolean
  rows: PeopleUploadRow[]
  errors: PeopleUploadIssue[]
}

/** `POST CollectionWeb/Assignment/People/Upload/Commit` → `data`. All or nothing. */
export interface PeopleUploadCommit {
  /** `false` = nothing was written; see `refusalReason`. REQUIRED, read `=== true`. */
  accepted: boolean
  /** `''`, `HASH_MISMATCH` or `ROW_ERRORS`. */
  refusalReason: string
  added: number
  updated: number
  addedStaffIds: string[]
  updatedStaffIds: string[]
  unchanged: number
  errors: PeopleUploadIssue[]
  /** This act's stamp; `''` / `0001-01-01T00:00:00` when refused. */
  updatedBy: string
  updatedAt: string
}

/**
 * The preview row codes this dialog has its own words for. A code outside the list is
 * a rule the server grew after this screen shipped, shown in the server's words.
 */
export const PEOPLE_ISSUE_CODES = [
  'STAFF_ID_REQUIRED',
  'STAFF_ID_TOO_LONG',
  'REPEATED_STAFF',
  'NAME_REQUIRED',
  'NAME_TOO_LONG',
  'NAME_NOT_STORABLE',
  'ROLE_UNKNOWN',
  'SUPERVISOR_UNKNOWN',
  'SUPERVISOR_IS_SELF',
  'ROLE_CHANGE_ORPHANS_BRANCHES',
] as const
export type PeopleIssueCode = (typeof PEOPLE_ISSUE_CODES)[number]

/** The file, reviewed. */
export interface PeopleUploadReview {
  rows: PeopleUploadRow[]
  /** Counted off the server's per-row `change`, never by comparing values here. */
  added: number
  updated: number
  unchanged: number
  /** The refusals by sheet row, so each row wears its own. Rows with none are absent. */
  issuesByRow: Record<number, PeopleUploadIssue[]>
  /** The file's own faults (`rowNumber: 0`). */
  fileIssues: PeopleUploadIssue[]
  /** How many ROWS are refused (one row can carry several refusals). */
  refusedRows: number
  /** A clean file that changes nobody: valid, and nothing to apply. */
  nothingToApply: boolean
  /**
   * 🔑 **Apply is offered only when all four hold**: the server said `canCommit: true`,
   * it named no error, there are rows, and at least one adds or updates somebody.
   * The errors outrank the flag.
   */
  canCommit: boolean
}

export function reviewPeopleUpload(preview: PeopleUploadPreview | null | undefined): PeopleUploadReview {
  const rows = preview?.rows ?? []
  const errors = preview?.errors ?? []

  const issuesByRow: Record<number, PeopleUploadIssue[]> = {}
  const fileIssues: PeopleUploadIssue[] = []
  for (const issue of errors) {
    if (issue.rowNumber > 0) (issuesByRow[issue.rowNumber] ??= []).push(issue)
    else fileIssues.push(issue)
  }

  const added = rows.filter((row) => row.change === 'ADDED').length
  const updated = rows.filter((row) => row.change === 'UPDATED').length
  const clean = preview?.canCommit === true && errors.length === 0 && rows.length > 0
  const changes = added + updated > 0

  return {
    rows,
    added,
    updated,
    unchanged: rows.length - added - updated,
    issuesByRow,
    fileIssues,
    refusedRows: Object.keys(issuesByRow).length,
    nothingToApply: clean && !changes,
    canCommit: clean && changes,
  }
}

/** What a refusal says: this dialog's own words for a code it knows, the server's
 *  for one it does not. */
export type PeopleIssueCopy =
  | {
      kind: 'known'
      code: PeopleIssueCode
      staffId: string
      /** The row's after-values — the file's own cells — `''` when the row is not listed. */
      name: string
      role: string
      supervisorId: string
    }
  | { kind: 'server'; message: string }

/**
 * One refusal, ready to be worded. The issue names the person; the row it hangs on
 * carries the file's own cells (a refused supervisor id, an unknown role word), so the
 * sentence can name the bad value without a field the contract does not have.
 */
export function describePeopleIssue(
  issue: PeopleUploadIssue,
  rows: readonly PeopleUploadRow[],
): PeopleIssueCopy {
  if (!(PEOPLE_ISSUE_CODES as readonly string[]).includes(issue.code)) {
    return { kind: 'server', message: englishLine(issue.message) }
  }
  const row = rows.find((r) => r.rowNumber === issue.rowNumber)
  return {
    kind: 'known',
    code: issue.code as PeopleIssueCode,
    staffId: issue.staffId ?? '',
    name: row?.name ?? '',
    role: row?.role ?? '',
    supervisorId: row?.supervisorId ?? '',
  }
}

/**
 * A role cell in the preview: one of the two roles or the blank one gets its label;
 * anything else is shown as the file wrote it. ⚠️ The People tab's `roleLabelKey`
 * files an unknown value under "Supervises only", which is right for the roster (it
 * can hold nothing else) and wrong here, where `ROLE_UNKNOWN` rows are listed too.
 */
export function previewRole(role: string): { kind: 'role'; role: string } | { kind: 'raw'; text: string } {
  const normalized = (role ?? '').trim().toUpperCase()
  if (normalized === '' || normalized === COLLECTION_ROLES.accountant || normalized === COLLECTION_ROLES.collector) {
    return { kind: 'role', role: normalized }
  }
  return { kind: 'raw', text: role }
}

/** What one press of Apply came back with. */
export type PeopleCommitOutcome = 'applied' | 'nothingApplied' | 'hashMismatch' | 'rowErrors' | 'refused'

/**
 * 🔑 **A refusal arrives on a 200**, so `accepted` is read before the counts. A re-press
 * of an applied file is `accepted` with nothing written — its own outcome.
 */
export function peopleCommitOutcome(result: PeopleUploadCommit | null | undefined): PeopleCommitOutcome {
  if (result?.accepted !== true) {
    if (result?.refusalReason === HASH_MISMATCH) return 'hashMismatch'
    if (result?.refusalReason === COMMIT_ROW_ERRORS) return 'rowErrors'
    return 'refused'
  }
  return (result.added ?? 0) + (result.updated ?? 0) > 0 ? 'applied' : 'nothingApplied'
}

/**
 * **A commit refused over its rows, folded back onto the preview** — or `null` when the
 * refusal is not that one. The commit re-checks every row against the roster as it is
 * NOW; the answer's errors are the newer reading of the same file and replace the
 * preview's.
 */
export function withPeopleCommitRowErrors(
  preview: PeopleUploadPreview,
  result: Pick<PeopleUploadCommit, 'accepted' | 'refusalReason' | 'errors'> | null | undefined,
): PeopleUploadPreview | null {
  if (!result || result.accepted === true || result.refusalReason !== COMMIT_ROW_ERRORS) return null
  const errors = result.errors ?? []
  if (errors.length === 0) return null
  return { ...preview, errors, canCommit: false }
}

/**
 * The `400` envelope codes this dialog words itself. ⚠️ `PeopleUploadFileUnreadable` is
 * deliberately absent: its message says WHICH problem (a missing column, not UTF-8,
 * over 2000 rows), and a key would say less than the server did. The unreachable
 * `PeopleUploadNoRows` / `…TooManyRows` are treated like it, as the contract asks.
 */
const FILE_REFUSALS: Record<string, string> = {
  PeopleUploadFileRequired: 'fileRequired',
  PeopleUploadFileTooLarge: 'fileTooLarge',
  PeopleUploadFileTypeUnsupported: 'fileType',
  PeopleUploadContentHashRequired: 'hashRequired',
}

export function peopleFileRefusalKey(code: string | null | undefined): string | null {
  return (code && FILE_REFUSALS[code]) || null
}
