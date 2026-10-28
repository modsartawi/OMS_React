/**
 * IDF groups, pure (BackOffice spec 3185, door 3196; oms ticket 652). An IDF group is the set of interchangeable
 * items a master ranks; until 3185 the groups were kept only in the WPF (its IDF Import screen still writes them,
 * unchecked). A group has a number (at most 26, fixed once added), ONE description (no EN/AR pair) and a dosage form;
 * the list reads how many items point at it, and only an empty group can be removed.
 *
 * Shapes are the brief's sketch ("Spec 3185"); 654 reconciles them with the doors as built.
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

/** The longest group number the doors accept. */
export const IDF_GROUP_NUMBER_MAX = 26

export const EMPTY_GROUP_FORM: IdfGroupForm = { idfNumber: '', description: '', dosageForm: '' }

export function formFromGroup(g: IdfGroup): IdfGroupForm {
  return { idfNumber: g.idfNumber, description: g.description ?? '', dosageForm: g.dosageForm ?? '' }
}

export type IdfGroupProblem = 'numberRequired' | 'numberTooLong' | 'descriptionRequired'

/** Why the form may not be sent yet. On an edit the number is fixed, so it is never checked. */
export function groupFormProblems(f: IdfGroupForm, mode: IdfGroupFormMode): Partial<Record<'idfNumber' | 'description', IdfGroupProblem>> {
  const out: Partial<Record<'idfNumber' | 'description', IdfGroupProblem>> = {}
  if (mode === 'add') {
    const n = f.idfNumber.trim()
    if (!n) out.idfNumber = 'numberRequired'
    else if (n.length > IDF_GROUP_NUMBER_MAX) out.idfNumber = 'numberTooLong'
  }
  if (!f.description.trim()) out.description = 'descriptionRequired'
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

/** The item count a remove refusal carries in `data.itemCount`, or null. */
export function refusedItemCount(data: unknown): number | null {
  const n = (data as { itemCount?: unknown } | null | undefined)?.itemCount
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/**
 * Whether a failed remove is final: only the door's "items still point at it" refusal (a count above 0 in its data)
 * keeps Remove off. Any other failure — a transient server or network error — may be retried.
 */
export function removeRefusedForGood(data: unknown): boolean {
  return (refusedItemCount(data) ?? 0) > 0
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
