/**
 * A store's Takes list, as drawn (oms 942, BackOffice spec 4157 stories 40–42) — pure. The take door's calls for a
 * store and a day: granted (the batches it took), refused (the batch the door named and the reason), failed (its status;
 * the request log has no item). Failed calls carry no item, so a search by item or batch leaves them out, and a line
 * says so.
 */
import type { StockConsoleTakeRow } from '@/core/models/stock-console'
import type { Severity } from '@/core/ui/severity'
import { formatPair } from '@/core/util/bidi'
import type { LocalDate } from '@/core/util/date-window'
import { formatFigure } from '@/core/util/number-format'
import type { SearchState } from './search'

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

/** A take row's cells by its kind. An unknown kind is drawn as it came, and nothing else is guessed. */
export function takeCells(row: StockConsoleTakeRow): TakeCells {
  const kind = String(row.kind)
  const kindCell = Object.hasOwn(KIND_SEV, kind) ? { key: `takes.kind.${kind}`, sev: KIND_SEV[kind] } : { raw: kind, sev: 'mute' as const }
  switch (row.kind) {
    case 'granted':
      return {
        ...NONE,
        kind: kindCell,
        item: row.item,
        names: { nameEn: row.nameEn, nameAr: row.nameAr },
        quantity: row.quantity,
        batches: (row.batches ?? []).map((b) => formatPair(b.batch, formatFigure(b.quantity))),
      }
    case 'refused':
      return {
        ...NONE,
        kind: kindCell,
        item: row.item,
        names: { nameEn: row.nameEn, nameAr: row.nameAr },
        quantity: row.asked,
        batches: row.namedBatch ? [row.namedBatch] : [],
        reason: row.reason || row.code || null,
      }
    case 'failed':
      return { ...NONE, kind: kindCell, batches: [], status: { code: row.statusCode ?? null, ms: row.durationMs ?? null } }
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
  return state.item !== '' || state.batch !== '' || data?.failedLeftOut === true
}

/** The day the Takes list reads: the address's, or today. */
export function takesDay(state: SearchState, today: LocalDate): LocalDate {
  const day = state.extras.day ?? ''
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today
}
