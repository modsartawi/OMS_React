/**
 * The palette's member lookup (ticket 427) — the one-shot router state that carries a
 * typed key from the app-wide palette's *Open loyalty member N* row to this page.
 *
 * The palette only navigates; this page resolves. The key is handed over exactly as the
 * agent typed it (Arabic digits folded to ASCII, nothing else), and the page runs it
 * through the same `resolveMember` mutation a typed submit uses — so the cascade, the
 * miss sentence and every refusal stay in one place.
 *
 * It lives in the feature, not `@/core`: `layout/` (the sender) may import a feature,
 * and this page is the only consumer — `open-intent` graduated because two FEATURES
 * shared it, which is not the case here.
 *
 * 🚩 **Router state, never a URL param**, and the page replaces it away as soon as it
 * reads it: a mobile number is a customer's, so it must not reach the history, a server
 * log or a pasted link, and a reload or a Back must not re-run the lookup.
 */
import { foldDigits } from '@/core/commands/palette-model'
import { compact } from './resolve-member'

/** The router state the palette navigates to `/loy/members` with. */
export interface MemberLookupState {
  lookup: string
}

/**
 * The key a palette query names, or `null`. A key is text that the field's own
 * compaction leaves wholly digits — loyalty ids are digits only, and a mobile arrives
 * as `+966 55 …` or `055-…` as often as bare. 🚩 This says *is it a key at all*, never
 * *which* key: that is `resolveMember`'s cascade (decision 225, no shape rule).
 */
export function memberLookupKeyOf(query: string): string | null {
  const typed = foldDigits(query.trim())
  return /^\d+$/.test(compact(typed)) ? typed : null
}

export function memberLookupState(typed: string): MemberLookupState {
  return { lookup: typed }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The key a history entry carries, read defensively: anything but a non-blank string is none. */
export function memberLookupOf(state: unknown): string | null {
  if (!isRecord(state) || typeof state.lookup !== 'string') return null
  return state.lookup.trim() ? state.lookup : null
}

/**
 * The router state with the lookup taken out and the rest kept — what the page replaces
 * the entry with. `null` when nothing else was there; the same value when there was no lookup.
 */
export function withoutMemberLookup(state: unknown): unknown {
  if (!isRecord(state) || !('lookup' in state)) return state ?? null
  const { lookup: _lookup, ...rest } = state
  return Object.keys(rest).length > 0 ? rest : null
}
