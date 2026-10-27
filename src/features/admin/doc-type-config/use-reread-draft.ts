import { useState } from 'react'
import { rebaseDraft } from './reread'

/**
 * A dialog's draft on its base row (`reread.ts`). A fresh opening starts from `loaded`; while open, a re-read `loaded`
 * that differs from the base rebuilds the draft from it and raises `reread` (the dialog tells the consultant to make
 * the change again). The save sends `base` as its before-state. `track: false` (a copy, which sends no before-state)
 * keeps the draft whatever the source does. Adjusted while rendering, before paint.
 */
export function useReReadDraft<T extends object>(
  open: boolean,
  loaded: T,
  { start = (r: T) => r, track = true }: { start?: (row: T) => T; track?: boolean } = {},
) {
  const [s, setS] = useState(() => ({ open, base: loaded, draft: start(loaded), reread: false }))
  let state = s
  if (s.open !== open) {
    state = { open, base: loaded, draft: start(loaded), reread: false }
    setS(state)
  } else if (open && track) {
    const next = rebaseDraft(s, loaded, start)
    if (next) {
      state = { open, ...next }
      setS(state)
    }
  }
  const setDraft = (update: (draft: T) => T) => setS((p) => ({ ...p, draft: update(p.draft), reread: false }))
  return { base: state.base, draft: state.draft, reread: state.reread, setDraft }
}
