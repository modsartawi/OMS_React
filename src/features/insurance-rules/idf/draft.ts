/**
 * A master's draft, pure (BackOffice spec 3185, door 3189; oms ticket 645, extended by 646). One open draft per master:
 * `GET IdfPriority/masters/{id}/draft` answers it — `{ draftId, by, startedAt, changedAt, baseVersionId, isStale, rows }`,
 * `rows` the entries row shape (3187), every row at once — or `null`. Start copies the live items in; each add, re-rank
 * or remove is checked as an upload line is and a failing one is refused (a 400 carrying `{ rule, messageEn,
 * messageAr }`) with the draft left as it was; publish with a note makes ONE new live version; discard closes it.
 *
 * The diff: the draft door carries no per-row change (3189 as built: `rows` is the entries row shape, unmarked), so the
 * screen compares the draft's rows with the rows of the version the draft was copied from (`baseVersionId`, read whole
 * — see `idfDraftApi.baseRows`). A draft started on a master with nothing live has `baseVersionId ''`: there is no base
 * to read, and every row is added (`draftBaseVersion`).
 *
 * 654 reconciled the refusals with the doors as built (BackOffice 3189/3190, `IdfPriorityErrorCodes`): `IDF-00029` no
 * open draft · `IDF-00030` an edit failing an upload rule, `data { rule, messageEn, messageAr }` · `IDF-00031` the
 * draft does not hold the item · `IDF-00033` an empty draft published · `IDF-00034` a second start, `data { draftId,
 * by, startedAt, changedAt }` · `IDF-00035` a stale draft published · `IDF-00036` a group with no items added.
 */
import { ruleWordKey, rowMessage } from './upload'
import { wholePriority } from './general-edit'
import type { IdfEntriesPage, IdfEntryRow, IdfItemsQuery } from './items'

/** `GET …/draft` — the open draft. */
export interface IdfDraft {
  draftId: string
  /** Who started it (a user id) — 646 tells "mine" from "someone else's". */
  by: string
  startedAt: string
  changedAt: string
  /** The version the draft was copied from (the live one at the start, or at the last rebase); `''` when nothing was live. */
  baseVersionId: string | null
  /** The live version has moved since — publish is refused until a rebase (646). */
  isStale: boolean
  rows: IdfEntryRow[]
}

/** `POST …/draft/items`. */
export interface IdfDraftAddBody {
  itemNumber: string
  idfNumber: string
  priority: number
}

/** How a draft row stands against the base version. `moved` = the same item under another group (remove + add). */
export type IdfDraftMark = 'added' | 'reRanked' | 'moved' | 'unchanged'
export const IDF_DRAFT_MARKS = ['added', 'reRanked', 'moved', 'unchanged'] as const

export interface IdfDraftDiff {
  /** A draft row's mark by item number; null for an item the draft does not hold. */
  mark: (itemNumber: string) => IdfDraftMark | null
  /** The base rows the draft no longer holds, with their base values, in base order. */
  removed: IdfEntryRow[]
  counts: Record<IdfDraftMark | 'removed', number>
}

export function draftDiff(draftRows: readonly IdfEntryRow[], baseRows: readonly IdfEntryRow[]): IdfDraftDiff {
  const base = new Map(baseRows.map((r) => [r.itemNumber, r]))
  const marks = new Map<string, IdfDraftMark>()
  const counts = { added: 0, reRanked: 0, moved: 0, removed: 0, unchanged: 0 }
  for (const r of draftRows) {
    const was = base.get(r.itemNumber)
    const mark: IdfDraftMark = !was ? 'added' : was.idfNumber !== r.idfNumber ? 'moved' : was.priority !== r.priority ? 'reRanked' : 'unchanged'
    marks.set(r.itemNumber, mark)
    counts[mark] += 1
  }
  const removed = baseRows.filter((r) => !marks.has(r.itemNumber))
  counts.removed = removed.length
  return { mark: (itemNumber) => marks.get(itemNumber) ?? null, removed, counts }
}

/** The version a draft diffs against, or null when it has none (nothing was live when it started). */
export function draftBaseVersion(draft: Pick<IdfDraft, 'baseVersionId'> | null | undefined): string | null {
  const id = (draft?.baseVersionId ?? '').trim()
  return id || null
}

/** The rules a draft edit names beyond the upload's: a rebased re-rank whose item the new live version no longer ranks. */
export const IDF_DRAFT_RULES = ['notInDraft'] as const

