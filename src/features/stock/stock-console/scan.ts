/**
 * The GS1 box (oms 944, BackOffice spec 4157 "GS1", BO 4162) — pure. `StockConsole/Scan` reads the code; this module
 * turns its answer into what the list searches (the item and the vendor batch), the chips of what was read, and the
 * line that says why something was not found or not searched.
 */
import type { StockConsoleScan } from '@/core/models/stock-console'
import { shouldRead, wireParams, type SearchState } from './search'
import type { FrameQuery } from './SearchFrame'

/** The chips' kinds, in the spec's order (`gs1.chip.<kind>`). */
export const SCAN_CHIPS = ['item', 'gtin', 'lot', 'expiry', 'serial'] as const

/** A chip of what was read from the code. The item's chip carries its names. */
export type ScanChip =
  | { kind: 'item'; value: string; nameEn: string; nameAr: string }
  | { kind: Exclude<(typeof SCAN_CHIPS)[number], 'item'>; value: string }

/** The lines drawn above the rows (`gs1.note.<note>`). */
export const SCAN_NOTES = ['itemNotFound', 'itemNotFoundNoLot', 'unknownCode'] as const
export type ScanNote = (typeof SCAN_NOTES)[number]

export interface ScanSearch {
  /** Whether the list is read at all. */
  search: boolean
  /** The item box, as the scan fills it ('' = empty). */
  item: string
  /** The batch box: the code's lot, searched as a vendor batch ('' = empty). */
  batch: string
  note: ScanNote | null
  chips: ScanChip[]
}

const text = (v: string | null | undefined): string => (v ?? '').trim()

/**
 * The scan's expiry as it is shown and compared: its day (`yyyy-MM-dd`), or its month (`yyyy-MM`) when the code's day
 * is 00. '' when the answer has none.
 */
export function scanExpiry(scan: Pick<StockConsoleScan, 'expiry' | 'expiryDayKnown'>): string {
  const day = text(scan.expiry).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
  return scan.expiryDayKnown === false ? day.slice(0, 7) : day
}

/** The chips of what the code says, in the spec's order — item and name, GTIN, lot, expiry, serial — each when present. */
function chipsOf(scan: StockConsoleScan, withItem: boolean): ScanChip[] {
  const chips: ScanChip[] = []
  if (withItem && text(scan.item))
    chips.push({ kind: 'item', value: text(scan.item), nameEn: scan.nameEn ?? '', nameAr: scan.nameAr ?? '' })
  if (text(scan.gtin)) chips.push({ kind: 'gtin', value: text(scan.gtin) })
  if (text(scan.lot)) chips.push({ kind: 'lot', value: text(scan.lot) })
  if (scanExpiry(scan)) chips.push({ kind: 'expiry', value: scanExpiry(scan) })
  if (text(scan.serial)) chips.push({ kind: 'serial', value: text(scan.serial) })
  return chips
}

/** A scan answer read into the search: the GS1 box wins over the item and batch boxes. */
export function applyScan(scan: StockConsoleScan): ScanSearch {
  const item = text(scan.item)
  if (scan.kind === 'Barcode' && item)
    // A plain barcode, matched exactly: the item, never a batch.
    return { search: true, item, batch: '', note: null, chips: chipsOf({ ...scan, lot: null }, true) }
  // Anything but a GS1 code (an unknown kind read defensively, or a barcode with no item) is not a code we know.
  if (scan.kind !== 'Gs1') return { search: false, item: '', batch: '', note: 'unknownCode', chips: [] }
  const lot = text(scan.lot)
  if (!scan.itemFound || !item)
    // The GTIN is not in the barcode master: the lot alone, as a vendor batch. No lot: nothing to search [guess].
    return {
      search: lot !== '',
      item: '',
      batch: lot,
      note: lot ? 'itemNotFound' : 'itemNotFoundNoLot',
      chips: chipsOf(scan, false),
    }
  return { search: true, item, batch: lot, note: null, chips: chipsOf(scan, true) }
}

/**
 * The code to read: the address's GS1 box once a search ran ('' = no scan). The code stays in the address, so a shared
 * link repeats the scan.
 */
