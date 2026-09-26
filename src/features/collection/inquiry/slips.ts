/**
 * ECR slips at the day close (spec 319, BackOffice spec 2030) — the pure rules the
 * Ready and Cash Collections grids read, and that 321–323 build on.
 *
 * Pure: no React, no network, no i18n. The probe's query options live in `./api`
 * beside the call, on `assignmentOptionsQuery`'s pattern; what is here is what the
 * answers MEAN.
 *
 * 🔑 **Null is UNKNOWN, never "no slip"** (BackOffice 2034's `## Web contract`). A
 * null `slipCount` draws a dash, never counts as 0, and never falls into the "No
 * slip" filter. That is why every test below is `=== 0` or `typeof … === 'number'`
 * and never truthiness: `!row.slipCount` and `row.slipCount == 0` both look right
 * and both let an unknown day read as a day with no slip.
 */
import type { ApiEnvelope } from '@/core/api'
import type { AttachmentAccess, SlipCountedSiblings } from '@/core/models/collection'

/** The attachment category of a day close's slips — the one this wave draws. */
export const CASH_CLOSE = 'CASH_CLOSE'

/** What an unknown count draws. A symbol, not a sentence — its accessible text is a `t()` key. */
export const SLIP_ABSENT = '—'

/**
 * Does a probe list hold `category`? **Array membership and nothing looser.**
 *
 * 🚩 The trap is a bare string: `"CASH_CLOSE".includes("CASH_CLOSE")` is true too,
 * so a door that answered `categories: "CASH_CLOSE"` would light the column through
 * a `String.prototype.includes`. Only an array that holds the exact code admits.
 */
export function holdsCategory(list: unknown, category: string): boolean {
  return Array.isArray(list) && list.includes(category)
}

/**
 * May this session see slips at all — the column, the filter, the drawer and Add?
 *
 * Fails closed: a pending probe (`undefined`), a refused one (503 `NOT_SET_UP`,
 * 403, a network failure — `data` is then `undefined` too), a malformed answer
 * and a list without `CASH_CLOSE` are all "no". The probe only decides what is
 * drawn; the server checks the grant again on every call.
 */
export function canSeeSlips(access: AttachmentAccess | null | undefined): boolean {
  return holdsCategory(access?.categories, CASH_CLOSE)
}

/** Is a count known — a real, non-negative whole number, `0` included? */
export function isKnownSlipCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** The slip cell's text: the count as sent (`0` is `0`), or the dash for an unknown one. */
export function slipCountText(value: unknown): string {
  return isKnownSlipCount(value) ? String(value) : SLIP_ABSENT
}

/**
 * The "No slip" filter: keep a row only when its count is **exactly** `0`.
 *
 * ⚠️ `=== 0`, never `== 0` and never `!row.slipCount` — a null (unknown) or an
 * absent count must never fall in. Client-side only: it adds no server parameter.
 */
export function isNoSlipRow(row: { slipCount?: number | null } | null | undefined): boolean {
  return row?.slipCount === 0
}

/** The slip column's field on both rows, and the money column it follows. */
const SLIP_FIELD = 'slipCount'
const SLIP_ANCHOR = 'cardTotal'

/**
 * The column lists with the slip column placed — right after `cardTotal`, the
 * figure a missing or wrong slip is checked against — or the lists untouched when
 * the session may not see slips.
 *
 * Returns a new array; the input is the screen's frozen field list.
 */
export function withSlipColumn<Field extends string>(
  fields: readonly Field[],
  showSlips: boolean,
): (Field | typeof SLIP_FIELD)[] {
  if (!showSlips) return [...fields]
  const at = fields.indexOf(SLIP_ANCHOR as Field)
  return at < 0 ? [...fields, SLIP_FIELD] : [...fields.slice(0, at + 1), SLIP_FIELD, ...fields.slice(at + 1)]
}

/**
 * The "No slip" toggle a toolbar draws — handed in only when the session may see
 * slips, so an absent prop IS the hidden filter. Client-side: flipping it issues
 * no query, and the toolbar's Reset turns it off with the rest.
 */
export interface NoSlipToggle {
  pressed: boolean
  onToggle: () => void
}

/** A slip-counted read, projected: the rows, and whether their counts could be read. */
export interface SlipCountedRows<Row> {
  rows: Row[]
  /** True only when the server said so (`=== true`); an absent flag reads as "read". */
  slipCountsUnavailable: boolean
}

/**
 * Ready's and Collections' envelope → the rows plus the one flag beside them.
 *
 * `=== true` for the probe's reason: an older SIS.Api omits the flag, and an
 * absent flag must not raise a banner over counts that are all null anyway.
 */
export function slipCountedRows<Row>(envelope: ApiEnvelope<Row[], SlipCountedSiblings>): SlipCountedRows<Row> {
  return {
    rows: Array.isArray(envelope.data) ? envelope.data : [],
    slipCountsUnavailable: envelope.slipCountsUnavailable === true,
  }
}
