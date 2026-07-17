import { create } from 'zustand'

// Client-side mirror of the server-owned sis_session. The cookie is HttpOnly —
// the server's answer (Auth/Me, 401s) is the only truth; this store is display state.
interface SessionState {
  loaded: boolean // a successful Auth/Me or Auth/Login has hydrated this store
  userId: string | null
  displayName: string | null
  currentStoreCode: string | null
  setSession: (s: { userId?: string | null; displayName?: string | null; currentStoreCode?: string | null }) => void
  setCurrentStore: (storeCode: string) => void
  clear: () => void
}

export const useSession = create<SessionState>((set) => ({
  loaded: false,
  userId: null,
  displayName: null,
  currentStoreCode: null,
  setSession: (s) =>
    set((prev) => ({
      loaded: true,
      userId: s.userId ?? null,
      // Auth/Me carries no displayName — fall back to userId (AR-8)
      displayName: s.displayName ?? s.userId ?? prev.displayName,
      currentStoreCode: s.currentStoreCode ?? null,
    })),
  setCurrentStore: (storeCode) => set({ currentStoreCode: storeCode }),
  clear: () => set({ loaded: false, userId: null, displayName: null, currentStoreCode: null }),
}))

export function isAuthenticated(): boolean {
  return useSession.getState().userId !== null
}
