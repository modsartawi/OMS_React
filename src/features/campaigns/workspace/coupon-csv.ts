import type { RuleCampaignCoupon, RuleCouponImportCheck, RuleCouponImportRow } from '@/core/models/rule-campaign'
import { stripIsolates } from '@/core/util/bidi'
import { csvCells } from '@/core/util/csv-cells'
import { MAX_BATCH } from './coupon-form'

// Coupon codes in and out as CSV (ticket 516; the prototype's coupon Uploader and `codeCsv`). Pure:
// text in, rows out; no `t`, no DOM, no api. Whether a code is already in SIS.Coupons and whether a
// member id is known are HQ's answers (its import check), handed in to `withHqCheck`.

/** Why a row is left out of an import. */
export type CouponRowProblem =
  /** No code on the row. */
  | 'noCode'
  /** Not 3 to 32 letters, digits or dashes (a space, an accent, punctuation…). */
  | 'badCode'
  /** The same code earlier in the file (any case). */
  | 'repeated'
  /** This campaign already has the code. */
  | 'taken'
  /** Past one batch's `MAX_BATCH` good rows (after HQ's check). */
  | 'tooMany'
  /** HQ: SIS.Coupons already holds the code (another campaign's, or one taken since the list was read). */
  | 'inUse'
  /** HQ: no member has this id. */
  | 'unknownMember'

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
const MEMBER_HEADERS = ['member', 'member_id', 'profile', 'profile_id', 'recipient']

const CODE = /^[A-Z0-9][A-Z0-9-]{2,31}$/

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

/** A leading byte-order mark, which Excel writes at the head of a UTF-8 CSV (and the export writes). */
const BOM = String.fromCharCode(0xfeff)
const TAB = String.fromCharCode(9)
const NL = String.fromCharCode(10)

const headerName = (cell: string) => cell.toLowerCase().replace(/[\s-]+/g, '_')

/**
 * A pasted, dropped or uploaded file's rows, each checked as written. A header is optional: a first
 * line naming a code or a member column places the columns by name, and any other column is
 * ignored; with no header the columns are the code, then the member. Blank lines are skipped. `taken`
 * is the codes the campaign already has. Each row has at most one problem, the first that applies:
 * no code, bad characters, repeated in the file, taken by the campaign. One batch's cap is laid on
 * after HQ's check (`withHqCheck`), so a row HQ rejects never holds a later row out.
 */
export function readCouponCsv(text: string, taken: readonly string[]): CouponCsvRead {
  const lines = (text.startsWith(BOM) ? text.slice(1) : text).split(/\r?\n/)
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

  const has = new Set(taken.map((k) => k.toUpperCase()))
  const seen = new Set<string>()
  const rows: CouponCsvRow[] = []
  for (let i = from; i < lines.length; i++) {
    const cells = csvCells(lines[i], sep)
    if (cells.every((c) => c === '')) continue
    // Upper-cased as a code is kept; a space inside stays, so the row reads as bad characters.
    const code = (cells[codeAt] ?? '').toUpperCase()
    const member = (memberAt >= 0 ? (cells[memberAt] ?? '') : '') || null
    let problem: CouponRowProblem | null = null
    if (!code) problem = 'noCode'
    else if (!CODE.test(code)) problem = 'badCode'
    else if (seen.has(code)) problem = 'repeated'
    else if (has.has(code)) problem = 'taken'
    if (CODE.test(code)) seen.add(code)
    rows.push({ line: i + 1, code, member, problem })
  }
  return { rows, header, noCodeColumn: false }
}

/**
 * HQ's check laid over the rows — a code SIS.Coupons holds, then a member id it does not know — and
 * then one batch's cap: the good rows past `MAX_BATCH`, in file order, are left out as too many.
 */
export function withHqCheck(rows: readonly CouponCsvRow[], check: RuleCouponImportCheck): CouponCsvRow[] {
  const inUse = new Set(check.inUse.map((k) => k.toUpperCase()))
  const unknown = new Set(check.unknownMembers)
  let good = 0
  return rows.map((r) => {
    if (r.problem) return r
    if (inUse.has(r.code)) return { ...r, problem: 'inUse' }
    if (r.member && unknown.has(r.member)) return { ...r, problem: 'unknownMember' }
    return ++good > MAX_BATCH ? { ...r, problem: 'tooMany' } : r
  })
}

/** The rows sent: the good ones, in file order, as `{ code, member }`. Rejected rows are left out. */
export function importableRows(rows: readonly CouponCsvRow[]): RuleCouponImportRow[] {
  return rows.filter((r) => !r.problem).map((r) => ({ code: r.code, member: r.member }))
}

/** What the preview says it holds. */
export function importTally(rows: readonly CouponCsvRow[]) {
  const ok = rows.filter((r) => !r.problem).length
  return { rows: rows.length, ok, rejected: rows.length - ok }
}

// ── Export ──

/**
 * The export's columns. Machine names, not copy: the first two are the import's own, so an exported
 * file reads back as an import (for a print house or an email provider, as the prototype's).
 */
const EXPORT_HEADER = ['code', 'member', 'status', 'kind', 'uses', 'batch', 'valid_from', 'valid_until', 'created']

/** A cell as CSV writes it: quoted when it holds a separator, a quote or a line break. */
function csvCell(value: string): string {
  return /[",;\t\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Codes as a CSV file: a BOM (so Excel reads UTF-8), a header, CRLF lines. Every value is written as
 * HQ answered it — statuses and kinds as their machine names, days and moments local as given — and
 * with no bidi isolate (an export never carries one: `stripIsolates`).
 */
export function couponCsv(codes: readonly RuleCampaignCoupon[]): string {
  const rows = codes.map((k) => [k.code, k.member ?? '', k.status, k.kind, String(k.uses), k.batch, k.from ?? '', k.until ?? '', k.created])
  return BOM + [EXPORT_HEADER, ...rows].map((cells) => cells.map((c) => csvCell(stripIsolates(c))).join(',')).join('\r\n') + '\r\n'
}

/** The file's name: the campaign code, then the batch when the list is one batch. */
export function couponCsvFileName(campaignCode: string, batch: string): string {
  return `${campaignCode}-${batch || 'coupons'}.csv`
}
