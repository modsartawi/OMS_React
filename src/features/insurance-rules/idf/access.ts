/**
 * The IDF screens' grants, pure (BackOffice 3191; oms ticket 654; oms 914: off the one permissions answer). The IDF
 * view grant (`IdfPriority:03`, Display), the master edit grant (`IdfPriority:06`, Execute: a master's draft) and the
 * general edit grant (`IdfPriority:07`: the general master and the IDF groups). The doors re-check their grants
 * regardless; these only decide which write controls show. Reads, exports and templates stay on the view grant and
 * are never hidden by it.
 */
import type { Permissions } from '@/core/permissions'
import type { IdfDraftPanelState } from './draft'

export const canViewIdf = (p: Permissions): boolean => p.has('IdfPriority:03')
export const canEditIdf = (p: Permissions): boolean => p.has('IdfPriority:06')
export const canEditGeneral = (p: Permissions): boolean => p.has('IdfPriority:07')

export interface IdfGrants {
  canViewIdf: boolean
  canEditIdf: boolean
  canEditGeneral: boolean
}

/** Every grant as a plain boolean. Pending, failed or unanswered permissions grant nothing (fail closed). */
export function idfGrants(p: Permissions): IdfGrants {
  return { canViewIdf: canViewIdf(p), canEditIdf: canEditIdf(p), canEditGeneral: canEditGeneral(p) }
}

/** The draft panel's controls. `edit` = Add an item, Add a group, a row's Re-rank and Remove. */
export interface IdfDraftActions {
  start: boolean
  edit: boolean
  rebase: boolean
  publish: boolean
  discard: boolean
}

/**
 * Which draft controls show for a panel state (`draftPanelState`) and the master edit grant. Without the grant the
 * draft is read-only (its header and rows still show). Someone else's draft offers only Discard (anyone with the grant
 * may discard any draft, BackOffice 3189); a stale one of mine adds Rebase (Publish shows, but stays off while stale).
 */
export function draftActions(state: IdfDraftPanelState, canEditIdf: boolean): IdfDraftActions {
  const mine = state === 'mine' || state === 'stale'
  return {
    start: canEditIdf && state === 'none',
    edit: canEditIdf && mine,
    rebase: canEditIdf && state === 'stale',
    publish: canEditIdf && mine,
    discard: canEditIdf && state !== 'none',
  }
}
