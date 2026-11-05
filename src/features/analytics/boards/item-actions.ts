import type { AnalyticsTier } from '@/core/models/analytics'

/**
 * Tier → actions (spec 766 §F "Saving follows the tiers", CONTEXT.md *Tier* / *Curator*; ticket 776). Pure,
 * kind-agnostic: a view and a board follow the same rules.
 *
 * - Personal: seen and edited by its owner only.
 * - Shared: seen by every analytics user, edited by its owner only; also offers an explicit copy.
 * - Certified: edited by curators only (its owner too needs the grant); also offers an explicit copy.
 * - Editing what you may not edit saves as your Personal copy and never changes the original.
 *
 * The server stays the judge: an in-place save it refuses with `ANALYTICS-403` still offers the copy
 * (`./item-save`). This only decides what is OFFERED.
 *
 * Extending (778: share, unshare, certify, uncertify, delete): add the key to `ItemActionKey` and one
 * `if` to `itemActions` pushing it; `save` stays the editor's primary save.
 */

export type ItemActionKey = 'create' | 'saveInPlace' | 'saveAsCopy'

/** The editor's primary save: a new item, in place, as a copy, or nothing (read only). */
export type SaveMode = 'create' | 'in-place' | 'copy' | 'read-only'

export interface ItemActions {
  save: SaveMode
  /** In the order the screen shows them. */
  actions: ItemActionKey[]
}

/** Who is acting: the session's user and the `Analytics/Access` grants. */
export interface ItemActor {
  userId: string | null
  canView: boolean
  canCurate: boolean
}

/** What of an item decides its actions. `null` is an item not yet saved. */
export interface ItemStanding {
  owner: string
  tier: AnalyticsTier
}

const READ_ONLY: ItemActions = { save: 'read-only', actions: [] }

/** ⚠ User ids are compared without regard to case (UA ids are; BackOffice 3378 to confirm `owner`'s form). */
export const isOwner = (owner: string, userId: string | null) => !!userId && owner.toLowerCase() === userId.toLowerCase()

export function itemActions(item: ItemStanding | null, actor: ItemActor): ItemActions {
  if (!actor.canView) return READ_ONLY
  if (!item) return { save: 'create', actions: ['create'] }

  const owns = isOwner(item.owner, actor.userId)
  // Someone else's Personal item is not visible by the tier rule; if one is served anyway, nothing is offered.
  if (item.tier === 'personal' && !owns) return READ_ONLY

  const inPlace = item.tier === 'certified' ? actor.canCurate : owns
  const actions: ItemActionKey[] = []
  if (inPlace) actions.push('saveInPlace')
  if (!inPlace || item.tier !== 'personal') actions.push('saveAsCopy')
  return { save: inPlace ? 'in-place' : 'copy', actions }
}
