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
import type {
  AttachmentAccess,
  SlipCountedSiblings,
  SlipOwnerSiblings,
  StoredSlip,
  WithdrawnSlip,
} from '@/core/models/collection'

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

/* ════════════════════════════════════════════════════════════════════════════
 * The drawer (ticket 321, BackOffice 2034 + 2035): a store day's slips.
 * ════════════════════════════════════════════════════════════════════════════ */

/** The owner kind a store day's slips are filed under. A machine code, never shown. */
export const STORE_DAY = 'STORE_DAY'

/** A `yyyy-MM-dd` at the head of the string, alone or before a time part. */
const DAY_PART = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/

/**
 * The owner key a store day's slips are filed and counted under,
 * `<storeId>/<yyyy-MM-dd>` — the till's spelling and the server's
 * (`AttachmentOwnerKinds.StoreDayKey`: the store trimmed, the day invariant).
 *
 * 🔑 **String handling only.** The day is the first ten characters of `businessDay`
 * as the server sent it. Never `new Date(...)`, `toLocale*` or `Intl`: the wire's
 * `2026-09-20T00:00:00` has no zone, and a `Date` reads it in the browser's zone
 * or as UTC — a day near midnight then lands on its neighbour, and the drawer
 * opens an owner nobody filed a slip under.
 *
 * `null` when there is no day (a settlement row, a pre-049 day) or no store: such a
 * row has no owner, so it never opens the drawer. 322 and 323 call this; nothing
 * re-spells the key.
 */
export function storeDayOwnerKey(
  storeId: string | null | undefined,
  businessDay: string | null | undefined,
): string | null {
  if (typeof storeId !== 'string' || typeof businessDay !== 'string') return null
  const store = storeId.trim()
  const day = DAY_PART.exec(businessDay.trim())
  if (!store || !day) return null
  return `${store}/${day[1]}`
}

/** The store day a drawer is opened on: its owner key and how its header names it. */
export interface SlipDay {
  ownerKey: string
  /** The store as the grids print it (`storeText`), else its id. */
  store: string
  /** `yyyy-MM-dd`, the key's own date part. */
  businessDate: string
}

/** The fields of a Ready or Collections row the drawer opens from. */
export interface SlipDayRow {
  storeId: string
  storeText?: string | null
  businessDay: string | null
  slipCount: number | null
}

/**
 * The day a row's count opens, or `null` when the count may not be clicked.
 *
 * Clickable = a **known** count (`0` included — that is where 322's Add goes) on a
 * row with an owner. A null count is unknown and never opens anything, and a row
 * without a `businessDay` has no owner key even if a count were somehow sent.
 */
export function slipDayOf(row: SlipDayRow | null | undefined): SlipDay | null {
  if (!row || !isKnownSlipCount(row.slipCount)) return null
  const ownerKey = storeDayOwnerKey(row.storeId, row.businessDay)
  if (ownerKey === null) return null
  const store = typeof row.storeText === 'string' && row.storeText.trim() ? row.storeText : row.storeId.trim()
  return { ownerKey, store, businessDate: ownerKey.slice(ownerKey.lastIndexOf('/') + 1) }
}

/**
 * Where a slip came from: the till's device code, or — a web upload has an empty
 * `sourceDevice` — the web user who filed it (BackOffice 2035, which supersedes
 * 2034's plain "Web"). The words are the drawer's `t()`; this only decides which.
 */
export type SlipTill = { kind: 'device'; device: string } | { kind: 'web'; uploadedBy: string }

export function slipTill(item: { sourceDevice?: string | null; uploadedBy?: string | null }): SlipTill {
  const device = typeof item.sourceDevice === 'string' ? item.sourceDevice.trim() : ''
  if (device) return { kind: 'device', device }
  return { kind: 'web', uploadedBy: typeof item.uploadedBy === 'string' ? item.uploadedBy : '' }
}

/** How a fetched slip is shown: an `<img>`, an `<iframe>`, or no preview (download only). */
export type SlipPreviewKind = 'image' | 'pdf' | 'none'

