import { create } from 'zustand'
import type { ColumnState, FilterModel } from 'ag-grid-community'
import type { OrderDocumentRow } from '@/core/models/order-document'
import type { LensId } from './lenses'
import { BLANK_QUERY, type QueryCriteria } from './query-model'

/**
 * Module-scoped store for the Order / ERX search, as the Deliveries list keeps its own: the page
 * is destroyed on a drill-down into Document details and re-created on return, so the criteria,
 * rows, layout, lens, view and selection live here for the browser session (in memory only).
 */
interface OrderSearchState {
  /** The last search that ran, as the bar held it — the Date still relative. */
  query: QueryCriteria | null
  /** The criteria on screen in the query bar, searched or not. */
  draft: QueryCriteria
  rows: OrderDocumentRow[] | null
  /** The Limit the loaded `rows` ran with: a page this long may have been cut. */
  limit: number | null
  error: string | null
  lens: LensId
  activeViewId: string | null
  columnState: ColumnState[] | null
  filterModel: FilterModel | null
  selectedKey: string | null
  setDraft: (draft: QueryCriteria) => void
  beginSearch: () => void
  setResult: (rows: OrderDocumentRow[], limit: number, query: QueryCriteria) => void
  setError: (message: string) => void
  captureGridState: (columnState: ColumnState[] | null, filterModel: FilterModel | null) => void
  setSelectedKey: (key: string | null) => void
  setLens: (lens: LensId) => void
  setActiveView: (id: string | null) => void
}

export const useOrderSearch = create<OrderSearchState>((set) => ({
  query: null,
  draft: BLANK_QUERY,
  rows: null,
  limit: null,
  error: null,
  lens: 'all',
  activeViewId: null,
  columnState: null,
  filterModel: null,
  selectedKey: null,
  setDraft: (draft) => set({ draft }),
  /** Clear the previous error and selection; the prior rows stay on screen while it runs. */
  beginSearch: () => set({ error: null, selectedKey: null }),
  setResult: (rows, limit, query) => set({ rows, limit, query, error: null }),
  setError: (message) => set({ error: message }),
  captureGridState: (columnState, filterModel) => set({ columnState, filterModel }),
  setSelectedKey: (selectedKey) => set({ selectedKey }),
  setLens: (lens) => set({ lens }),
  setActiveView: (activeViewId) => set({ activeViewId }),
}))

/** A row's identity: the document number is the order's own and unique in the list. */
export const orderRowKey = (row: OrderDocumentRow): string => row.documentNo ?? ''
