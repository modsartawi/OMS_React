/**
 * What each Ready for collection cell draws (ticket 317) — the rules the grid and
 * its tests read from one place.
 *
 * 🔑 **A `null` is an absence, never a zero** (BackOffice 1994's `## Web contract`).
 * A receipt has no business day, no Z and nothing deducted, and a day whose Z has
 * not reached head office has no figures yet: each draws the em dash, which is a
 * deliberate refusal to state a figure — a blank cell would read as *not loaded*,
 * and `0.000` would state a figure nobody recorded. The settlement screens'
 * `remainingCell` draws the same dash for the same reason.
 *
 * Read-only, and there is **no total**: the list is what still waits, and a
 * sum over it would add riyals and dinars and prepared receipts to days.
 */
import type { CollectionReadyRow } from '@/core/models/collection'
import { formatMoneyIn } from '@/core/money'
import { formatDay } from '@/core/util/date-format'

/** The wire's two kinds (`CollectionReadyKinds`), spelled once. */
export const READY_KINDS = { day: 'DAY', settlement: 'SETTLEMENT' } as const

/** The kinds this client names — read off `READY_KINDS`, so a third kind is one line there. */
const KNOWN_KINDS = new Set<string>(Object.values(READY_KINDS))

/** What an absent value draws. A symbol, not a sentence. */
export const ABSENT = '—'

/** Is this row a prepared settlement receipt (rather than a closed day)? */
export const isReceipt = (row: Pick<CollectionReadyRow, 'kind'>): boolean =>
  row.kind === READY_KINDS.settlement

/**
 * The en key naming a kind, or `null` for a kind this client has never heard of —
 * whose cell then shows the raw value rather than a raw `t()` key.
 */
export function readyKindKey(kind: string | null | undefined): string | null {
  return KNOWN_KINDS.has(kind ?? '') ? `ready.kinds.${kind}` : null
}

/** A money cell: the row's own currency's decimals, or the dash for a `null`. */
export function readyMoney(value: number | null | undefined, currencyKey: string | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatMoneyIn(value, currencyKey) : ABSENT
}

/** The Z number, or the dash on a receipt and on a day whose Z has not arrived. */
export function readyZNumber(row: Pick<CollectionReadyRow, 'zNumber'>): string {
  return typeof row.zNumber === 'number' ? String(row.zNumber) : ABSENT
}

/**
 * The shortage entry's number — a receipt's handle. The dash on a day (`0`) and on
 * a receipt whose entry is gone (also `0`): neither is an entry numbered zero.
 */
export function readyEntryNumber(row: Pick<CollectionReadyRow, 'kind' | 'entryNumber'>): string {
  return isReceipt(row) && row.entryNumber > 0 ? String(row.entryNumber) : ABSENT
}

/** The business day, or the dash on a receipt (it covers no sales day) and a placeholder. */
export function readyBusinessDay(row: Pick<CollectionReadyRow, 'businessDay'>): string {
  return formatDay(row.businessDay) || ABSENT
}

/**
 * The grid's row identity: the kind plus the key the contract names for it
 * (`shiftId` on a day, `settlementDocumentId` on a receipt). Prefixed with the kind
 * so a day and a receipt can never share one.
 */
export function readyRowId(row: Pick<CollectionReadyRow, 'kind' | 'shiftId' | 'settlementDocumentId'>): string {
  // Whichever key the row carries — a kind this client has never heard of still gets
  // the key it was sent rather than an empty one shared with its neighbours.
  return `${row.kind}:${isReceipt(row) ? row.settlementDocumentId : row.shiftId || row.settlementDocumentId}`
}
