import type { RuleCouponStatus } from '@/core/models/rule-campaign'
import { csvCells } from '@/core/util/csv-cells'
import { MAX_BATCH, isCodeOk, isMemberOk } from './coupon-form'

// Coupon codes in and out as CSV (tickets 516, 526; the prototype's coupon Uploader). Pure: text in,
// rows out; no `t`, no DOM, no api. HQ has no pre-import check: whether a code is already in
// SIS.Coupons or a member id is known is HQ's refusal of the whole import (`RULES_BATCH_CODE_TAKEN`,
// `RULES_BATCH_BAD` naming the ids), shown as it answers. A batch's codes are read from HQ's own
// export CSV (`readBatchCsv`); the export is saved as HQ wrote it, so there is no CSV writer here.

/** Why a row is left out of an import. */
export type CouponRowProblem =
  /** No code on the row. */
  | 'noCode'
  /** Not what HQ takes as a code: letters, digits and - _ . only, starting with a letter or a digit,
   *  at most 64 (a space, an accent, punctuation…). */
  | 'badCode'
  /** The member id is not what HQ takes as one (the same characters, at most 26). */
  | 'badMember'
  /** The same code earlier in the file (any case). */
  | 'repeated'
  /** Past one batch's `MAX_BATCH` good rows. */
  | 'tooMany'

export interface CouponCsvRow {
  /** 1-based line of the file (blank lines and the header count), so the reader can find it. */
  line: number
  /** Trimmed and upper-cased, as codes are kept. */
  code: string
  /** As written, trimmed; null when blank (a code for anyone). */
  member: string | null
  problem: CouponRowProblem | null
}

export interface CouponCsvRead {
  rows: CouponCsvRow[]
  /** The first line named the columns. */
  header: boolean
  /** The header names no code column: nothing can be read. */
  noCodeColumn: boolean
}

/** The column names an import knows (the prototype's aliases); spaces and dashes read as `_`. */
const CODE_HEADERS = ['code', 'coupon', 'coupon_code', 'value']
const MEMBER_HEADERS = ['member', 'member_id', 'customerid', 'customer_id', 'profile', 'profile_id', 'recipient']

/** A leading byte-order mark, which Excel writes at the head of a UTF-8 CSV. */
const BOM = String.fromCharCode(0xfeff)
const TAB = String.fromCharCode(9)
const NL = String.fromCharCode(10)

/**
 * The separator of a file: whichever of tab, semicolon and comma is commonest over its first ten
 * lines (not the first alone: a first row with no member holds none), a comma when there is none.
 */
function separatorOf(lines: readonly string[]): string {
  const head = lines.filter((l) => l.trim() !== '').slice(0, 10).join(NL)
  const counts = ([TAB, ';', ','] as const).map((sep) => [sep, head.split(sep).length - 1] as const)
  const [sep, n] = counts.reduce((a, b) => (b[1] > a[1] ? b : a))
  return n > 0 ? sep : ','
}

const headerName = (cell: string) => cell.toLowerCase().replace(/[\s-]+/g, '_')

/** A file's lines, a leading BOM dropped. */
const linesOf = (text: string): string[] => (text.startsWith(BOM) ? text.slice(1) : text).split(/\r?\n/)

/**
 * A pasted, dropped or uploaded file's rows, each checked as written. A header is optional: a first
 * line naming a code or a member column places the columns by name, and any other column is
 * ignored; with no header the columns are the code, then the member. Blank lines are skipped. Each
 * row has at most one problem, the first that applies: no code, a bad code, a bad member id, repeated
 * in the file; then the good rows past one batch's cap are too many.
 */
export function readCouponCsv(text: string): CouponCsvRead {
  const lines = linesOf(text)
  const firstAt = lines.findIndex((l) => l.trim() !== '')
  if (firstAt < 0) return { rows: [], header: false, noCodeColumn: false }
  const sep = separatorOf(lines)

  let codeAt = 0
  let memberAt = 1
  let from = 0
  const head = csvCells(lines[firstAt], sep).map(headerName)
  const header = head.some((c) => CODE_HEADERS.includes(c) || MEMBER_HEADERS.includes(c))
  if (header) {
    codeAt = head.findIndex((c) => CODE_HEADERS.includes(c))
    memberAt = head.findIndex((c) => MEMBER_HEADERS.includes(c))
    from = firstAt + 1
    if (codeAt < 0) return { rows: [], header, noCodeColumn: true }
  }

  const seen = new Set<string>()
  const rows: CouponCsvRow[] = []
  let good = 0
  for (let i = from; i < lines.length; i++) {
    const cells = csvCells(lines[i], sep)
    if (cells.every((c) => c === '')) continue
    // Upper-cased as a code is kept; a space inside stays, so the row reads as a bad code.
    const code = (cells[codeAt] ?? '').toUpperCase()
    const member = (memberAt >= 0 ? (cells[memberAt] ?? '') : '') || null
    let problem: CouponRowProblem | null = null
    if (!code) problem = 'noCode'
    else if (!isCodeOk(code)) problem = 'badCode'
    else if (member && !isMemberOk(member)) problem = 'badMember'
    else if (seen.has(code)) problem = 'repeated'
    if (code && isCodeOk(code)) seen.add(code)
    if (!problem && ++good > MAX_BATCH) problem = 'tooMany'
    rows.push({ line: i + 1, code, member, problem })
  }
  return { rows, header, noCodeColumn: false }
}