/** A draft rule's word key: an upload rule's (`upload.rule.*`), the draft's own (`draft.ruleWord.*`), or null. */
export function draftRuleWordKey(rule: string): string | null {
  return (IDF_DRAFT_RULES as readonly string[]).includes(rule) ? `draft.ruleWord.${rule}` : ruleWordKey(rule)
}

/** The edits a rebase replays or a group add makes (`IdfDraftItemProblem.Edit`). */
export const IDF_DRAFT_EDITS = ['add', 'reRank'] as const

/** A refused draft edit, ready to show: the rule's word key (null = show the raw `rule`) and the message. */
export interface IdfDraftRefusal {
  rule: string
  wordKey: string | null
  message: string
}

/**
 * A draft edit's refusal `data` (`apiErrorData(err)`) as a rule refusal, or null when it carries no rule — then the
 * envelope's own message is the thing to show (`apiErrorMessage`).
 */
export function draftEditRefusal(data: unknown, lang: string): IdfDraftRefusal | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { rule?: unknown; messageEn?: unknown; messageAr?: unknown }
  if (typeof d.rule !== 'string' || !d.rule) return null
  const message = rowMessage({ messageEn: String(d.messageEn ?? ''), messageAr: String(d.messageAr ?? '') }, lang)
  return { rule: d.rule, wordKey: draftRuleWordKey(d.rule), message }
}

/** The draft door is not paged: the screen pages the draft's rows itself, at the entries door's page size. */
export const DRAFT_PAGE_SIZE = 25

function matches(r: IdfEntryRow, q: Pick<IdfItemsQuery, 'q' | 'idf'>): boolean {
  if (q.idf && r.idfNumber !== q.idf) return false
  if (!q.q) return true
  const s = q.q.toLowerCase()
  return r.itemNumber.toLowerCase().includes(s) || (r.descriptionEn ?? '').toLowerCase().includes(s) || (r.descriptionAr ?? '').includes(q.q)
}

/** One page of the draft's rows, searched and grouped as the entries door does (3187). */
export function draftPage(rows: readonly IdfEntryRow[], q: IdfItemsQuery, pageSize = DRAFT_PAGE_SIZE): IdfEntriesPage {
  const hits = rows.filter((r) => matches(r, q))
  return { page: q.page, pageSize, total: hits.length, rows: hits.slice((q.page - 1) * pageSize, q.page * pageSize) }
}

/** The removed rows the filter matches, listed after the draft's last page (`total` = the draft rows matching). */
export function removedShown(removed: readonly IdfEntryRow[], q: IdfItemsQuery, total: number, pageSize = DRAFT_PAGE_SIZE): IdfEntryRow[] {
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  return q.page >= lastPage ? removed.filter((r) => matches(r, q)) : []
}

/** What the items section shows: the draft, a version, or nothing (no draft, never published). */
export type IdfItemsShown = { kind: 'draft' } | { kind: 'version'; versionId: string }

/** The version picker's value for the draft. */
export const DRAFT_SHOWN = ''

/**
 * `?version` names a version to show; absent, an open draft shows, else the live version. So with a draft open the live
 * version is named in the address like any other (643 left it out — it was the default then).
 */
export function itemsShown(q: { version: string }, liveVersionId: string | null | undefined, draftOpen: boolean): IdfItemsShown | null {
  if (q.version) return { kind: 'version', versionId: q.version }
  if (draftOpen) return { kind: 'draft' }
  return liveVersionId ? { kind: 'version', versionId: liveVersionId } : null
}

/** Picking the draft or a version keeps the search and group and goes to page 1; the default leaves the address. */
export function pickShown<Q extends IdfItemsQuery & { version: string }>(q: Q, value: string, liveVersionId: string | null | undefined, draftOpen: boolean): Q {
  const isDefault = value === DRAFT_SHOWN || (!draftOpen && value === liveVersionId)
  return { ...q, version: isDefault ? '' : value, page: 1 }
}

/** The Add form as typed. */
export interface IdfDraftAddForm {
  itemNumber: string
  idfNumber: string
  priority: string
}
export const EMPTY_DRAFT_ADD: IdfDraftAddForm = { itemNumber: '', idfNumber: '', priority: '' }

