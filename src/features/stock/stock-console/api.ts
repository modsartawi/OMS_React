/**
 * The stock console's server calls (oms 940–945, BackOffice spec 4157): SIS.Api's `StockConsole/*` reads, cookie-only,
 * behind `BackOfficeScreen[StockConsole, 03]`. The gate lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. Each answer is normalised
 * here — an absent list reads as none, an absent figure as no answer — so a shape the server has not settled yet is
 * reconciled in one place. Every query key starts with `STOCK_CONSOLE_KEY`.
 *
 * `stockConsoleApi` is grouped by resource: stores, a store's tabs, an item, the fleet, Find, the GS1 scan, movements.
 * The query options follow in the same order.
 */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api, apiErrorKind } from '@/core/api'
import type {
  StockConsoleBatchRow,
  StockConsoleFind,
  StockConsoleFleet,
  StockConsoleGates,
  StockConsoleHoldRow,
  StockConsoleItem,
  StockConsoleItemRow,
  StockConsoleItemStoreRow,
  StockConsoleLedgerLine,
  StockConsolePage,
  StockConsoleSapLine,
  StockConsoleSapMovements,
  StockConsoleScan,
  StockConsoleStoreFeeds,
  StockConsoleStoreRow,
  StockConsoleStores,
  StockConsoleStoreStage,
  StockConsoleTakeRow,
  StockConsoleTakes,
} from '@/core/models/stock-console'
import type { LocalDate } from '@/core/util/date-window'
import { findAnswer, findDecision, findWire, type FindWire } from './find'
import { toItem, type ItemWire } from './item-sum'
import type { ItemTab } from './item-tabs'
import { toLedgerLine, type DayWindow, type LedgerLineWire, type MovementsState, type WindowRead } from './movements'
import { STOCK_CONSOLE_PAGE_SIZE, shouldRead, wireParams, type SearchState, type WireSearch } from './search'
import type { StoreTab } from './store-tabs'
import { takesDay } from './takes'

export const STOCK_CONSOLE_KEY = ['stock', 'stock-console'] as const

// ── Normalisers ─────────────────────────────────────────────────────────────────────────────────────

/** The page a read asks for (1-based). A type, not an interface: it goes to `api.get` as query params as it is. */
export type PageAsk = {
  page: number
  size: number
}

/**
 * A page as it may arrive: the contract's `{ total, page, size, rows }`, its rows as `lines` (SV 079 as built), or a bare
 * array (an item tab [guess]) read as one page of it.
 */
type PageWire<W> = (Partial<StockConsolePage<W>> & { lines?: W[] }) | W[] | null | undefined

/**
 * Stock Visibility's page as drawn: absent rows read as none, an absent total as the rows it carries (never 0 over rows:
 * the frame would say "nothing found" above them), an absent page as the one asked. `row` reads each row.
 */
export function toPage<T>(d: PageWire<T>, asked: PageAsk): StockConsolePage<T>
export function toPage<W, T>(d: PageWire<W>, asked: PageAsk, row: (w: W) => T): StockConsolePage<T>
export function toPage<W, T>(d: PageWire<W>, asked: PageAsk, row?: (w: W) => T): StockConsolePage<T> {
  const read = row ?? ((w: W) => w as unknown as T)
  if (Array.isArray(d)) return { total: d.length, page: 1, size: d.length, rows: d.map(read) }
  const rows = (d?.rows ?? d?.lines ?? []).map(read)
  return { total: d?.total ?? rows.length, page: d?.page ?? asked.page, size: d?.size ?? asked.size, rows }
}

/** A row as drawn: an absent flag list reads as none. */
const storeRow = (r: StockConsoleStoreRow): StockConsoleStoreRow => ({ ...r, flags: r.flags ?? [] })

/** The frame's wire params with its `filter` sent under the list's own name (Holds `state`, Takes `outcome`). */
const renameFilter = (q: WireSearch, as: 'state' | 'outcome') => {
  const { filter, ...rest } = q
  return { ...rest, [as]: filter }
}

