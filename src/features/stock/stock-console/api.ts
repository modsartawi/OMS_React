/**
 * The stock console's server calls (oms 940–945, BackOffice spec 4157): SIS.Api's `StockConsole/*` reads, cookie-only,
 * behind `BackOfficeScreen[StockConsole, 03]`. The gate lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. Each answer is normalised
 * here — an absent list reads as none — so a shape the server has not settled yet is reconciled in one place.
 * Every query key starts with `STOCK_CONSOLE_KEY`; later tickets append their reads below a divider.
 */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api, apiErrorKind } from '@/core/api'
import type {
  StockConsoleBatchRow,
  StockConsoleItemRow,
  StockConsolePage,
  StockConsoleScan,
  StockConsoleStoreRow,
  StockConsoleStores,
} from '@/core/models/stock-console'
import { shouldRead, wireParams, type SearchState, type WireSearch } from './search'
import type { StoreTab } from './store-tabs'

export const STOCK_CONSOLE_KEY = ['stock', 'stock-console'] as const

/** A row as drawn: an absent flag list reads as none. */
const storeRow = (r: StockConsoleStoreRow): StockConsoleStoreRow => ({ ...r, flags: r.flags ?? [] })

/** Stock Visibility's page as drawn: absent rows read as none, an absent total as 0, an absent page as the one asked. */
export function toPage<T>(d: Partial<StockConsolePage<T>> | null | undefined, asked: { page: number; size: number }): StockConsolePage<T> {
  return { total: d?.total ?? 0, page: d?.page ?? asked.page, size: d?.size ?? asked.size, rows: d?.rows ?? [] }
}

const storePath = (store: string) => `StockConsole/Stores/${encodeURIComponent(store)}`

export const stockConsoleApi = {
  // ── 940 ──
  /** `GET StockConsole/Stores` → every store's row (SIS.Api's copy, at most 60 s old), whole. */
  async stores(): Promise<StockConsoleStores> {
    const d = await api.get<Partial<StockConsoleStores> | null>('StockConsole/Stores')
    return { readAt: d?.readAt ?? '', stores: (d?.stores ?? []).map(storeRow), fleet: d?.fleet ?? [] }
  },

  // ── 941 ──
  /** `GET StockConsole/Stores/{store}` → the store's row, read fresh (never the 60 s copy). `NoStore` when unknown. */
  async store(store: string): Promise<StockConsoleStoreRow> {
    return storeRow(await api.get<StockConsoleStoreRow>(storePath(store)))
  },
  /** `GET StockConsole/Stores/{store}/Items` → a page of the store's items. The item box goes raw (SIS.Api decides
   *  number or name). */
  async items(store: string, q: WireSearch): Promise<StockConsolePage<StockConsoleItemRow>> {
    return toPage(await api.get<Partial<StockConsolePage<StockConsoleItemRow>> | null>(`${storePath(store)}/Items`, q), q)
  },
  /** `GET StockConsole/Stores/{store}/Batches` → a page of the store's batches, sorted item then expiry (server). */
  async batches(store: string, q: WireSearch): Promise<StockConsolePage<StockConsoleBatchRow>> {
    return toPage(await api.get<Partial<StockConsolePage<StockConsoleBatchRow>> | null>(`${storePath(store)}/Batches`, q), q)
  },
}

/** The stores list, read once on opening; Refresh re-reads it. SIS.Api keeps a 60 s copy, so 30 s here is fresh enough. */
export const storesQuery = () =>
  queryOptions({
    queryKey: [...STOCK_CONSOLE_KEY, 'stores'] as const,
    queryFn: () => stockConsoleApi.stores(),
    staleTime: 30_000,
    retry: retryUnlessAnswered,
  })

/** A coded refusal (`ConsoleBusy`, `NoStore`, …) is an answer, not a blip: only an outage is retried, once. */
export const retryUnlessAnswered = (failures: number, err: unknown): boolean =>
  apiErrorKind(err) !== 'business' && failures < 1

// ── 941 ──

/** Every read of one store sits under this key. */
export const storeKey = (store: string) => [...STOCK_CONSOLE_KEY, 'store', store] as const
/** A store tab's reads — what the tab strip's Refresh invalidates, and only that. */
export const storeTabKey = (store: string, tab: StoreTab) => [...storeKey(store), tab] as const

/** The store's header, read on opening; outside every tab's key, so a tab's Refresh leaves it be. */
export const storeHeaderQuery = (store: string) =>
  queryOptions({
    queryKey: [...storeKey(store), 'header'] as const,
    queryFn: () => stockConsoleApi.store(store),
    retry: retryUnlessAnswered,
  })

/**
 * A searched list's query: keyed on what it sends, read only once a search ran (the search-first rule), the last page
 * kept on screen while the next one reads. Each list tab passes its own read.
 */
export function listQuery<T>(
  store: string,
  tab: StoreTab,
  state: SearchState,
  read: (store: string, q: WireSearch) => Promise<StockConsolePage<T>>,
) {
  const wire = wireParams(state)
  return queryOptions({
    queryKey: [...storeTabKey(store, tab), wire] as const,
    queryFn: () => read(store, wire),
    enabled: shouldRead(state),
    placeholderData: keepPreviousData,
    retry: retryUnlessAnswered,
  })
}

export const itemsQuery = (store: string, state: SearchState) => listQuery(store, 'items', state, stockConsoleApi.items)
export const batchesQuery = (store: string, state: SearchState) =>
  listQuery(store, 'batches', state, stockConsoleApi.batches)

// ── 944 ──

/**
 * `GET StockConsole/Scan?code=` → what HQ's barcode master reads in the GS1 box's code (BO 4162). Kept beside
 * `stockConsoleApi` rather than in it, so parallel tickets append without touching the same lines. An absent kind reads
 * as `Unknown`; an absent `expiryDayKnown` as known.
 */
export async function readScan(code: string): Promise<StockConsoleScan> {
  const d = await api.get<Partial<StockConsoleScan> | null>('StockConsole/Scan', { code })
  return {
    kind: d?.kind ?? 'Unknown',
    itemFound: d?.itemFound === true,
    item: d?.item ?? null,
    nameEn: d?.nameEn ?? null,
    nameAr: d?.nameAr ?? null,
    gtin: d?.gtin ?? null,
    lot: d?.lot ?? null,
    expiry: d?.expiry ?? null,
    expiryDayKnown: d?.expiryDayKnown !== false,
    serial: d?.serial ?? null,
  }
}

/**
 * The GS1 box's scan: read once a search ran with the box filled (`scanCode`), keyed on the code — every list of the
 * console shares it, and the list's own query waits on it (`scannedList`). A code reads the same for minutes.
 */
export const scanQuery = (code: string) =>
  queryOptions({
    queryKey: [...STOCK_CONSOLE_KEY, 'scan', code] as const,
    queryFn: () => readScan(code),
    enabled: code !== '',
    staleTime: 5 * 60_000,
    retry: retryUnlessAnswered,
  })
