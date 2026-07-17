import { create } from 'zustand'
import type { ColumnState, FilterModel } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import type { DeliveryFilterCriteria } from './filter'

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
  criteria: DeliveryFilterCriteria | null
  rows: DeliveryDocumentModel[] | null
  error: string | null
  columnState: ColumnState[] | null
  filterModel: FilterModel | null
  selectedKey: string | null
  beginSearch: (criteria: DeliveryFilterCriteria) => void
  setResult: (rows: DeliveryDocumentModel[]) => void
  setError: (message: string) => void
  captureGridState: (columnState: ColumnState[], filterModel: FilterModel) => void
  setSelectedKey: (key: string | null) => void
}

export const useDeliverySearch = create<DeliverySearchState>((set) => ({
  criteria: null,
  rows: null,
  error: null,
  columnState: null,
  filterModel: null,
  selectedKey: null,
  /**
   * Record the start of a search: remember the criteria, clear the previous
   * error and selection. Rows are left untouched so the grid keeps showing the
   * prior results while the new search runs.
   */
  beginSearch: (criteria) => set({ criteria, error: null, selectedKey: null }),
  setResult: (rows) => set({ rows, error: null }),
  setError: (message) => set({ error: message }),
  captureGridState: (columnState, filterModel) => set({ columnState, filterModel }),
  setSelectedKey: (selectedKey) => set({ selectedKey }),
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
