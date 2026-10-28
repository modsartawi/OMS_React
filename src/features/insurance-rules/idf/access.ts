/**
 * The IDF screens' grant probe, pure (BackOffice 3191; oms ticket 654). `GET IdfPriority/Access` — cookie-only and NOT
 * grant-gated — answers `{ canViewIdf, canEditIdf, canEditGeneral }`: the IDF view grant (Display), the master edit
 * grant (Execute: a master's draft) and the general edit grant (07: the general master and the IDF groups). The doors
 * re-check their grants regardless; the probe only decides which write controls show. Reads, exports and templates
 * stay on the view grant and are never hidden by it.
 */
import type { IdfDraftPanelState } from './draft'

export const IDF_ACCESS_FLAGS = ['canViewIdf', 'canEditIdf', 'canEditGeneral'] as const
export type IdfAccessFlag = (typeof IDF_ACCESS_FLAGS)[number]
export type IdfGrants = Record<IdfAccessFlag, boolean>

/** No grant at all: the probe still reading, failed, or answered nothing. */
export const NO_IDF_GRANTS: IdfGrants = { canViewIdf: false, canEditIdf: false, canEditGeneral: false }

/**
 * Every flag as a plain boolean. Only an explicit `true` grants: an absent flag, a missing answer or a malformed value
 * (`"true"`, `1`, an array from a stub that never heard of the door) all read as `false` — the probe fails closed.
 */
export function idfGrants(r: Partial<Record<IdfAccessFlag, unknown>> | null | undefined): IdfGrants {
  const record = (typeof r === 'object' && r !== null && !Array.isArray(r) ? r : {}) as Partial<Record<IdfAccessFlag, unknown>>
  return Object.fromEntries(IDF_ACCESS_FLAGS.map((flag) => [flag, record[flag] === true])) as IdfGrants
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
