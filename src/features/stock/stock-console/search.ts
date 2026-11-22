/**
 * The search-first list frame's state (oms 941, BackOffice spec 4157 "The search-first rule") — pure, so what a list
 * asks and when is pinned by tests. Shared by every list of the console: a store's Items and Batches (941), Holds and
 * Takes (942), Find (943), and the GS1 box (944).
 *
 * A list reads nothing until a search ran. Search (or Enter in a box) writes the boxes, trimmed, with `ran` and page 1;
 * empty boxes list the whole view. The address carries the boxes, the filter, the sort, the page and `ran`, so a
 * shared link shows the same rows — and opening one that says a search ran counts as asking. Clear empties it all.
 *
 * Each list states what it owns in a `ListSpec`: its filters (the first is the default), its sorts (none: no sort),
 * its own further params (Takes' `day`), and the page's params it leaves alone (the store page's `tab`).
 */

/** Rows a page, fixed, not in the address (spec 4157: "25 rows a page"). */
export const STOCK_CONSOLE_PAGE_SIZE = 25

/** What a list owns in the address. Pass a module-level constant: `listUrl(spec)` must stay the same pair. */
export interface ListSpec {
  /** The filter's values as the wire names them; the first is the default and is left out of the address. */
  filters: readonly string[]
  /** The sort's values; the first is the default. Absent: the list has no sort and sends none. */
  sorts?: readonly string[]
  /**
   * Further params the list owns, kept as strings ('' = absent), cleared by Clear and set by Search — e.g. Takes'
   * `day` (942). They go to the wire as they are.
   */
  extras?: readonly string[]
  /** The page's params the list carries untouched, and Clear keeps (the store page's `tab`; Find's open item, 943). */
  keep?: readonly string[]
}

/** The three boxes. The GS1 box is drawn by ticket 944; the state carries it from the start. */
export interface SearchBoxes {
  item: string
  batch: string
  gs1: string
}

export interface SearchState extends SearchBoxes {
  filter: string
  /** '' when the list has no sort. */
  sort: string
  /** 1-based. */
  page: number
  /** A search ran: the list reads. */
  ran: boolean
  /** The spec's `extras`, by name; '' = absent. */
  extras: Record<string, string>
  /** The spec's `keep` params found in the address, carried untouched. */
  kept: Record<string, string>
}

export const emptyBoxes = (): SearchBoxes => ({ item: '', batch: '', gs1: '' })

const pick = (value: string | null, allowed: readonly string[] | undefined): string =>
  !allowed || allowed.length === 0 ? '' : value !== null && allowed.includes(value) ? value : allowed[0]

const named = (params: URLSearchParams, names: readonly string[] | undefined, trim: boolean): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const n of names ?? []) {
    const v = params.get(n)
    if (v !== null && (trim ? v.trim() : v) !== '') out[n] = trim ? v.trim() : v
  }
  return out
}

/** The list's state as the address says it. An unknown filter or sort falls back to the default; a bad page to 1. */
export function searchFromParams(params: URLSearchParams, spec: ListSpec): SearchState {
  const page = Number.parseInt(params.get('page') ?? '', 10)
  return {
    item: (params.get('item') ?? '').trim(),
    batch: (params.get('batch') ?? '').trim(),
    gs1: (params.get('gs1') ?? '').trim(),
    filter: pick(params.get('filter'), spec.filters),
    sort: pick(params.get('sort'), spec.sorts),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    ran: params.get('ran') === '1',
    extras: named(params, spec.extras, true),
    kept: named(params, spec.keep, false),
  }
}

/**
 * The list's state as the address writes it: the kept params first, then the boxes, the filter and the sort when not
 * the default, the extras, the page past the first, and `ran=1`. Anything else in the address is dropped — a list's
 * address is its own.
 */
export function searchToParams(state: SearchState, spec: ListSpec): URLSearchParams {
  const out = new URLSearchParams()
  for (const n of spec.keep ?? []) if (state.kept[n]) out.set(n, state.kept[n])
  if (state.item) out.set('item', state.item)
  if (state.batch) out.set('batch', state.batch)
  if (state.gs1) out.set('gs1', state.gs1)
  if (state.filter && state.filter !== spec.filters[0]) out.set('filter', state.filter)
  if (state.sort && spec.sorts && state.sort !== spec.sorts[0]) out.set('sort', state.sort)
  for (const n of spec.extras ?? []) if (state.extras[n]) out.set(n, state.extras[n])
  if (state.page > 1) out.set('page', String(state.page))
  if (state.ran) out.set('ran', '1')
  return out
}