const normaliseTake = (r: StockConsoleTakeRow): StockConsoleTakeRow =>
  r.kind === 'granted' ? { ...r, batches: r.batches ?? [] } : r

const normaliseGates = (g: Partial<StockConsoleGates> | null | undefined): StockConsoleGates | null =>
  g
    ? {
        from: g.from ?? '',
        to: g.to ?? '',
        hold: g.hold ?? false,
        measured: g.measured ?? [],
        confirmed: g.confirmed ?? [],
        notConfirmed: g.notConfirmed ?? [],
      }
    : null

/** A SAP line as drawn: absent names read as '', absent optional fields as null. */
const toSapLine = (r: Partial<StockConsoleSapLine>): StockConsoleSapLine => ({
  materialDocument: r.materialDocument ?? '',
  year: r.year ?? '',
  line: r.line ?? '',
  item: r.item ?? '',
  nameEn: r.nameEn ?? '',
  nameAr: r.nameAr ?? '',
  batch: r.batch ?? null,
  quantity: r.quantity ?? 0,
  unit: r.unit ?? null,
  postingDay: r.postingDay ?? null,
  entryTime: r.entryTime ?? null,
  mark: r.mark ?? '',
})

// ── The calls ───────────────────────────────────────────────────────────────────────────────────────

const storePath = (store: string) => `StockConsole/Stores/${encodeURIComponent(store)}`
const itemPath = (store: string, item: string) => `${storePath(store)}/Items/${encodeURIComponent(item)}`

/** Rows an item tab asks for at once (Stock Visibility's clamp) [guess]: an item's batches, holds and takes are few. */
export const ITEM_TAB_SIZE = 200
const ITEM_TAB_PAGE: PageAsk = { page: 1, size: ITEM_TAB_SIZE }

