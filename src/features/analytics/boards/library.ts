import type { AnalyticsItem, AnalyticsLabel } from '@/core/models/analytics'
import { addDays, type LocalDate } from '@/core/util/date-window'
import { toIsoDate } from '@/core/util/date-format'
import { newestFirst, titleMatcher } from './home'
import { isOwner } from './item-actions'

/**
 * The analytics library (ticket 837 item 3, BackOffice 3432) — pure: no React, no i18n.
 *
 * The home and the board editor's views palette narrow one list of items at once, client-side, by:
 * - **who**: all; mine (`owner` is me); certified; shared with me (Shared and not mine);
 * - **kind**: view, board or report;
 * - **changed**: any time, today, the last 7 or 30 days (today included), or a from/to range of local dates
 *   (both ends included, either may be open), on `updatedAt`'s local day;
 * - **folder**: all items, unfiled (`none`), one of my folders (its id), or recently deleted (`deleted`);
 * - **search**: the home's title search (`./home` `titleMatcher`).
 * The result is one list, newest change first. A deleted item (`deletedAt`) shows only under `deleted`.
 *
 * The server is asked with the same narrowing (`libraryItemsQuery`, 3432 §1); an older server ignores the params
 * and this filter still shows the same. The choice lives in the URL (`libraryFromParams` / `libraryToParams`).
 */

export type LibraryWho = 'all' | 'mine' | 'certified' | 'sharedWithMe'
export type LibraryKind = 'all' | 'view' | 'board' | 'report'
export type LibraryChanged = { kind: 'any' } | { kind: 'today' } | { kind: 'days'; days: 7 | 30 } | { kind: 'range'; from?: string; to?: string }
/** `all`, `none` (unfiled), `deleted` (recently deleted), or a folder id. */
export type LibraryFolder = 'all' | 'none' | 'deleted' | (string & {})

export interface LibraryChoice {
  who: LibraryWho
  kind: LibraryKind
  changed: LibraryChanged
  folder: LibraryFolder
  search: string
}

export const LIBRARY_WHO: readonly LibraryWho[] = ['all', 'mine', 'certified', 'sharedWithMe']
export const LIBRARY_KINDS: readonly LibraryKind[] = ['all', 'view', 'board', 'report']

export const DEFAULT_LIBRARY_CHOICE: LibraryChoice = { who: 'all', kind: 'all', changed: { kind: 'any' }, folder: 'all', search: '' }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (s: string | null | undefined): s is LocalDate => !!s && DATE.test(s)
/** The value when it is a `yyyy-MM-dd`, else `undefined`. */
const dateOr = (s: string | null | undefined): LocalDate | undefined => (s && DATE.test(s) ? s : undefined)

/**
 * The local calendar day of a server instant. A time with no zone (`2026-11-04T08:00:00`) is already local and is
 * read as written; one with a zone (`…Z`, `…+03:00`) is turned into the browser's local day.
 */
export function localDayOf(at: string | null | undefined): LocalDate | null {
  if (!at) return null
  const head = at.slice(0, 10)
  if (!isDate(head)) return null
  const rest = at.slice(10)
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(rest)) return head
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? head : toIsoDate(d)
}

/** The changed choice as an inclusive span of local dates; open ends are `undefined`. `null` = any time. */
export function changedWindow(changed: LibraryChanged, today: LocalDate): { from?: LocalDate; to?: LocalDate } | null {
  switch (changed.kind) {
    case 'any':
      return null
    case 'today':
      return { from: today, to: today }
    case 'days':
      return { from: addDays(today, -(changed.days - 1)), to: today }
    case 'range': {
      const from = dateOr(changed.from)
      const to = dateOr(changed.to)
      return from || to ? { ...(from ? { from } : {}), ...(to ? { to } : {}) } : null
    }
  }
}

function whoMatches(who: LibraryWho, it: AnalyticsItem, me: string): boolean {
  switch (who) {
    case 'all':
      return true
    case 'mine':
      return isOwner(it.owner, me)
    case 'certified':
      return it.tier === 'certified'
    case 'sharedWithMe':
      return it.tier === 'shared' && !isOwner(it.owner, me)
  }
}

function folderMatches(folder: LibraryFolder, it: AnalyticsItem): boolean {
  const deleted = !!it.deletedAt
  if (folder === 'deleted') return deleted
  if (deleted) return false
  if (folder === 'all') return true
  if (folder === 'none') return !it.folderId
  return it.folderId === folder
}

export function libraryItems(
  items: readonly AnalyticsItem[],
  choice: Partial<LibraryChoice>,
  me: string,
  today: string,
  fallbackTitle?: (i: AnalyticsItem) => AnalyticsLabel,
): AnalyticsItem[] {
  const c: LibraryChoice = { ...DEFAULT_LIBRARY_CHOICE, ...choice }
  const matchesTitle = titleMatcher(c.search, fallbackTitle)
  const span = changedWindow(c.changed, today)
  const inWindow = (it: AnalyticsItem) => {
    if (!span) return true
    const day = localDayOf(it.updatedAt)
    if (!day) return false
    return (!span.from || day >= span.from) && (!span.to || day <= span.to)
  }
  return items
    .filter(
      (it) =>
        folderMatches(c.folder, it) &&
        whoMatches(c.who, it, me) &&
        (c.kind === 'all' || it.kind === c.kind) &&
        inWindow(it) &&
        matchesTitle(it),
    )
    .sort(newestFirst)
}

