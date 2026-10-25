/**
 * What a refused batch add reads as in the add-stores dialog (oms ticket 569; BackOffice spec 3042, door 3045).
 * Pure: no React, no `t` — the dialog turns `labelKey` into words.
 *
 * One bad code refuses the WHOLE batch and nothing is added. `SVL-00002` (unknown) and `SVL-00003` (already a
 * member) name the codes in `ApiError.data.badStoreCodes`, in the request's spelling, trimmed; the door checks
 * unknown codes first, so a basket with both kinds takes two rounds. `data` is read defensively: missing or of
 * the wrong shape, the dialog shows the server's message instead of highlights.
 */
import { ApiError, apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { SERVING_LIST_ERRORS as E } from '@/core/models/serving-list'

const REFUSAL_LABEL: Record<string, string> = {
  [E.UnknownList]: 'addStores.refusal.unknownList',
  [E.UnknownStore]: 'addStores.refusal.unknownStores',
  [E.AlreadyMember]: 'addStores.refusal.alreadyMembers',
  [E.StoreCodesRequired]: 'addStores.refusal.noCodes',
}

/** The two refusals that name codes. */
const NAMES_CODES: readonly string[] = [E.UnknownStore, E.AlreadyMember]

export type AddStoresRefusal =
  /** A bare 403: Execute 06 is not held. */
  | { kind: 'notGranted' }
  /** `SVL-00002` / `SVL-00003` naming the codes: highlight them in the basket, offer "Remove these and retry". */
  | { kind: 'badCodes'; code: string; labelKey: string; codes: string[]; message: string }
  /** Any other coded refusal (or a code-naming one whose `data` was unreadable): words by code, server text kept. */
  | { kind: 'refused'; code: string; labelKey: string | null; message: string }
  /** No code: the taxonomy's network / server line, or a crash (`message` `''`). */
  | { kind: 'failed'; message: string }

/** `data.badStoreCodes` when it is a non-empty list of strings, else null. */
function badStoreCodes(err: unknown): string[] | null {
  const data = err instanceof ApiError ? err.data : null
  if (!data || typeof data !== 'object') return null
  const codes = (data as { badStoreCodes?: unknown }).badStoreCodes
  return Array.isArray(codes) && codes.length > 0 && codes.every((c) => typeof c === 'string') ? codes : null
}

export function addStoresRefusal(err: unknown): AddStoresRefusal {
  if (isBareDenial(err)) return { kind: 'notGranted' }
  const message = apiErrorMessage(err, '')
  const code = apiErrorCode(err)
  if (!code) return { kind: 'failed', message }
  const labelKey = REFUSAL_LABEL[code] ?? null
  const codes = NAMES_CODES.includes(code) ? badStoreCodes(err) : null
  if (codes && labelKey) return { kind: 'badCodes', code, labelKey, codes, message }
  return { kind: 'refused', code, labelKey, message }
}

/** Whether a basket code is one the door refused — case-insensitively, as the door de-dups. */
export function isBadCode(refusedCodes: readonly string[], code: string): boolean {
  const k = code.trim().toUpperCase()
  return refusedCodes.some((c) => c.trim().toUpperCase() === k)
}
