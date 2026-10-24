import { create } from 'zustand'

/**
 * Whether this page visit has met a bare 403 on the write-off door (ticket 548). No probe exists for
 * `PrescriptionSessionWriteOff,06`, so "Close without invoice" shows on every DISPENSED row until a
 * POST is refused bare; from then on every row's button hides until the Open tab unmounts.
 */
interface WriteOffGrantState {
  notGranted: boolean
  deny: () => void
  reset: () => void
}

export const useWriteOffGrant = create<WriteOffGrantState>((set) => ({
  notGranted: false,
  deny: () => set({ notGranted: true }),
  reset: () => set({ notGranted: false }),
}))