/** Whether the choice narrows anything beyond the folder (the home words "nothing matches" differently). */
export const choiceNarrows = (c: LibraryChoice): boolean =>
  c.who !== 'all' || c.kind !== 'all' || c.changed.kind !== 'any' || !!c.search.trim()

// ── The server's narrowing (3432 §1) ──────────────────────────────────────────────────────────────

/** `GET Analytics/Items` params (766 §C `kind`, `tier`, `search`; 3432 `folder`, `changedFrom/To`, `owner`, `deleted`). */
export interface LibraryItemsQuery {
  kind?: AnalyticsItem['kind']
  tier?: AnalyticsItem['tier']
  search?: string
  folder?: string
  changedFrom?: LocalDate
  changedTo?: LocalDate
  owner?: 'me'
  deleted?: true
}

/**
 * What the Items door is asked for this choice. Recently deleted asks `deleted=true` alone (the server's own list
 * of my deleted items); the screen still narrows it by the other chips. "Shared with me" asks `tier=shared` (the
 * server has no "not mine"; the web drops my own).
 */
export function libraryItemsQuery(choice: Partial<LibraryChoice>, today: LocalDate): LibraryItemsQuery {
  const c: LibraryChoice = { ...DEFAULT_LIBRARY_CHOICE, ...choice }
  if (c.folder === 'deleted') return { deleted: true }
  const search = c.search.trim()
  const span = changedWindow(c.changed, today)
  return {
    ...(c.kind !== 'all' ? { kind: c.kind } : {}),
    ...(c.who === 'certified' ? { tier: 'certified' as const } : c.who === 'sharedWithMe' ? { tier: 'shared' as const } : {}),
    ...(c.who === 'mine' ? { owner: 'me' as const } : {}),
    ...(search ? { search } : {}),
    ...(c.folder !== 'all' ? { folder: c.folder } : {}),
    ...(span?.from ? { changedFrom: span.from } : {}),
    ...(span?.to ? { changedTo: span.to } : {}),
  }
}

// ── The URL (837: a refresh or Back keeps the choice) ────────────────────────────────────────────

/**
 * `?who=mine&kind=view&changed=7&folder=<id>&q=orders`, and a range as `changed=range&from=…&to=…`. Defaults are
 * left out, so the bare `/analytics` is the whole library. Anything unknown reads as its default.
 */
export function libraryFromParams(params: URLSearchParams): LibraryChoice {
  const who = params.get('who') as LibraryWho | null
  const kind = params.get('kind') as LibraryKind | null
  const folder = params.get('folder')?.trim()
  const changedRaw = params.get('changed')
  let changed: LibraryChanged = { kind: 'any' }
  if (changedRaw === 'today') changed = { kind: 'today' }
  else if (changedRaw === '7' || changedRaw === '30') changed = { kind: 'days', days: changedRaw === '7' ? 7 : 30 }
  else if (changedRaw === 'range') {
    const from = dateOr(params.get('from'))
    const to = dateOr(params.get('to'))
    changed = { kind: 'range', ...(from ? { from } : {}), ...(to ? { to } : {}) }
  }
  return {
    who: who && LIBRARY_WHO.includes(who) ? who : 'all',
    kind: kind && LIBRARY_KINDS.includes(kind) ? kind : 'all',
    changed,
    folder: folder ? folder : 'all',
    search: params.get('q') ?? '',
  }
}

export function libraryToParams(c: LibraryChoice): URLSearchParams {
  const p = new URLSearchParams()
  if (c.who !== 'all') p.set('who', c.who)
  if (c.kind !== 'all') p.set('kind', c.kind)
  if (c.changed.kind === 'today') p.set('changed', 'today')
  else if (c.changed.kind === 'days') p.set('changed', String(c.changed.days))
  else if (c.changed.kind === 'range') {
    p.set('changed', 'range')
    const from = dateOr(c.changed.from)
    const to = dateOr(c.changed.to)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
  }
  if (c.folder !== 'all') p.set('folder', c.folder)
  if (c.search) p.set('q', c.search)
  return p
}

// ── Folders ──────────────────────────────────────────────────────────────────────────────────────

/** A folder name as 3432 takes it: trimmed, 1–80 characters. `null` = not a name (the server says 406 too). */
export function folderName(raw: string): string | null {
  const name = raw.trim()
  return name.length >= 1 && name.length <= 80 ? name : null
}

/** Whether `name` is already one of mine, ignoring case (3432: unique per user, ignoring case). */
export const folderNameTaken = (folders: readonly { id: string; name: string }[], name: string, exceptId?: string): boolean =>
  folders.some((f) => f.id !== exceptId && f.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())

/**
 * One item filed into `folderId` (or unfiled with `null`), in a list — the optimistic write the home applies before
 * `PUT …/Folder` answers, and rolls back if it fails.
 */
export const fileInList = (items: readonly AnalyticsItem[], itemId: string, folderId: string | null): AnalyticsItem[] =>
  items.map((it) => (it.id === itemId ? { ...it, folderId } : it))

/** The folders' counts after one item moves from `from` to `to` (either may be unfiled). */
export function moveCounts<F extends { id: string; itemCount: number }>(folders: readonly F[], from: string | null | undefined, to: string | null): F[] {
  if ((from ?? null) === to) return [...folders]
  return folders.map((f) =>
    f.id === from ? { ...f, itemCount: Math.max(0, f.itemCount - 1) } : f.id === to ? { ...f, itemCount: f.itemCount + 1 } : f,
  )
}

/** The drag type a library row carries (HTML5 drag and drop): the item's id. A folder takes only this type. */
export const LIBRARY_DRAG_TYPE = 'application/x-oms-analytics-item'
