/**
 * What a refused batch add reads as in the add-stores dialog (oms ticket 569; BackOffice spec 3042, door 3045):
 * the shared `./refusal` skeleton, plus the codes a refusal names. Pure: no React, no `t`.
 *
 * One bad code refuses the WHOLE batch and nothing is added. `SVL-00002` (unknown) and `SVL-00003` (already a
 * member) name the codes in `ApiError.data.badStoreCodes`, in the request's spelling, trimmed; the door checks
 * unknown codes first, so a basket with both kinds takes two rounds. `data` is read defensively: missing or of
 * the wrong shape, the dialog shows the server's message instead of highlights.
 */
import { ApiError } from '@/core/api'
import { SERVING_LIST_ERRORS as E } from '@/core/models/serving-list'
import { refusalOf, type Refusal, type RefusalMap } from './refusal'

const MAP: RefusalMap = {
  labels: {
    [E.UnknownList]: 'addStores.refusal.unknownList',
    [E.UnknownStore]: 'addStores.refusal.unknownStores',
    [E.AlreadyMember]: 'addStores.refusal.alreadyMembers',
    [E.StoreCodesRequired]: 'addStores.refusal.noCodes',
  },
  /** The list is gone, or a code is already on it: the screen's Lists / Members / Changes are behind. */
  stale: new Set<string>([E.UnknownList, E.AlreadyMember]),
}

/** The two refusals that name codes. */
const NAMES_CODES: readonly string[] = [E.UnknownStore, E.AlreadyMember]

export type AddStoresRefusal =
  | Refusal
  /** `SVL-00002` / `SVL-00003` naming the codes: highlight them in the basket, offer "Remove these and retry". */
  | { kind: 'badCodes'; code: string; labelKey: string; codes: string[]; message: string; stale: boolean }

/** `data.badStoreCodes` when it is a non-empty list of strings, else null. */
function badStoreCodes(err: unknown): string[] | null {
  const data = err instanceof ApiError ? err.data : null
  if (!data || typeof data !== 'object') return null
  const codes = (data as { badStoreCodes?: unknown }).badStoreCodes
  return Array.isArray(codes) && codes.length > 0 && codes.every((c) => typeof c === 'string') ? codes : null
}

export function addStoresRefusal(err: unknown): AddStoresRefusal {
  const r = refusalOf(err, MAP)
  if (r.kind !== 'refused' || !r.labelKey || !NAMES_CODES.includes(r.code)) return r
  const codes = badStoreCodes(err)
  return codes ? { ...r, kind: 'badCodes', labelKey: r.labelKey, codes } : r
}

/** Whether a basket code is one the door refused — case-insensitively, as the door de-dups. */
export function isBadCode(refusedCodes: readonly string[], code: string): boolean {
  const k = code.trim().toUpperCase()
  return refusedCodes.some((c) => c.trim().toUpperCase() === k)
}
