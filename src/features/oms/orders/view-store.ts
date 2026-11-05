import { create } from 'zustand'
import type { ViewStorage } from '@/core/list/saved-view-store'
import { EMPTY_VIEW_STORE, readViewStore, writeViewStore, type ViewStore } from './saved-views'

/**
 * The signed-in user's saved views of the Order / ERX list, held for the page — the thin edge over
 * `localStorage` that the pure `saved-views.ts` keeps out of its suite. A storage that refuses a
 * write is swallowed: the views still work for this session.
 */
interface SavedViewsState {
  loadedFor: string | null | undefined
  store: ViewStore
  load: (userId: string | null) => void
  commit: (store: ViewStore) => void
}

function browserStorage(): ViewStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const useOrderViews = create<SavedViewsState>((set, get) => ({
  loadedFor: undefined,
  store: EMPTY_VIEW_STORE,
  load: (userId) => {
    if (get().loadedFor === userId) return
    const storage = browserStorage()
    set({ loadedFor: userId, store: storage ? readViewStore(storage, userId) : EMPTY_VIEW_STORE })
  },
  commit: (store) => {
    const storage = browserStorage()
    if (storage) writeViewStore(storage, get().loadedFor, store)
    set({ store })
  },
}))