export const stockConsoleApi = {
  // ── Stores (940, 941) ──
  /** `GET StockConsole/Stores` → every store's row (SIS.Api's copy, at most 60 s old), whole. */
  async stores(): Promise<StockConsoleStores> {
    const d = await api.get<Partial<StockConsoleStores> | null>('StockConsole/Stores')
    return { readAt: d?.readAt ?? '', stores: (d?.stores ?? []).map(storeRow), fleet: d?.fleet ?? [] }
  },
  /** `GET StockConsole/Stores/{store}` → the store's row, read fresh (never the 60 s copy). `NoStore` when unknown. */
  async store(store: string): Promise<StockConsoleStoreRow> {
    return storeRow(await api.get<StockConsoleStoreRow>(storePath(store)))
  },

  // ── A store's tabs (941, 942) ──
  /** `…/Items` → a page of the store's items. The item box goes raw (SIS.Api decides number or name). */
  async items(store: string, q: WireSearch): Promise<StockConsolePage<StockConsoleItemRow>> {
    return toPage(await api.get<PageWire<StockConsoleItemRow>>(`${storePath(store)}/Items`, q), q)
  },
  /** `…/Batches` → a page of the store's batches, sorted item then expiry (server). */
  async batches(store: string, q: WireSearch): Promise<StockConsolePage<StockConsoleBatchRow>> {
    return toPage(await api.get<PageWire<StockConsoleBatchRow>>(`${storePath(store)}/Batches`, q), q)
  },
  /** `…/Holds` → a page of the store's holds, oldest first (released: newest first). */
  async holds(store: string, q: WireSearch): Promise<StockConsolePage<StockConsoleHoldRow>> {
    return toPage(await api.get<PageWire<StockConsoleHoldRow>>(`${storePath(store)}/Holds`, renameFilter(q, 'state')), q)
  },
  /** `…/Takes` → a page of the take door's calls for one day. */
  async takes(store: string, q: WireSearch): Promise<StockConsoleTakes> {
    const d = await api.get<Partial<StockConsoleTakes> | null>(`${storePath(store)}/Takes`, renameFilter(q, 'outcome'))
    return { ...toPage(d, q, normaliseTake), failedLeftOut: d?.failedLeftOut ?? false }
  },
  /** `…/Feeds` → the store's SAP and till places and its nightly comparison. */
  async feeds(store: string): Promise<StockConsoleStoreFeeds> {
    const d = await api.get<Partial<StockConsoleStoreFeeds> | null>(`${storePath(store)}/Feeds`)
    return {
      plant: d?.plant ?? store,
      sapPlace: d?.sapPlace ?? null,
      sapLastAttempt: d?.sapLastAttempt ?? null,
      tillPlace: d?.tillPlace ?? null,
      tillLastAttempt: d?.tillLastAttempt ?? null,
      stage: d?.stage ?? '',
      driftBatches: d?.driftBatches ?? null,
      driftRanAt: d?.driftRanAt ?? null,
    }
  },
  /** `…/Stage` → the stage, its log, the last seed run and the gates toward Blocking. */
  async stage(store: string): Promise<StockConsoleStoreStage> {
    const d = await api.get<Partial<StockConsoleStoreStage> | null>(`${storePath(store)}/Stage`)
    return {
      store: d?.store ?? store,
      stage: d?.stage ?? '',
      updatedAt: d?.updatedAt ?? null,
      moves: d?.moves ?? [],
      lastSeed: d?.lastSeed ?? null,
      gates: normaliseGates(d?.gates),
    }
  },

  // ── An item (943) ──
  /** `…/Items/{item}` → the item's figures and its four sums, each its operands and result (`toItem`). `NoRow` when absent. */
  async item(store: string, item: string): Promise<StockConsoleItem> {
    return toItem(await api.get<ItemWire | null>(itemPath(store, item)), store, item)
  },
  /** `…/Items/{item}/Batches` → the store's Batches read for that item. */
  async itemBatches(store: string, item: string): Promise<StockConsolePage<StockConsoleBatchRow>> {
    return toPage(await api.get<PageWire<StockConsoleBatchRow>>(`${itemPath(store, item)}/Batches`, ITEM_TAB_PAGE), ITEM_TAB_PAGE)
  },
  /** `…/Items/{item}/Holds` → its open holds and those released in the last 7 days, one list. */
  async itemHolds(store: string, item: string): Promise<StockConsolePage<StockConsoleHoldRow>> {
    return toPage(await api.get<PageWire<StockConsoleHoldRow>>(`${itemPath(store, item)}/Holds`, ITEM_TAB_PAGE), ITEM_TAB_PAGE)
  },
  /** `…/Items/{item}/Takes` → its takes of today and the two days before; failed calls carry no item, so none. */
  async itemTakes(store: string, item: string): Promise<StockConsoleTakes> {
    const d = await api.get<(Partial<StockConsoleTakes> & { lines?: StockConsoleTakeRow[] }) | StockConsoleTakeRow[] | null>(
      `${itemPath(store, item)}/Takes`,
      ITEM_TAB_PAGE,
    )
    const leftOut = Array.isArray(d) ? true : (d?.failedLeftOut ?? true)
    return { ...toPage(d, ITEM_TAB_PAGE, normaliseTake), failedLeftOut: leftOut }
  },
  /** `GET StockConsole/Items/{item}/Stores` → a page of the item at every store. */
  async itemStores(item: string, q: PageAsk): Promise<StockConsolePage<StockConsoleItemStoreRow>> {
    return toPage(await api.get<PageWire<StockConsoleItemStoreRow>>(`StockConsole/Items/${encodeURIComponent(item)}/Stores`, q), q)
  },

  // ── The fleet (942) ──
  /** `GET StockConsole/Fleet` → the facts that belong to no store. An absent fact is no answer (null), never healthy. */
  async fleet(): Promise<StockConsoleFleet> {
    const d = await api.get<Partial<StockConsoleFleet> | null>('StockConsole/Fleet')
    const reader = d?.ledgerReader
    return {
      readAt: d?.readAt ?? '',
      // A figure left out of an answered fact is no answer for that figure: null, never 0 ("just now").
      feeds: d?.feeds
        ? d.feeds.map((f) => ({ ...f, lastCompletePassAt: f.lastCompletePassAt ?? null, ageSeconds: f.ageSeconds ?? null }))
        : null,
      reservedRun: d?.reservedRun ?? null,
      heldServed: d?.heldServed ?? null,
      ledgerReader: reader
        ? { lastPassAt: reader.lastPassAt ?? null, lagSeconds: reader.lagSeconds ?? null, readThroughAt: reader.readThroughAt ?? null }
        : null,
      takesToday: d?.takesToday ?? null,
      problems: d?.problems ?? [],
    }
  },

  // ── Find (943) ──
  /** `GET StockConsole/Find` → with a batch, one row per store, item and batch; without, items. Read by what was sent. */
  async find(sent: 'batch' | 'item', q: FindWire): Promise<StockConsoleFind> {
    return findAnswer(sent, await api.get<Parameters<typeof findAnswer>[1]>('StockConsole/Find', q), q)
  },

  // ── The GS1 scan (944) ──
  /**
   * `GET StockConsole/Scan?code=` → what HQ's barcode master reads in the GS1 box's code (BO 4162). An absent kind reads
   * as `Unknown`; an absent `expiryDayKnown` as known.
   */
  async scan(code: string): Promise<StockConsoleScan> {
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
  },

  // ── Movements (945) ──
  /** `…/SapMovements` → SAP's documents by entry day and movement type, and our place. */
  async sapMovements(store: string, q: DayWindow): Promise<StockConsoleSapMovements> {
    const d = await api.get<Partial<StockConsoleSapMovements> | null>(`${storePath(store)}/SapMovements`, q)
    return {
      readAt: d?.readAt ?? '',
      place: { sapPlace: d?.place?.sapPlace ?? null, lastAttempt: d?.place?.lastAttempt ?? null },
      days: d?.days ?? [],
    }
  },
  /** `…/SapMovements/Lines` → a page of one entry day and movement type's lines, each with our mark. */
  async sapLines(store: string, q: { day: string; type: string } & PageAsk): Promise<StockConsolePage<StockConsoleSapLine>> {
    const d = await api.get<PageWire<Partial<StockConsoleSapLine>>>(`${storePath(store)}/SapMovements/Lines`, q)
    return toPage(d, q, toSapLine)
  },
  /** `…/Items/{item}/Movements` → a page of our ledger's lines for the item at the store, newest first. */
  async itemMovements(store: string, item: string, q: DayWindow & PageAsk): Promise<StockConsolePage<StockConsoleLedgerLine>> {
    const d = await api.get<PageWire<LedgerLineWire>>(`${itemPath(store, item)}/Movements`, q)
    return toPage(d, q, toLedgerLine)
  },
}