/**
 * The preview for a `/Content` answer's content type — `image/jpeg` and `image/png`
 * as an image, `application/pdf` in a frame, anything else not at all (its
 * download still works). Parameters and case are ignored; nothing is sniffed.
 */
export function slipPreviewKind(contentType: string | null | undefined): SlipPreviewKind {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (type === 'image/jpeg' || type === 'image/png') return 'image'
  if (type === 'application/pdf') return 'pdf'
  return 'none'
}

/** `yyyy-MM-ddTHH:mm[:ss]` at the head of a wall-clock stamp. */
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)/

/**
 * A wall-clock stamp as the drawer prints it: the server's own digits, the `T` cut
 * to a space and any fraction of a second dropped — `2026-09-24T22:31:07.1234567`
 * reads `2026-09-24 22:31:07`.
 *
 * 🔑 A string cut, never a `Date`: `storedAt` and `withdrawnAt` are local wall clock
 * with no zone, and parsing them would shift them by the browser's offset. Anything
 * that is not that shape is shown exactly as sent.
 */
export function wallClockText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const m = WALL_CLOCK.exec(value)
  return m ? `${m[1]} ${m[2]}` : value
}

/**
 * The Withdrawn (n) list: newest withdrawal first, and `n` is its length.
 *
 * The server already sends it in that order; this holds it there by comparing the
 * `withdrawnAt` strings — one ISO wall-clock shape, so the text order IS the time
 * order, with no `Date` in between. A stable sort, so a tie keeps the server's order;
 * a missing stamp sorts last. Returns a new array; a non-array is an empty list.
 */
export function withdrawnNewestFirst(list: unknown): WithdrawnSlip[] {
  if (!Array.isArray(list)) return []
  const stamp = (w: WithdrawnSlip | null | undefined) => (typeof w?.withdrawnAt === 'string' ? w.withdrawnAt : '')
  return [...(list as WithdrawnSlip[])].sort((a, b) => {
    const x = stamp(a)
    const y = stamp(b)
    return x === y ? 0 : x < y ? 1 : -1
  })
}

/** A store day's slips as the drawer reads them. */
export interface SlipOwnerList {
  /** STORED slips, newest first as sent. */
  stored: StoredSlip[]
  /** Withdrawn slips, newest withdrawal first. */
  withdrawn: WithdrawnSlip[]
}

/**
 * `ByOwner`'s envelope → the two lists. `withdrawn` rides BESIDE `data`
 * (BackOffice 2035), which is why the read keeps the envelope; an older SIS.Api
 * omits it, and that reads as nothing withdrawn.
 */
export function slipOwnerList(envelope: ApiEnvelope<StoredSlip[], SlipOwnerSiblings>): SlipOwnerList {
  return {
    stored: Array.isArray(envelope.data) ? envelope.data : [],
    withdrawn: withdrawnNewestFirst(envelope.withdrawn),
  }
}

/**
 * The two `/Content` refusal codes the drawer words itself (`AttachmentContentResult`
 * on pricing2). Branched on the CODE, never the status: a 502 is also
 * `FILE_SERVER_KEY_REFUSED`, which is IT's to fix, not a lost file.
 */
export const SLIP_NOT_FOUND = 'NOT_FOUND'
export const SLIP_FILE_MISSING = 'FILE_SERVER_MISSING'

/**
 * What a failed `/Content` means for the drawer:
 * - `gone`: 404 `NOT_FOUND`. The slip is no longer readable (withdrawn meanwhile):
 *   say so and re-read `ByOwner`.
 * - `lost`: 502 `FILE_SERVER_MISSING`. The File Server no longer holds the file. Not
 *   the user's fault, and no retry.
 * - `other`: anything else, shown as the server sent it.
 */
export type SlipContentFailure = 'gone' | 'lost' | 'other'

export function slipContentFailure(code: string | null | undefined): SlipContentFailure {
  if (code === SLIP_NOT_FOUND) return 'gone'
  if (code === SLIP_FILE_MISSING) return 'lost'
  return 'other'
}
