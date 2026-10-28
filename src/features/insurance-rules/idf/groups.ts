/**
 * IDF groups, pure (BackOffice spec 3185, door 3196; oms ticket 652). An IDF group is the set of interchangeable
 * items a master ranks; until 3185 the groups were kept only in the WPF (its IDF Import screen still writes them,
 * unchecked). A group has a number (at most 8 — `ItemIdf.IdfNumber`'s real width, `IdfGroupWidths.Number`, which
 * overrode the sketch's 26 —, fixed once added), ONE description (at most 300, no EN/AR pair) and a dosage form (at
 * most 50); the list reads how many items point at it. A remove is refused (`IDF-00047`) while items point at the
 * group OR a master's LIVE version still ranks it.
 *
 * 654 reconciled the shapes with the doors as built (BackOffice 3196: `IdfGroupWebEndpoints`, `IdfGroupAdminService`).
 */
import { readPage } from './paging'

/** A row of `GET IdfPriority/groups`. */
export interface IdfGroup {
  idfNumber: string
  description: string
  dosageForm?: string | null
  itemCount: number
}

/** `GET IdfPriority/groups?search=&page=&pageSize=`. */
export interface IdfGroupsPage {
  page: number
  pageSize: number
  total: number
  rows: IdfGroup[]
}

/** `POST IdfPriority/groups`. */
export interface IdfGroupBody {
  idfNumber: string
  description: string
  dosageForm: string
}

/** `PUT IdfPriority/groups/{idfNumber}` — the number never changes. */
export type IdfGroupEditBody = Omit<IdfGroupBody, 'idfNumber'>

/** The dialog's fields, as typed. */
export type IdfGroupForm = IdfGroupBody
export type IdfGroupFormMode = 'add' | 'edit'

/** The longest group number, description and dosage form the doors accept (`IdfGroupWidths`; longer is `IDF-00045`). */
export const IDF_GROUP_NUMBER_MAX = 8
export const IDF_GROUP_DESCRIPTION_MAX = 300
export const IDF_GROUP_DOSAGE_FORM_MAX = 50

export const EMPTY_GROUP_FORM: IdfGroupForm = { idfNumber: '', description: '', dosageForm: '' }

export function formFromGroup(g: IdfGroup): IdfGroupForm {
  return { idfNumber: g.idfNumber, description: g.description ?? '', dosageForm: g.dosageForm ?? '' }
}

export type IdfGroupProblem = 'numberRequired' | 'numberTooLong' | 'descriptionRequired' | 'descriptionTooLong' | 'dosageFormTooLong'

/** Why the form may not be sent yet. On an edit the number is fixed, so it is never checked. */
export function groupFormProblems(f: IdfGroupForm, mode: IdfGroupFormMode): Partial<Record<keyof IdfGroupForm, IdfGroupProblem>> {
  const out: Partial<Record<keyof IdfGroupForm, IdfGroupProblem>> = {}
  if (mode === 'add') {
    const n = f.idfNumber.trim()
    if (!n) out.idfNumber = 'numberRequired'
    else if (n.length > IDF_GROUP_NUMBER_MAX) out.idfNumber = 'numberTooLong'
  }
  const description = f.description.trim()
  if (!description) out.description = 'descriptionRequired'
  else if (description.length > IDF_GROUP_DESCRIPTION_MAX) out.description = 'descriptionTooLong'
  if (f.dosageForm.trim().length > IDF_GROUP_DOSAGE_FORM_MAX) out.dosageForm = 'dosageFormTooLong'
  return out
}

export function groupBody(f: IdfGroupForm): IdfGroupBody {
  return { idfNumber: f.idfNumber.trim(), ...groupEditBody(f) }
}

export function groupEditBody(f: IdfGroupForm): IdfGroupEditBody {
  return { description: f.description.trim(), dosageForm: f.dosageForm.trim() }
}

/** Remove is offered only when no item points at the group (the door refuses otherwise, naming the count). */
export function canRemoveGroup(g: Pick<IdfGroup, 'itemCount'>): boolean {
  return g.itemCount === 0
}

/** What still holds a group whose remove was refused: items pointing at it, and entries of the masters' live versions. */
export interface IdfGroupRemoveRefusal {
  itemCount: number
  entryCount: number
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

/**
 * The remove refusal's `data { idfNumber, itemCount, entryCount }` (`IDF-00047`, `IdfGroupHasItemsException`), or null
 * when the data names neither count (a server or network failure).
 */
export function removeRefusal(data: unknown): IdfGroupRemoveRefusal | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { itemCount?: unknown; entryCount?: unknown }
  if (!('itemCount' in d) && !('entryCount' in d)) return null
  return { itemCount: count(d.itemCount), entryCount: count(d.entryCount) }
}

/**
 * Whether a failed remove is final: only the door's "still held" refusal — items point at the group, or a live version
 * ranks it (either count above 0) — keeps Remove off. Any other failure (a transient server or network error) may be
 * retried.
 */
export function removeRefusedForGood(data: unknown): boolean {
  const r = removeRefusal(data)
  return !!r && (r.itemCount > 0 || r.entryCount > 0)
}

// ── the address: `?q=&page=` (defaults omitted)

export interface IdfGroupsQuery {
  /** A number or a description; '' = every group. */
  q: string
  /** 1-based. */
  page: number
}

export function readGroupsQuery(params: URLSearchParams): IdfGroupsQuery {
  return { q: params.get('q')?.trim() ?? '', page: readPage(params.get('page')) }
}

export function writeGroupsQuery(q: IdfGroupsQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.q) out.set('q', q.q)
  if (q.page !== 1) out.set('page', String(q.page))
  return out
}

/** The door's params: `search` is blank-dropped by core `buildQuery`. */
export function groupsDoorParams(q: IdfGroupsQuery): Record<string, string> {
  return { search: q.q, page: String(q.page) }
}
