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
  // 826 (spec 819 §C): a curator narrows a Shared item's audience (or unshares it, in the same dialog), and hands
  // an item to another author.
  | 'narrow'
  | 'reassign'
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
  // 826: the owner shares a Personal item with an audience, or changes a Shared one's (`./audience`).
  const sharing = shareActions(item, actor)
  if (sharing.includes('share')) actions.push('share')
  if (owns && item.tier === 'shared') actions.push('unshare')
  if (sharing.includes('narrow')) actions.push('narrow')
  if (sharing.includes('reassign')) actions.push('reassign')
  if (actor.canCurate && item.tier !== 'certified') actions.push(item.certifiedCopy ? 'certifyRevision' : 'certify')
  if (actor.canCurate && item.tier === 'certified') actions.push('uncertify')
  if (item.tier === 'certified' ? actor.canCurate : owns) actions.push('delete')
  return { save: inPlace ? 'in-place' : 'copy', actions }
}

/** 826: the audience's actions — the owner's share, a curator's narrow and reassign. */
export type ShareActionKey = Extract<ItemActionKey, 'share' | 'narrow' | 'reassign'>

/**
 * 826 (spec 819 §C): who may share an item with an audience, narrow it, or hand it to another author. Pure.
 *
 * - The owner (an author) shares their Personal item with everyone or chosen roles and users, and changes a Shared
 *   item's audience the same way (`PUT …/Audience`, never `ANALYTICS-405`). A Certified item is the curators'.
 * - A curator who does not own a Shared item may only narrow its audience or unshare it, in the same dialog.
 * - A curator hands someone else's Shared or Certified item to another author (`POST …/Reassign`), so a team's
 *   item is not stranded when its owner loses the author grant. Someone else's Personal item is not visible.
 * - An author in the audience gets none of these: they run it and may Save as my copy.
 */
export function shareActions(item: ItemStanding | null, actor: ItemActor): ShareActionKey[] {
  if (!item || !actor.canView || !(actor.canAuthor || actor.canCurate)) return []
  const owns = isOwner(item.owner, actor.userId)
  if (owns) return item.tier === 'certified' ? [] : ['share']
  if (!actor.canCurate || item.tier === 'personal') return []
  return item.tier === 'shared' ? ['narrow', 'reassign'] : ['reassign']
}

/**
 * 833 (spec 819 §C): who manages a report's schedules (makes, edits, pauses, sends now, deletes) — its owner while
 * they hold the author grant, and curators (a Certified report's, and a Shared one whose owner lost a grant). Someone
 * else's Personal report is not visible, so nobody else manages it. Pure; the server stays the judge.
 */
export function canManageSchedules(item: ItemStanding, actor: ItemActor): boolean {
  if (!actor.canView) return false
  if (actor.canCurate) return item.tier !== 'personal' || isOwner(item.owner, actor.userId)
  return actor.canAuthor && isOwner(item.owner, actor.userId)
}
