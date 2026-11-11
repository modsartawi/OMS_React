import { apiErrorCode, apiErrorData } from '@/core/api'
import type { AnalyticsItem, AnalyticsUsedBy } from '@/core/models/analytics'
import type { ItemActionKey } from './item-actions'
import { readUsedBy } from './wire'

/**
 * The tier's own actions on an item's header (ticket 778) — pure. `./item-actions` decides what is offered; the
 * editor keeps its saves (`saveInPlace`, `saveAsCopy`, `create`), the view and board headers show these.
 */
export type TierActionKey = Extract<ItemActionKey, 'share' | 'unshare' | 'narrow' | 'reassign' | 'certify' | 'certifyRevision' | 'uncertify' | 'delete'>

const TIER_ACTION_KEYS: ReadonlySet<ItemActionKey> = new Set<TierActionKey>(['share', 'unshare', 'narrow', 'reassign', 'certify', 'certifyRevision', 'uncertify', 'delete'])

export const tierActionsOf = (actions: readonly ItemActionKey[]): TierActionKey[] =>
  actions.filter((a): a is TierActionKey => TIER_ACTION_KEYS.has(a))

/**
 * The Certified copy of `id`: the Certified item whose `certifiedFrom` names it (§C, 755 item 14). ⚠ The item does
 * not say it has one, so the screen finds it in `Analytics/Items`; `null` while that list has not landed.
 */
export function certifiedCopyOf(items: readonly Pick<AnalyticsItem, 'id' | 'tier' | 'certifiedFrom'>[] | undefined, id: string) {
  return items?.find((it) => it.tier === 'certified' && it.certifiedFrom === id) ?? null
}

/** `ANALYTICS-402` "needs the curator grant": a stale probe offered a curator's action. */
export const needsCurator = (err: unknown): boolean => apiErrorCode(err) === 'ANALYTICS-402'

/**
 * 3631 review (BackOffice 3666): `ANALYTICS-419` "a personal schedule sends this report" — its delete is refused; the
 * schedule (and the report made for it) is deleted in My schedules.
 */
export const personalReportScheduled = (err: unknown): boolean => apiErrorCode(err) === 'ANALYTICS-419'

/**
 * 837 (BackOffice 3432 §2): `ANALYTICS-416` "view in use" — the view is linked by a live board that is Certified or
 * not the caller's own. The refusal's `data` is `UsedBy`'s `{ boards, hidden }`; `null` for any other failure.
 */
export function viewInUse(err: unknown): AnalyticsUsedBy | null {
  return apiErrorCode(err) === 'ANALYTICS-416' ? readUsedBy(apiErrorData(err)) : null
}

/**
 * 837: whether the server will refuse this view's delete, by 3432's rule — any linking board Certified or not mine,
 * and any board I cannot open (`hidden`) counts as not mine. Only what is OFFERED: the server stays the judge (416).
 */
export const viewDeleteBlocked = (u: AnalyticsUsedBy): boolean => u.hidden > 0 || u.boards.some((b) => b.tier === 'certified' || !b.mine)