// ── Retries, keys and kept pages ────────────────────────────────────────────────────────────────────

/**
 * A coded refusal (`ConsoleBusy`, `NoStore`, …), a bare 403 and a signed-out session are answers, not blips: only an
 * outage — the network, or the server — is retried, once.
 */
export const retryUnlessAnswered = (failures: number, err: unknown): boolean => {
  const kind = apiErrorKind(err)
  return (kind === 'network' || kind === 'server') && failures < 1
}

/** Every read of one store sits under this key. */
export const storeKey = (store: string) => [...STOCK_CONSOLE_KEY, 'store', store] as const
/** A store tab's reads — what the tab strip's Refresh invalidates, and only that. */
export const storeTabKey = (store: string, tab: StoreTab) => [...storeKey(store), tab] as const
/** Every read of one item at one store sits under this key. */
export const itemKey = (store: string, item: string) => [...storeKey(store), 'item', item] as const

/**
 * An item tab's reads — what the item page's Refresh invalidates, and only that. Other stores is keyed on the item
 * alone (the same rows from every store's page and from Find).
 */
export const itemTabKey = (store: string, item: string, tab: ItemTab) =>
  tab === 'stores' ? ([...STOCK_CONSOLE_KEY, 'item-stores', item] as const) : ([...itemKey(store, item), tab] as const)

/**
 * The last page kept on screen while the next one reads — only while the key's parts from `at` on are still `same` (a
 * window's days, an opened row's day and type): a new window or row shows its loading line, never the old one's rows.
 */
