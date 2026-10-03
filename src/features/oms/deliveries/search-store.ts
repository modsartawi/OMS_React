import { create } from 'zustand'
import type { ColumnState, FilterModel } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import type { LensId } from './lenses'
import { BLANK_QUERY, type QueryCriteria } from './query-model'

/**
 * Module-scoped store for the Screen 1 search (D-24 / R-8).
 *
 * The page component is destroyed whenever the operator drills into Document
 * Details (Screen 2) and re-created empty on return — losing the criteria, the
 * rows, the working grid layout and the selection. That breaks the core
 * search → open → back → open-next triage loop the WPF original kept intact (it
 * opened Screen 2 in a separate maximised window, leaving the inquiry alone).
 *
 * Living outside the route tree keeps the state alive for the browser session;
 * it is in-memory only, so a full page reload starts fresh.
 */
interface DeliverySearchState {
  /**
   * The last search that ran, as the query bar held it — the Date still relative (399). The
   * bar's unapplied edits are measured against it, and Discard goes back to it.
   */
  query: QueryCriteria | null
  /** The criteria on screen in the query bar, searched or not. */
  draft: QueryCriteria
  rows: DeliveryDocumentModel[] | null
  /** The Limit the loaded `rows` ran with: a page this long may have been cut (366). */
  limit: number | null
  error: string | null
  /** The active lens (398): it narrows the loaded rows and survives a drill-down too. */
  lens: LensId
  columnState: ColumnState[] | null
  filterModel: FilterModel | null
  selectedKey: string | null
  setDraft: (draft: QueryCriteria) => void
  beginSearch: () => void
  setResult: (rows: DeliveryDocumentModel[], limit: number, query: QueryCriteria) => void
  setError: (message: string) => void
  captureGridState: (columnState: ColumnState[], filterModel: FilterModel) => void
  setSelectedKey: (key: string | null) => void
  setLens: (lens: LensId) => void
}

export const useDeliverySearch = create<DeliverySearchState>((set) => ({
  query: null,
  draft: BLANK_QUERY,
  rows: null,
  limit: null,
  error: null,
  lens: 'all',
  columnState: null,
  filterModel: null,
  selectedKey: null,
  setDraft: (draft) => set({ draft }),
  /**
   * Record the start of a search: clear the previous error and selection. Rows are left
   * untouched so the grid keeps showing the prior results while the new search runs.
   */
  beginSearch: () => set({ error: null, selectedKey: null }),
  /**
   * The search came back: its rows, the Limit it ran with, and its query, which the bar's flags
   * now measure against. A failed search records no query, so its edits stay flagged.
   */
  setResult: (rows, limit, query) => set({ rows, limit, query, error: null }),
  setError: (message) => set({ error: message }),
  captureGridState: (columnState, filterModel) => set({ columnState, filterModel }),
  setSelectedKey: (selectedKey) => set({ selectedKey }),
  setLens: (lens) => set({ lens }),
}))

/**
 * A stable identity for a result row, used to re-select the row the operator
 * opened on Screen 2 once they return.
 *
 * `deliveryNo` alone is not unique — an order with no delivery carries it blank
 * — so the document number is folded in. OMS document and delivery numbers are
 * numeric strings, so a `|` separator cannot collide with their content.
 */
export function deliveryRowKey(row: DeliveryDocumentModel): string {
  return `${row.documentNo ?? ''}|${row.deliveryNo ?? ''}`
}
