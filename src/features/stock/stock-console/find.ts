/**
 * Find an item or a batch (oms 943, BackOffice spec 4157 stories 62–65, BO 4161) — pure. The search-first frame across
 * the fleet: with a batch, one row per store, item and batch, with the count of rows and of stores; without one, items
 * by number or name, each opening its Other stores view on this page; both boxes empty, Search says what to fill and
 * asks nothing (`NothingToFind` is only the server's backstop).
 *
 * The opened item and its page are in the address (`stores`, `storesPage`) beside the search, so a link reopens both.
 */
import type {
  StockConsoleFind,
  StockConsoleFindBatchRow,
  StockConsoleFindItemRow,
  StockConsolePage,
} from '@/core/models/stock-console'
import { itemHref } from './console-pages'
import { STOCK_CONSOLE_PAGE_SIZE, searchToParams, shouldRead, type ListSpec, type SearchState } from './search'

/** What Find owns in the address: no filter, no sort; the opened item's Other stores and their page are carried. */
export const FIND_LIST: ListSpec = { filters: [], keep: ['stores', 'storesPage'] }

/** Nothing read yet; both boxes empty (say what to fill, ask nothing); the batch answer; the items answer. */
export type FindDecision = 'nothing' | 'fill' | 'batch' | 'item'

/** What Find asks, by what is filled: a batch (with or without an item) asks the fleet for it; an item alone, items. */
export function findDecision(state: SearchState): FindDecision {
  if (!shouldRead(state)) return 'nothing'
  if (state.batch.trim() !== '') return 'batch'
  if (state.item.trim() !== '') return 'item'
  return 'fill'
}

/** What Find sends: the two boxes and the page. Find has no filter or sort; the GS1 code is read first (944). */
export type FindWire = {
  item: string
  batch: string
  page: number
  size: number
}

export const findWire = (state: SearchState): FindWire => ({
  item: state.item,
  batch: state.batch,
  page: state.page,
  size: STOCK_CONSOLE_PAGE_SIZE,
})

type FindReply = Partial<StockConsolePage<unknown>> & { kind?: string; stores?: number }

/**
 * Find's answer as drawn, picked by what was sent — the server's `kind` [guess] is not trusted over it. A batch answer
 * without its store count has none (null): the stores on one page would undercount a longer match. Absent rows read as none.
 */
export function findAnswer(
  sent: 'batch' | 'item',
  d: FindReply | null | undefined,
  asked: { page: number; size: number },
): StockConsoleFind {
  const page = { total: d?.total ?? 0, page: d?.page ?? asked.page, size: d?.size ?? asked.size }
  if (sent === 'item') return { kind: 'Item', ...page, rows: (d?.rows ?? []) as StockConsoleFindItemRow[] }
  const rows = (d?.rows ?? []) as StockConsoleFindBatchRow[]
  return { kind: 'Batch', ...page, stores: typeof d?.stores === 'number' ? d.stores : null, rows }
}

/**
 * The answer to draw for what is asked now. The last page is kept on screen while the next reads; an answer of the
 * other kind (the last search had a batch, this one has none) would be drawn under the wrong columns, so it is not.
 */
export function answerShown(decision: FindDecision, data: StockConsoleFind | undefined): StockConsoleFind | undefined {
  if (!data) return undefined
  if (decision === 'batch') return data.kind === 'Batch' ? data : undefined
  if (decision === 'item') return data.kind === 'Item' ? data : undefined
  return undefined
}

/** A batch row opens its item at its store. */
export const findRowHref = (row: Pick<StockConsoleFindBatchRow, 'plant' | 'item'>): string => itemHref(row.plant, row.item)

/** The item whose Other stores view is open on Find, or null. */
export const itemStoresOpen = (state: SearchState): string | null => state.kept.stores || null

/** The page of the opened item's stores (1-based; a bad page reads as the first). */
export function itemStoresPage(state: SearchState): number {
  const page = Number.parseInt(state.kept.storesPage ?? '', 10)
  return Number.isFinite(page) && page >= 1 ? page : 1
}

/**
 * The address with an item's Other stores open at `page` (the first unless given), the search kept as it is — or, with
 * `null`, closed.
 */
export function itemStoresParams(state: SearchState, item: string | null, page = 1): URLSearchParams {
  const kept: Record<string, string> = {}
  if (item) {
    kept.stores = item
    if (page > 1) kept.storesPage = String(Math.floor(page))
  }
  return searchToParams({ ...state, kept }, FIND_LIST)
}
