/**
 * The acting store, held still while an engine session owns it.
 *
 * 🚩 **The acting store is the pricing plant** (Nphies contract law 8): it is
 * bound once at `Open`, immutable for the life of the transaction, invisible in
 * the NPHIES payload and decisive in every amount in it. So the plant must be
 * resolved *before the first item* — and a screen that let the agent change their
 * acting store mid-request would leave them looking at a switcher that says one
 * store while the engine prices at another. There is no verb to move it and there
 * is not going to be one (§2.2: the plant is on the *out* list).
 *
 * The switcher is `features/auth/StoreSwitcher`, in the app shell, and the
 * session that binds the store is a feature screen — so the lock lives here,
 * where both may read it (`features/auth` → `core/` is allowed; feature → feature
 * is not). It is a **flag, not a message**: what the lock is FOR is a sentence in
 * whichever namespace draws the control, and `core/` holds no user-visible text.
 *
 * 🚩 It is deliberately not "the store the session bound". The switcher does not
 * need to know which store — it is already showing it — it needs to know that the
 * answer is no longer the agent's to give.
 */
import { create } from 'zustand'

interface StoreLockState {
  /** How many live engine sessions are holding the acting store. A count rather
   *  than a boolean so two screens (a second tab is a second document, but a
   *  second *mount* is not) cannot unlock each other's session by releasing
   *  first — the last release is what frees it. */
  holders: number
  /** Take the lock; the returned function releases exactly this hold, once.
   *  Shaped for a `useEffect` cleanup, which is the only place it is used. */
  hold: () => () => void
}

export const useStoreLock = create<StoreLockState>((set) => ({
  holders: 0,
  hold: () => {
    set((prev) => ({ holders: prev.holders + 1 }))
    let released = false
    return () => {
      if (released) return
      released = true
      set((prev) => ({ holders: Math.max(0, prev.holders - 1) }))
    }
  },
}))