/** HQ skips a first line whose first cell is `code` as a header. Sending one ourselves means a
 *  code literally named CODE, leading the good rows, is read as data rather than eaten. */
export const IMPORT_CSV_HEADER = 'code,customerId'

/** The text sent as the import's `csv`: our header, then the good rows, in file order, as HQ
 *  reads them — `code` or `code,customerId` per line. Rejected rows are left out. */
export function importCsv(rows: readonly CouponCsvRow[]): string {
  const good = rows.filter((r) => !r.problem).map((r) => (r.member ? `${r.code},${r.member}` : r.code))
  return [IMPORT_CSV_HEADER, ...good].join('\n')
}

/** What the preview says it holds. */
export function importTally(rows: readonly CouponCsvRow[]) {
  const ok = rows.filter((r) => !r.problem).length
  return { rows: rows.length, ok, rejected: rows.length - ok }
}

// ── A batch's codes, from HQ's export ──

/** A code's state as the export says it: disabled first (a used code can be disabled since), then
 *  used (redeemed at least once), then expired — past its OWN last day at the reader's local day
 *  (a code with no day of its own follows the template's window, which no door answers, so it is
 *  never read as expired) — else unused. */
export type BatchCodeStatus = RuleCouponStatus
export const BATCH_CODE_STATUSES: readonly BatchCodeStatus[] = ['unused', 'used', 'disabled', 'expired']

/** One line of a batch's export. Days are local `yyyy-MM-dd`; null = the template's own. */
export interface BatchCode {
  code: string
  customerId: string | null
  validFrom: string | null
  validTo: string | null
  status: BatchCodeStatus
}

/**
 * HQ's export of a batch read back into its codes: header `code,customerId,validFrom,validTo,used,
 * disabled`, CRLF lines, `yes` / `no` flags. The columns are placed by the header's names, so a
 * column HQ adds later is ignored rather than misread; a file with no `code` column reads as none.
 * `today` is the reader's local `yyyy-MM-dd`: a code whose own last day (inclusive) is before it
 * is expired.
 */
export function readBatchCsv(csv: string, today: string): BatchCode[] {
  const lines = linesOf(csv).filter((l) => l.trim() !== '')
  if (!lines.length) return []
  const head = csvCells(lines[0], ',').map((c) => c.toLowerCase())
  const at = (name: string) => head.indexOf(name.toLowerCase())
  const [code, customer, from, to, used, disabled] = ['code', 'customerId', 'validFrom', 'validTo', 'used', 'disabled'].map(at)
  if (code < 0) return []
  const yes = (cells: string[], i: number) => i >= 0 && (cells[i] ?? '').toLowerCase() === 'yes'
  const text = (cells: string[], i: number) => (i >= 0 ? cells[i] || null : null)
  return lines.slice(1).map((line) => {
    const cells = csvCells(line, ',')
    const validTo = text(cells, to)
    return {
      code: cells[code] ?? '',
      customerId: text(cells, customer),
      validFrom: text(cells, from),
      validTo,
      status: yes(cells, disabled) ? 'disabled' : yes(cells, used) ? 'used' : validTo && validTo < today ? 'expired' : 'unused',
    }
  })
}

export type CouponStatusFilter = 'all' | BatchCodeStatus

export const statusFromParam = (value: string | null): CouponStatusFilter =>
  BATCH_CODE_STATUSES.includes(value as BatchCodeStatus) ? (value as CouponStatusFilter) : 'all'

/** The codes shown: the search matches part of the code or the member, any case; the status exactly. */
export function visibleCodes(codes: readonly BatchCode[], { q, status }: { q: string; status: CouponStatusFilter }): BatchCode[] {
  const needle = q.trim().toUpperCase()
  return codes.filter(
    (k) => (!needle || k.code.toUpperCase().includes(needle) || (k.customerId ?? '').toUpperCase().includes(needle)) && (status === 'all' || k.status === status),
  )
}

/** How many codes in each status. */
export function codeCounts(codes: readonly BatchCode[]): Record<BatchCodeStatus, number> {
  const out: Record<BatchCodeStatus, number> = { unused: 0, used: 0, disabled: 0, expired: 0 }
  for (const k of codes) out[k.status]++
  return out
}
