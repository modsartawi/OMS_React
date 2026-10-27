/**
 * Re-reading a row under an open dialog (review of BackOffice spec 3148). Every edit dialog sends the row it built its
 * draft from (the BASE) as the save's before-state; the server refuses a before-state someone else's save has moved
 * (`SDC-00004`) and the screen re-reads the row. If the dialog then kept its old draft against the fresh row, the next
 * save would send fresh before + stale after and silently overwrite the other change. So when the loaded row stops
 * equalling the base, the draft is REBUILT from the fresh row and the dialog says the edits must be re-applied.
 * Pure: no React, no `t`.
 */

type Flat = Record<string, unknown>

const norm = (v: unknown) => (typeof v === 'string' ? v.trim() : v ?? '')

/** Two flat rows hold the same values (strings trimmed, a missing field reads as blank only when both lack it). */
export function sameRow<T extends object>(a: T | null | undefined, b: T | null | undefined): boolean {
  if (!a || !b) return !a && !b
  const x = a as Flat
  const y = b as Flat
  const keys = new Set([...Object.keys(x), ...Object.keys(y)])
  for (const k of keys) {
    if (!(k in x) || !(k in y)) return false
    if (norm(x[k]) !== norm(y[k])) return false
  }
  return true
}

export interface DraftOnBase<T> {
  /** The row the draft was built from — the save's before-state. */
  base: T
  draft: T
}

export interface RebasedDraft<T> extends DraftOnBase<T> {
  /** The row was re-read and differed: the consultant's edits were dropped and must be made again. */
  reread: boolean
}

/** The draft rebuilt on a re-read row, or null when the loaded row still equals the base (keep the draft). */
export function rebaseDraft<T extends object>(current: DraftOnBase<T>, loaded: T, start: (row: T) => T = (r) => r): RebasedDraft<T> | null {
  if (sameRow(current.base, loaded)) return null
  return { base: loaded, draft: start(loaded), reread: true }
}
