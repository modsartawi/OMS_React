import { create } from 'zustand'
import type { ColumnState, FilterModel } from 'ag-grid-community'

/**
 * A user-named, reloadable Screen 1 grid layout (D-5).
 *
 * Captures everything that makes a "custom view": column order, width,
 * visibility, pinning and sort (all in {@link columnState}), plus the active
 * per-column filters ({@link filterModel}).
 */
export interface SavedGridView {
  id: string
  name: string
  columnState: ColumnState[]
  filterModel: FilterModel
}

/**
 * localStorage key. Deliberately the Angular prototype's key: the two apps may
 * run side-by-side during the transition and the captured shape is identical,
 * so an operator's saved views carry over for free (403 §8.3).
 */
const STORAGE_KEY = 'oms-web.delivery-grid-views'

/** Read and validate the persisted views; a corrupt/absent store yields []. */
function readViews(): SavedGridView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSavedView) : []
  } catch {
    return []
  }
}

function isSavedView(value: unknown): value is SavedGridView {
  const view = value as Partial<SavedGridView> | null
  return (
    !!view &&
    typeof view.id === 'string' &&
    typeof view.name === 'string' &&
    Array.isArray(view.columnState) &&
    typeof view.filterModel === 'object' &&
    view.filterModel !== null
  )
}

/** Short, collision-resistant id without relying on `crypto`. */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function persist(views: SavedGridView[]): SavedGridView[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    // Storage unavailable or full — the views still work for this session.
  }
  return views
}

interface GridViewsState {
  views: SavedGridView[]
  add: (name: string, columnState: ColumnState[], filterModel: FilterModel) => SavedGridView
  update: (id: string, columnState: ColumnState[], filterModel: FilterModel) => void
  remove: (id: string) => void
}

/**
 * Named Screen 1 grid views in localStorage (D-5). No server endpoint exists for
 * saved views, so v1 persistence is browser-local; backend-synced views are a
 * deferred enhancement. No rename, no default view — parity with the prototype.
 */
export const useGridViews = create<GridViewsState>((set, get) => ({
  views: readViews(),
  add: (name, columnState, filterModel) => {
    const view: SavedGridView = { id: generateId(), name: name.trim(), columnState, filterModel }
    set({ views: persist([...get().views, view]) })
    return view
  },
  update: (id, columnState, filterModel) =>
    set({
      views: persist(get().views.map((v) => (v.id === id ? { ...v, columnState, filterModel } : v))),
    }),
  remove: (id) => set({ views: persist(get().views.filter((v) => v.id !== id)) }),
}))