const keepWhileSame =
  (at: number, same: readonly unknown[]) =>
  <T>(previous: T | undefined, query: { queryKey: readonly unknown[] } | undefined): T | undefined =>
    query && same.every((part, i) => query.queryKey[at + i] === part) ? previous : undefined

// ── Stores ──────────────────────────────────────────────────────────────────────────────────────────

/** The stores list, read once on opening; Refresh re-reads it. SIS.Api keeps a 60 s copy, so 30 s here is fresh enough. */
export const storesQuery = () =>
  queryOptions({
    queryKey: [...STOCK_CONSOLE_KEY, 'stores'] as const,
    queryFn: () => stockConsoleApi.stores(),
    staleTime: 30_000,
    retry: retryUnlessAnswered,
  })

/** The store's header, read on opening; outside every tab's key, so a tab's Refresh leaves it be. */
export const storeHeaderQuery = (store: string) =>
  queryOptions({
    queryKey: [...storeKey(store), 'header'] as const,
    queryFn: () => stockConsoleApi.store(store),
    retry: retryUnlessAnswered,
  })

// ── A store's tabs ──────────────────────────────────────────────────────────────────────────────────

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
export const holdsQuery = (store: string, state: SearchState) => listQuery(store, 'holds', state, stockConsoleApi.holds)

/** The Takes list's query: as `listQuery`, with the day always sent — the address's, or today. */
export function takesQuery(store: string, state: SearchState, today: LocalDate) {
  const wire: WireSearch = { ...wireParams(state), day: takesDay(state, today) }
  return queryOptions({
    queryKey: [...storeTabKey(store, 'takes'), wire] as const,
    queryFn: () => stockConsoleApi.takes(store, wire),
    enabled: shouldRead(state),
    placeholderData: keepPreviousData,
    retry: retryUnlessAnswered,
  })
}

/** A store's Feeds, read when the tab opens; the tab's Refresh re-reads it. */
export const feedsQuery = (store: string) =>
  queryOptions({
    queryKey: storeTabKey(store, 'feeds'),
    queryFn: () => stockConsoleApi.feeds(store),
    retry: retryUnlessAnswered,
  })

/** A store's Stage and count, read when the tab opens; the tab's Refresh re-reads it. */
export const stageQuery = (store: string) =>
  queryOptions({
    queryKey: storeTabKey(store, 'stage'),
    queryFn: () => stockConsoleApi.stage(store),
    retry: retryUnlessAnswered,
  })

// ── An item ─────────────────────────────────────────────────────────────────────────────────────────

/** The item's figures, read on opening; outside every tab's key. */
export const itemHeaderQuery = (store: string, item: string) =>
  queryOptions({
    queryKey: [...itemKey(store, item), 'header'] as const,
    queryFn: () => stockConsoleApi.item(store, item),
    retry: retryUnlessAnswered,
  })

export const itemBatchesQuery = (store: string, item: string) =>
  queryOptions({
    queryKey: itemTabKey(store, item, 'batches'),
    queryFn: () => stockConsoleApi.itemBatches(store, item),
    retry: retryUnlessAnswered,
  })

export const itemHoldsQuery = (store: string, item: string) =>
  queryOptions({
    queryKey: itemTabKey(store, item, 'holds'),
    queryFn: () => stockConsoleApi.itemHolds(store, item),
    retry: retryUnlessAnswered,
  })

export const itemTakesQuery = (store: string, item: string) =>
  queryOptions({
    queryKey: itemTabKey(store, item, 'takes'),
    queryFn: () => stockConsoleApi.itemTakes(store, item),
    retry: retryUnlessAnswered,
  })