export interface ListUrl {
  fromParams: (params: URLSearchParams) => SearchState
  toParams: (state: SearchState) => URLSearchParams
}

const urls = new WeakMap<ListSpec, ListUrl>()

/** The list's address pair for `useUrlQuery`, one per spec — the hook needs the same two functions every render. */
export function listUrl(spec: ListSpec): ListUrl {
  let pair = urls.get(spec)
  if (!pair) {
    pair = { fromParams: (p) => searchFromParams(p, spec), toParams: (s) => searchToParams(s, spec) }
    urls.set(spec, pair)
  }
  return pair
}

/**
 * A new filter or sort. They are not drafts: they go to the address at once. After a search the list reads again,
 * from page 1; before one, nothing is read. A value the spec does not name is ignored.
 */
export function choose(state: SearchState, change: { filter?: string; sort?: string }, spec: ListSpec): SearchState {
  const filter = change.filter !== undefined && spec.filters.includes(change.filter) ? change.filter : state.filter
  const sort = change.sort !== undefined && spec.sorts?.includes(change.sort) === true ? change.sort : state.sort
  if (filter === state.filter && sort === state.sort) return state
  return { ...state, filter, sort, page: 1 }
}

/** The pager: another page of the same search. */
export const goToPage = (state: SearchState, page: number): SearchState => ({
  ...state,
  page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
})

/**
 * Whether a Search writes the address already shown. The address would not change, so nothing would read: the frame
 * re-reads instead, so "busy, try again" can be tried again.
 */
export const sameSearch = (shown: SearchState, next: SearchState, spec: ListSpec): boolean =>
  searchToParams(shown, spec).toString() === searchToParams(next, spec).toString()

/** Clear: the boxes, the filter, the sort, the page, the extras and `ran` go; the kept params stay. Nothing is read. */
export const clearSearch = (state: SearchState, spec: ListSpec): SearchState =>
  searchFromParams(new URLSearchParams(Object.entries(state.kept)), spec)

/** What the frame draws: nothing read yet, the first read in flight, the refusal, the empty sentence, or the rows. */
export type FrameView = 'nothing' | 'loading' | 'refused' | 'empty' | 'rows'

/** The part of a list's query the frame looks at (a TanStack Query result fits). */
export interface FrameRead {
  isPending: boolean
  isError: boolean
  data: { total: number } | undefined
}

/** A failed read draws no rows — kept rows under a refusal would pass for the answer (sync console's 🚩). */
export function frameView(state: SearchState, read: FrameRead): FrameView {
  if (!shouldRead(state)) return 'nothing'
  if (read.isError) return 'refused'
  if (!read.data) return 'loading'
  return read.data.total > 0 ? 'rows' : 'empty'
}

/** Whether the list reads: only once a search ran (the search-first rule). */
export const shouldRead = (state: SearchState): boolean => state.ran

/**
 * Search (or Enter in a box): the boxes, trimmed, become the search; page 1; `ran`. Extras given here (Takes' day) are
 * set with them. The filter and the sort are the state's own — they are not drafts.
 */
export function submitSearch(state: SearchState, boxes: SearchBoxes, extras: Record<string, string> = {}): SearchState {
  const nextExtras = { ...state.extras }
  for (const [k, v] of Object.entries(extras)) {
    if (v.trim() === '') delete nextExtras[k]
    else nextExtras[k] = v.trim()
  }
  return {
    ...state,
    item: boxes.item.trim(),
    batch: boxes.batch.trim(),
    gs1: boxes.gs1.trim(),
    page: 1,
    ran: true,
    extras: nextExtras,
  }
}

/** What a list sends: the item and batch boxes, the filter, the sort (when it has one), the extras, the page. The GS1
 *  box is not sent: ticket 944 reads the code first and searches what it found (pass its boxes instead). */
export interface WireSearch {
  item: string
  batch: string
  filter: string
  sort?: string
  page: number
  size: number
  [extra: string]: string | number | undefined
}

export function wireParams(state: SearchState): WireSearch {
  return {
    item: state.item,
    batch: state.batch,
    filter: state.filter,
    ...(state.sort !== '' ? { sort: state.sort } : {}),
    ...state.extras,
    page: state.page,
    size: STOCK_CONSOLE_PAGE_SIZE,
  }
}
