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

export type ItemActionKey =
  // 822: what every viewer of a visible item may do — run it (with its parameters, the cross-filter, fullscreen,
  // the table view, TV mode and the permalink) and export it. A runner gets these and nothing else.
  | 'run'
  | 'export'
  | 'create'
  | 'saveInPlace'
  | 'saveAsCopy'
  // 778: the tier's own actions (owners share, unshare and delete; curators certify, un-certify and delete).
  | 'share'
  | 'unshare'
  | 'certify'
  | 'certifyRevision'
  | 'uncertify'
  | 'delete'

/** The editor's primary save: a new item, in place, as a copy, or nothing (read only). */
export type SaveMode = 'create' | 'in-place' | 'copy' | 'read-only'

export interface ItemActions {
  save: SaveMode
  /** In the order the screen shows them. */
  actions: ItemActionKey[]
}

/**
 * Who is acting: the session's user and the `Analytics/Access` grants. 822 (spec 819 §C): `canAuthor` is the
 * builder's grant; without it the actor is a **runner**. Curate implies author.
 */
export interface ItemActor {
  userId: string | null
  canView: boolean
  canAuthor: boolean
  canCurate: boolean
}

/** What of an item decides its actions. `null` is an item not yet saved. */
export interface ItemStanding {
  owner: string
  tier: AnalyticsTier
  /**
   * 778: a Certified copy of this item already exists (an item whose `certifiedFrom` is this one), so a curator's
   * Certify writes this revision into it as one new revision (`certifyRevision`) rather than freezing a new copy.
   */
  certifiedCopy?: boolean
}

const READ_ONLY: ItemActions = { save: 'read-only', actions: [] }
/** 822: a runner's item — run and export, no edit, copy, Save as my copy, share or certify. */
const RUN_ONLY: ItemActions = { save: 'read-only', actions: ['run', 'export'] }

/** ⚠ User ids are compared without regard to case (UA ids are; BackOffice 3378 to confirm `owner`'s form). */
export const isOwner = (owner: string, userId: string | null) => !!userId && owner.toLowerCase() === userId.toLowerCase()

export function itemActions(item: ItemStanding | null, actor: ItemActor): ItemActions {
  if (!actor.canView) return READ_ONLY
  const author = actor.canAuthor || actor.canCurate
  if (!item) return author ? { save: 'create', actions: ['create'] } : READ_ONLY

  const owns = isOwner(item.owner, actor.userId)
  // Someone else's Personal item is not visible by the tier rule; if one is served anyway, nothing is offered.
  if (item.tier === 'personal' && !owns) return READ_ONLY
  if (!author) return RUN_ONLY

  const inPlace = item.tier === 'certified' ? actor.canCurate : owns
  const actions: ItemActionKey[] = ['run', 'export']
  if (inPlace) actions.push('saveInPlace')
  if (!inPlace || item.tier !== 'personal') actions.push('saveAsCopy')
  // 778: owners share and unshare their own (a Certified item is the curators'); curators certify a Personal or
  // Shared item, or a later revision of it into its certified copy, and un-certify a Certified one; an owner
  // deletes their own Personal or Shared item, a curator a Certified one.
  if (owns && item.tier === 'personal') actions.push('share')
  if (owns && item.tier === 'shared') actions.push('unshare')
  if (actor.canCurate && item.tier !== 'certified') actions.push(item.certifiedCopy ? 'certifyRevision' : 'certify')
  if (actor.canCurate && item.tier === 'certified') actions.push('uncertify')
  if (item.tier === 'certified' ? actor.canCurate : owns) actions.push('delete')
  return { save: inPlace ? 'in-place' : 'copy', actions }
}
