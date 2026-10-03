import { create } from 'zustand'
import { EMPTY_VIEW_STORE, readViewStore, writeViewStore, type ViewStorage, type ViewStore } from './saved-views'

/**
 * The signed-in user's saved views (ticket 400), held for the page — the thin edge over
 * `localStorage` that the pure `saved-views.ts` keeps out of its suite.
 *
 * `load` reads one user's store (importing the old shared layouts on that user's first read) and
 * `commit` writes the next one. A storage that refuses a write is swallowed: the views still work
 * for this session, as the old layout store's did.
 */
interface SavedViewsState {
  /** The user the store was read for; `undefined` until the page has loaded one. */
  loadedFor: string | null | undefined
  store: ViewStore
  load: (userId: string | null) => void
  commit: (store: ViewStore) => void
}

/** The browser's `localStorage`, or `null` where touching it throws. */
function browserStorage(): ViewStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const useSavedViews = create<SavedViewsState>((set, get) => ({
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
