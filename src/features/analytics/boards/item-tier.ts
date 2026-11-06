import { apiErrorCode } from '@/core/api'
import type { AnalyticsItem } from '@/core/models/analytics'
import type { ItemActionKey } from './item-actions'

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