/** The add body, or null while a field is blank or the priority is not a whole number of 1 or more (`wholePriority`). */
export function draftAddBody(form: IdfDraftAddForm): IdfDraftAddBody | null {
  const itemNumber = form.itemNumber.trim()
  const idfNumber = form.idfNumber.trim()
  const priority = wholePriority(form.priority)
  if (!itemNumber || !idfNumber || priority === null) return null
  return { itemNumber, idfNumber, priority }
}

/**
 * What the draft panel draws (646): no draft; mine; someone else's (read-only here but for Discard — the owner edits,
 * rebases and publishes it); or mine and stale (the live version moved since its base: Publish off, Rebase on). A
 * draft belongs to the master, so the owner is only ever compared, never required. User ids compare case-blind and
 * trimmed; without a signed-in user nothing is claimed as mine.
 */
export type IdfDraftPanelState = 'none' | 'mine' | 'someoneElse' | 'stale'
export function draftPanelState(draft: IdfDraft | null | undefined, userId: string | null | undefined): IdfDraftPanelState {
  if (!draft) return 'none'
  const me = (userId ?? '').trim().toLowerCase()
  if (!me || (draft.by ?? '').trim().toLowerCase() !== me) return 'someoneElse'
  return draft.isStale ? 'stale' : 'mine'
}

/** Whether this user edits the draft (add, re-rank, remove, add a group): their own, stale or not. */
export function draftEditable(state: IdfDraftPanelState): boolean {
  return state === 'mine' || state === 'stale'
}

/** A refused Start's `data { by, changedAt }` — the draft already open — or null when it names no owner. */
export function draftStartRefusal(data: unknown): { by: string; changedAt: string | null } | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { by?: unknown; changedAt?: unknown }
  if (typeof d.by !== 'string' || !d.by) return null
  return { by: d.by, changedAt: typeof d.changedAt === 'string' && d.changedAt ? d.changedAt : null }
}

/** `POST …/draft/groups { idfNumber, priority }`. */
export interface IdfDraftGroupBody {
  idfNumber: string
  priority: number
}

/**
 * One edit a group add refused or a rebase dropped (`IdfDraftItemProblem`: `{ itemNumber, edit, rule, messageEn,
 * messageAr }`), ready to show: its edit (`add` | `reRank`), the rule's word key and the message.
 */
export interface IdfDraftProblem extends IdfDraftRefusal {
  itemNumber: string
  edit: string
}

function problems(rows: unknown, lang: string): IdfDraftProblem[] {
  const list = Array.isArray(rows) ? (rows as { itemNumber?: unknown; edit?: unknown; rule?: unknown; messageEn?: unknown; messageAr?: unknown }[]) : []
  return list.map((r) => {
    const rule = String(r.rule ?? '')
    return {
      itemNumber: String(r.itemNumber ?? ''),
      edit: String(r.edit ?? ''),
      rule,
      wordKey: draftRuleWordKey(rule),
      message: rowMessage({ messageEn: String(r.messageEn ?? ''), messageAr: String(r.messageAr ?? '') }, lang),
    }
  })
}

/** The draft an answer nests under `draft` (3190 as built), or null. */
function nestedDraft(a: { draft?: unknown }): IdfDraft | null {
  return a.draft && typeof a.draft === 'object' && !Array.isArray(a.draft) ? (a.draft as IdfDraft) : null
}

/** `POST …/draft/groups` → `{ draft, added, rows }`: the draft after the add, how many members went in, the refused ones. */
export function groupAddResult(answer: unknown, lang: string): { draft: IdfDraft | null; added: number; refused: IdfDraftProblem[] } {
  const a = (answer && typeof answer === 'object' ? answer : {}) as { draft?: unknown; added?: unknown; rows?: unknown }
  return { draft: nestedDraft(a), added: typeof a.added === 'number' ? a.added : 0, refused: problems(a.rows, lang) }
}

/**
 * `POST …/draft/rebase` (no body) → `{ draft, reapplied, rows }`: the draft rebuilt on the live version, how many of its
 * edits re-applied, and the edits that failed their re-check and were DROPPED from the draft (the screen lists them).
 */
export function rebaseResult(answer: unknown, lang: string): { draft: IdfDraft | null; reapplied: number; failed: IdfDraftProblem[] } {
  const a = (answer && typeof answer === 'object' ? answer : {}) as { draft?: unknown; reapplied?: unknown; rows?: unknown }
  return { draft: nestedDraft(a), reapplied: typeof a.reapplied === 'number' ? a.reapplied : 0, failed: problems(a.rows, lang) }
}