export const scanCode = (state: SearchState): string => (shouldRead(state) ? state.gs1 : '')

/**
 * The state the list reads. The GS1 box empty: the list's own. Filled, it wins: the list waits for the scan's answer,
 * then searches the item and the vendor batch it gave — or nothing, when the scan says there is nothing to search.
 */
export function scannedList(state: SearchState, scan: StockConsoleScan | undefined): SearchState {
  if (!scanCode(state)) return state
  if (!scan) return { ...state, ran: false }
  const read = applyScan(scan)
  return read.search ? { ...state, item: read.item, batch: read.batch } : { ...state, ran: false }
}

/** The part of the scan's query the frame looks at (a TanStack Query result fits). */
/**
 * Whether a Search with the GS1 box filled asks exactly what is already asked: the same code, and the same list read once
 * the scan has put its item and lot in (`scannedList`). The address may still change — the boxes it overrides were
 * typed differently — but no query key does, so the frame must read again itself ("busy, try again" can be tried
 * again). False with the GS1 box empty: the list's own address decides (`sameSearch`).
 */
export function scanReadsSame(shown: SearchState, next: SearchState, scan: StockConsoleScan | undefined): boolean {
  const code = scanCode(next)
  if (code === '' || code !== scanCode(shown)) return false
  const [a, b] = [scannedList(shown, scan), scannedList(next, scan)]
  // Neither reads a list (the scan unanswered, or nothing to search): the scan's read is all that is asked.
  if (!a.ran && !b.ran) return true
  return a.ran === b.ran && JSON.stringify(wireParams(a)) === JSON.stringify(wireParams(b))
}

export interface ScanRead {
  isError: boolean
  error: unknown
  data: StockConsoleScan | undefined
  isFetching: boolean
  refetch: () => unknown
}

/** The frame's read with a scan in it; `stopped` = the scan says nothing is searched (its line says why). */
export interface ScanFrameRead extends FrameQuery {
  stopped: boolean
}

/**
 * What the frame draws when the GS1 box is filled: the scan's read until it answers (loading, or its refusal — and
 * Search again reads the scan again), then the list's. A code that searches nothing stops the frame.
 */
export function scanFrameRead(state: SearchState, scan: ScanRead, list: FrameQuery): ScanFrameRead {
  if (!scanCode(state)) return { ...list, stopped: false }
  const scanOnly = { data: undefined, isPlaceholderData: false, isFetching: scan.isFetching, refetch: scan.refetch }
  if (scan.isError) return { ...scanOnly, isPending: false, isError: true, error: scan.error, stopped: false }
  if (!scan.data) return { ...scanOnly, isPending: true, isError: false, error: null, isFetching: true, stopped: false }
  if (!applyScan(scan.data).search) return { ...scanOnly, isPending: false, isError: false, error: null, stopped: true }
  return { ...list, stopped: false }
}

/** The marks drawn (`gs1.mark.<mark>`): `differs` draws "scan says <scan>". */
export const SCAN_MARKS = ['matches', 'differs'] as const

/** A batch row's expiry against the scan's; `none` draws nothing. */
export type ScanExpiryMark = (typeof SCAN_MARKS)[number] | 'none'

export interface ScanExpiryCell {
  mark: ScanExpiryMark
  /** The scan's expiry as shown: a day, or a month when the code's day is 00. */
  scan: string
}

/**
 * Whether a batch row's expiry is the scan's (spec 4157 "GS1"): compared by day, or by month when the code's day is
 * not known. No mark when there is no scan, or either side has no expiry.
 */
export function expiryMark(
  rowExpiry: string | null | undefined,
  scan: Pick<StockConsoleScan, 'expiry' | 'expiryDayKnown'> | null | undefined,
): ScanExpiryCell {
  const said = scan ? scanExpiry(scan) : ''
  const day = text(rowExpiry).slice(0, 10)
  if (!said || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { mark: 'none', scan: said }
  return { mark: day.slice(0, said.length) === said ? 'matches' : 'differs', scan: said }
}