/** The item at every store, 25 a page; the last page kept on screen while the next reads. */
export const itemStoresQuery = (item: string, page: number) =>
  queryOptions({
    queryKey: [...STOCK_CONSOLE_KEY, 'item-stores', item, page] as const,
    queryFn: () => stockConsoleApi.itemStores(item, { page, size: STOCK_CONSOLE_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    retry: retryUnlessAnswered,
  })

// ── The fleet ───────────────────────────────────────────────────────────────────────────────────────

/** Feeds and switches, read when the page opens; Refresh re-reads it. */
export const fleetQuery = () =>
  queryOptions({
    queryKey: [...STOCK_CONSOLE_KEY, 'fleet'] as const,
    queryFn: () => stockConsoleApi.fleet(),
    retry: retryUnlessAnswered,
  })

// ── Find ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Find: read only once a search ran with something to find (`findDecision`) — both boxes empty ask nothing. Keyed on what
 * it sends; the last page kept on screen while the next reads (`answerShown` keeps the other kind's off screen).
 */
export function findQuery(state: SearchState) {
  const decision = findDecision(state)
  const sent = decision === 'batch' ? 'batch' : 'item'
  const wire = findWire(state)
  return queryOptions({
    queryKey: [...STOCK_CONSOLE_KEY, 'find', wire] as const,
    queryFn: () => stockConsoleApi.find(sent, wire),
    enabled: decision === 'batch' || decision === 'item',
    placeholderData: keepPreviousData,
    retry: retryUnlessAnswered,
  })
}

// ── The GS1 scan ────────────────────────────────────────────────────────────────────────────────────

/**
 * The GS1 box's scan: read once a search ran with the box filled (`scanCode`), keyed on the code — every list of the
 * console shares it, and the list's own query waits on it (`scannedList`). A code reads the same for minutes.
 */
export const scanQuery = (code: string) =>
  queryOptions({
    queryKey: [...STOCK_CONSOLE_KEY, 'scan', code] as const,
    queryFn: () => stockConsoleApi.scan(code),
    enabled: code !== '',
    staleTime: 5 * 60_000,
    retry: retryUnlessAnswered,
  })

// ── Movements ───────────────────────────────────────────────────────────────────────────────────────
// A store's SAP movements (SAP read live, by its own button) and an item's ledger lines (our ledger, by its own button).
// Neither reads before its button nor for a window stopped in the browser (`windowRead`): `enabled` is that decision.

/** The window a decision reads ('' before the button or when stopped: the key of a query that never runs). */
const windowKey = (decision: WindowRead): DayWindow =>
  decision.kind === 'read' ? { from: decision.from, to: decision.to } : { from: '', to: '' }

/** The store's SAP movements for the window, read by Read SAP. Under the SAP tab's key: Refresh re-reads it (once read). */
export function sapMovementsQuery(store: string, decision: WindowRead) {
  const window = windowKey(decision)
  return queryOptions({
    queryKey: [...storeTabKey(store, 'sap'), window.from, window.to] as const,
    queryFn: () => stockConsoleApi.sapMovements(store, window),
    enabled: decision.kind === 'read',
    retry: retryUnlessAnswered,
  })
}

/** An opened SAP row's lines, a page at a time; read only while its window is read and a row is open. */
export function sapLinesQuery(store: string, decision: WindowRead, state: MovementsState) {
  const q = { day: state.sapDay, type: state.sapType, page: state.page, size: STOCK_CONSOLE_PAGE_SIZE }
  const linesKey = [...storeTabKey(store, 'sap'), 'lines'] as const
  return queryOptions({
    queryKey: [...linesKey, q.day, q.type, q.page] as const,
    queryFn: () => stockConsoleApi.sapLines(store, q),
    enabled: decision.kind === 'read' && q.day !== '' && q.type !== '',
    placeholderData: keepWhileSame(linesKey.length, [q.day, q.type]),
    retry: retryUnlessAnswered,
  })
}

/** The item's ledger lines for the window, read by Read, 25 a page. Under the Movements tab's key: Refresh re-reads it. */
export function itemMovementsQuery(store: string, item: string, decision: WindowRead, page: number) {
  const window = windowKey(decision)
  const tabKey = itemTabKey(store, item, 'movements')
  return queryOptions({
    queryKey: [...tabKey, window.from, window.to, page] as const,
    queryFn: () => stockConsoleApi.itemMovements(store, item, { ...window, page, size: STOCK_CONSOLE_PAGE_SIZE }),
    enabled: decision.kind === 'read',
    placeholderData: keepWhileSame(tabKey.length, [window.from, window.to]),
    retry: retryUnlessAnswered,
  })
}
