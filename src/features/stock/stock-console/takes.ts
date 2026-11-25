/**
 * A store's Takes list, as drawn (oms 942, BackOffice spec 4157 stories 40–42) — pure. The take door's calls for a
 * store and a day: granted (the batches it took), refused (the batch the door named and the reason), failed (its status;
 * the request log has no item). Failed calls carry no item, so a search by item or batch leaves them out, and a line
 * says so.
 */
import { TAKE_OUTCOMES, TAKES_FALLBACK_ONLY, type StockConsoleTakeRow } from '@/core/models/stock-console'
import type { Severity } from '@/core/ui/severity'
import { formatPair } from '@/core/util/bidi'
import type { LocalDate } from '@/core/util/date-window'
import { formatFigure } from '@/core/util/number-format'
import type { ListSpec, SearchState } from './search'

/**
 * What the Takes list owns in the address: its outcome filter, its day and (BackOffice 4277) the expiry fallback filter;
 * no sort.
 */
export const TAKES_LIST: ListSpec = { filters: TAKE_OUTCOMES, extras: ['day', 'fallback'], keep: ['tab'] }

const KIND_SEV: Record<string, Severity> = { granted: 'ok', refused: 'warn', failed: 'bad' }

export interface TakeCells {
  kind: { key: string; sev: Severity } | { raw: string; sev: Severity }
  item: string | null
  names: { nameEn: string; nameAr: string } | null
  /** Granted: taken; refused: asked; failed: none. */
  quantity: number | null
  /** Granted: each batch taken with its quantity, one value each; refused: the batch the door named. */
  batches: string[]
  /** A refusal's reason — its sentence, or its code when it has none. */
  reason: string | null
  /** A failed call's status code and how long it took. */
  status: { code: number | null; ms: number | null } | null
}

const NONE = { item: null, names: null, quantity: null, reason: null, status: null } as const

/**
 * A take row's cells by its kind (SIS.Api's row is flat: the kind says which fields it fills). An unknown kind is drawn
 * as it came, and nothing else is guessed.
 */
export function takeCells(row: StockConsoleTakeRow): TakeCells {
  const kind = row.kind
  const kindCell = Object.hasOwn(KIND_SEV, kind) ? { key: `takes.kind.${kind}`, sev: KIND_SEV[kind] } : { raw: kind, sev: 'mute' as const }
  switch (row.kind) {
    case 'granted':
      return {
        ...NONE,
        kind: kindCell,
        item: row.item,
        names: { nameEn: row.nameEn, nameAr: row.nameAr },
        quantity: row.quantity,
        // The take's holds; Stock Visibility may send a granted row without them.
        batches: (row.batches ?? []).map((b) => formatPair(b.batch, formatFigure(b.quantity))),
      }
    case 'refused':
      return {
        ...NONE,
        kind: kindCell,
        item: row.item,
        names: { nameEn: row.nameEn, nameAr: row.nameAr },
        quantity: row.asked,
        batches: row.batchWithStock ? [row.batchWithStock] : [],
        reason: row.reason || row.code || null,
      }
    case 'failed':
      return { ...NONE, kind: kindCell, batches: [], status: { code: row.statusCode, ms: row.durationMs } }
    default:
      return { ...NONE, kind: kindCell, batches: [] }
  }
}

/**
 * Whether the "failed calls are not searchable by item" line shows: a search ran with an item or a batch in the boxes,
 * or the server says it left failed calls out — on a list that would show failed calls at all.
 */
export function failedNotSearchable(state: SearchState, data: { failedLeftOut: boolean } | undefined): boolean {
  if (!state.ran || state.filter === 'granted' || state.filter === 'refused') return false
  return state.item !== '' || state.batch !== '' || fallbackOnly(state) || data?.failedLeftOut === true
}

/** BackOffice 4277: the list is filtered on the expiry fallback (`fallback=true` in the address and on the wire). */
export const fallbackOnly = (state: SearchState): boolean => state.extras.fallback === TAKES_FALLBACK_ONLY

/** The notes Stock Visibility writes when the fallback could not run (`ExpiryFallbackNotes`); each has its words. */
export const FALLBACK_NOTES = ['ScannedDateDisagrees'] as const

/** A fallback note in the console's words when it is known, else as it came. */
export const fallbackNoteWord = (note: string): { key: string } | { raw: string } =>
  (FALLBACK_NOTES as readonly string[]).includes(note) ? { key: `takes.fallbackNote.${note}` } : { raw: note }

/** A take row's fallback cell (BackOffice 4277, spec 4275, ADR 0146). */
export interface TakeFallbackCell {
  /** `takes.fallback.placed` (the fallback placed it), `.wouldBe` (a `Record` store's refusal), `.note` (it could not run). */
  key: string
  sev: Severity
  /** The pack's own (scanned) vendor batch. */
  vendorBatch: string | null
  /** The batches the fallback chose (placed) or would have chosen (refused), each with its quantity, one value each. */
  batches: string[]
  /** Why the fallback could not run, as Stock Visibility names it. */
  note: string | null
}

/**
 * The fallback cell: a granted take the fallback placed (its fallback batches only), a refusal with the batch the fallback
 * would have chosen, or a refusal with the note saying why it could not run. Anything else, and a row from a server without
 * the fields, has none.
 */
export function takeFallback(row: StockConsoleTakeRow): TakeFallbackCell | null {
  const vendorBatch = row.scannedVendorBatch ?? null
  if (row.kind === 'granted' && row.isExpiryFallback === true) {
    const batches = (row.batches ?? [])
      .filter((b) => b.isExpiryFallback === true)
      .map((b) => formatPair(b.batch, formatFigure(b.quantity)))
    return { key: 'takes.fallback.placed', sev: 'warn', vendorBatch, batches, note: null }
  }
  if (row.kind !== 'refused') return null
  const note = row.fallbackNote || null
  if (row.fallbackBatch)
    return {
      key: 'takes.fallback.wouldBe',
      sev: 'mute',
      vendorBatch,
      batches: [formatPair(row.fallbackBatch, formatFigure(row.fallbackQuantity ?? null))],
      note,
    }
  return note ? { key: 'takes.fallback.note', sev: 'bad', vendorBatch, batches: [], note } : null
}

/**
 * The fallback cell as one value, for the grid's sort, filter, copy and export (review O6): the mark, the batches and the
 * note, the note in the console's words when known, else as it came. Empty when the row has no fallback cell.
 */
export function takeFallbackValue(row: StockConsoleTakeRow, t: (key: string) => string): string {
  const cell = takeFallback(row)
  if (!cell) return ''
  const note = cell.note ? fallbackNoteWord(cell.note) : null
  const noteText = note ? ('key' in note ? t(note.key) : note.raw) : null
  return [t(cell.key), ...cell.batches, ...(noteText ? [noteText] : [])].join(' ')
}

/** The day the Takes list reads: the address's, or today. */
export function takesDay(state: SearchState, today: LocalDate): LocalDate {
  const day = state.extras.day ?? ''
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today
}
