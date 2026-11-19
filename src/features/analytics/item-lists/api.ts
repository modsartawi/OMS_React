import { api, apiErrorCode, type FileResponse } from '@/core/api'
import { readAudience } from '@/core/analytics-audience/audience'
import type { AnalyticsLabel, AnalyticsTier } from '@/core/models/analytics'
import {
  ITEM_LIST_LEVELS,
  ITEM_LIST_STATUSES,
  type ItemList,
  type ItemListCreate,
  type ItemListLevelRead,
  type ItemListMember,
  type ItemListPeriod,
  type ItemListPreview,
  type ItemListProblem,
  type ItemListProblemKind,
  type ItemListStatus,
  type ItemListUnknown,
  type ItemListUpload,
  type ItemListVersion,
} from '@/core/models/item-list'

// ── The item list's doors (BackOffice spec 4057, ticket 4058 — `AnalyticsItemListEndpoints.cs`; reconciled to BO spec4057
// d919921f5). The six doors below; everything else a list does (share, audience, delete, revisions, folders) is the item's
// own `Analytics/Item/{id}/…` doors. Calls go through `@/core/api` (.claude/rules/api-envelope.md).
const TEMPLATE = 'Analytics/ItemLists/Template'
const PREVIEW = 'Analytics/ItemLists/Preview'
const CREATE = 'Analytics/ItemLists'
const one = (id: string) => `Analytics/ItemLists/${encodeURIComponent(id)}`
const exportOf = (id: string) => `${one(id)}/Export`
/** The item machinery's revisions (779's door): a list is an analytics item. */
const revisionsOf = (id: string) => `Analytics/Item/${encodeURIComponent(id)}/Revisions`
/** The multipart part carrying the file (`IFormFile? file`). */
const FILE_PART = 'file'
/** `ANALYTICS-435`: a create or replace naming a preview token that is unknown, past its 30 minutes, used, or another user's. */
export const TOKEN_EXPIRED_CODE = 'ANALYTICS-435'

/** The names a workbook is saved under when the reply's `Content-Disposition` names none. */
export const TEMPLATE_FALLBACK_NAME = 'item-list-template.xlsx'
export const EXPORT_FALLBACK_NAME = 'item-list.xlsx'

/** Save answered that the preview's token lapsed: the page asks for the file again. */
export const isExpiredTokenRefusal = (err: unknown): boolean => apiErrorCode(err) === TOKEN_EXPIRED_CODE

// ── Readers, defensive: a missing field reads empty, never a throw. ──────────────────────────────────────────────────
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const rowsOf = (r: Record<string, unknown>): number[] =>
  Array.isArray(r.rows) ? r.rows.filter((n): n is number => typeof n === 'number') : typeof r.row === 'number' ? [r.row] : []
/** The one of `known` the word names, in any case; `null` when it names none. */
const oneOf = <T extends string>(known: readonly T[], v: unknown): T | null => {
  const w = text(v).trim().toLowerCase()
  return known.find((k) => k === w) ?? null
}
/** A level as read: the known one in any case, else the word as sent (drawn as itself) — never made into `item`. */
const levelOf = (v: unknown): ItemListLevelRead => oneOf(ITEM_LIST_LEVELS, v) ?? text(v).trim()
/** A status the five do not name is none (drawn neutral, with its words); never made into one of them. */
const statusOf = (v: unknown): ItemListStatus | null => oneOf(ITEM_LIST_STATUSES, v)
const words = (v: unknown): AnalyticsLabel => (typeof v === 'string' ? { en: v, ar: v } : { en: text(rec(v).en), ar: text(rec(v).ar) })
const tierOf = (v: unknown): AnalyticsTier => (v === 'shared' || v === 'certified' ? v : 'personal')

const memberOf = (v: unknown): ItemListMember => {
  const m = rec(v)
  return { level: levelOf(m.level), key: text(m.key), label: text(m.label) }
}

/** A period names its member as `level:key` (BO `AnalyticsItemListMember.Ref`): split at the first colon. */
const periodOf = (v: unknown): ItemListPeriod => {
  const p = rec(v)
  const ref = text(p.member)
  const at = ref.indexOf(':')
  return {
    level: at < 0 ? '' : levelOf(ref.slice(0, at)),
    member: at < 0 ? ref : ref.slice(at + 1),
    from: text(p.from),
    to: text(p.to) || null,
    status: statusOf(p.status),
    statusText: text(p.status),
    note: text(p.note),
  }
}

const unknownOf = (v: unknown): ItemListUnknown => {
  const u = rec(v)
  return { row: num(u.row), level: text(u.level), value: text(u.value) }
}

const uploadOf = (v: unknown): ItemListUpload => {
  const u = rec(v)
  return { fileName: text(u.fileName), rows: num(u.rows), matched: num(u.matched), unknown: num(u.unknown), by: text(u.who), at: text(u.when) }
}

/** The kind a problem is drawn under, by the server's `reason` (`AnalyticsItemListProblem.Reason`). */
const kindOf = (reason: string): ItemListProblemKind =>
  reason === 'duplicate' ? 'duplicate' : reason === 'overlap' ? 'overlap' : reason === 'from' || reason === 'to' ? 'badDate' : 'refused'

const problemOf =
  (kind: (reason: string) => ItemListProblemKind) =>
  (v: unknown): ItemListProblem => {
    const r = rec(v)
    const reason = text(r.reason)
    return { kind: kind(reason), rows: rowsOf(r), field: text(r.field), reason, message: text(r.message) }
  }

/** `POST Analytics/ItemLists/Preview`'s `data` (`AnalyticsItemListPreview`). */
export function readPreview(raw: unknown): ItemListPreview {
  const d = rec(raw)
  const def = rec(d.definition)
  const upload = uploadOf(def.upload)
  return {
    token: text(d.token),
    expiresAt: text(d.expiresAt),
    name: text(d.name),
    fileName: upload.fileName,
    rowCount: upload.rows,
    matchedRows: upload.matched,
    unknownRows: upload.unknown,
    members: list(def.members).map(memberOf),
    periods: list(def.periods).map(periodOf),
    unknown: list(def.unknown).map(unknownOf),
    problems: list(d.problems).map(problemOf(kindOf)),
    notices: list(d.notices).map(problemOf(() => 'notice')),
    overrides: list(d.overrides).map((v) => {
      const o = rec(v)
      return { item: text(o.item), level: levelOf(o.level), group: text(o.group) }
    }),
  }
}

/** `GET Analytics/ItemLists/{id}` (an `AnalyticsItemInfo`): the item, with its version-1 definition. */
export function readItemList(raw: unknown): ItemList {
  const d = rec(raw)
  const def = rec(d.definition)
  const audience = readAudience(d.audience)
  return {
    id: text(d.id),
    title: words(d.title),
    owner: text(d.owner),
    tier: tierOf(d.tier),
    revision: num(d.revision),
    updatedAt: text(d.updatedAt),
    updatedBy: text(d.updatedBy),
    ...(audience ? { audience } : {}),
    folderId: text(d.folderId) || null,
    members: list(def.members).map(memberOf),
    periods: list(def.periods).map(periodOf),
    unknown: list(def.unknown).map(unknownOf),
    upload: def.upload ? uploadOf(def.upload) : null,
  }
}

/** The revisions door's rows (a bare array or `{ revisions }`), newest first; 890's `savedBy` / `savedAt` spelling. */
export function readVersions(raw: unknown): ItemListVersion[] {
  const all = Array.isArray(raw) ? raw : list(rec(raw).revisions)
  return all
    .map(rec)
    .filter((r) => typeof r.revision === 'number' && !r.event)
    .map((r) => ({ revision: r.revision as number, by: text(r.savedBy) || text(r.updatedBy), at: text(r.savedAt) || text(r.updatedAt) }))
    .sort((a, b) => b.revision - a.revision)
}

/** `GET Analytics/Folders` — the caller's own folders, for the folder picker (837's door, read to id and name; a bare
 * array or `{ folders }`, as the library's reader takes it). */
export function readFolders(raw: unknown): { id: string; name: string }[] {
  return (Array.isArray(raw) ? raw : list(rec(raw).folders))
    .map(rec)
    .map((f) => ({ id: text(f.id), name: text(f.name), order: num(f.order) }))
    .filter((f) => f.id)
    .sort((a, b) => a.order - b.order)
    .map(({ id, name }) => ({ id, name }))
}

/** A workbook the server answered, and the name to save it under. */
export interface ItemListFile {
  blob: Blob
  fileName: string
}
const fileOf =
  (fallback: string) =>
  ({ blob, filename }: FileResponse): ItemListFile => ({ blob, fileName: filename ?? fallback })

const formOf = (picked: File) => {
  const f = new FormData()
  f.append(FILE_PART, picked, picked.name)
  return f
}

export const itemListApi = {
  /** `GET Analytics/ItemLists/Template` — the `.xlsx` with the columns, EN and AR headers, and the statuses. */
  async template(): Promise<ItemListFile> {
    return fileOf(TEMPLATE_FALLBACK_NAME)(await api.blob(TEMPLATE))
  },
  /** `POST Analytics/ItemLists/Preview` (multipart) — parsed and matched, nothing kept; a token valid 30 minutes. */
  async preview(picked: File): Promise<ItemListPreview> {
    return readPreview(await api.upload<unknown>(PREVIEW, formOf(picked)))
  },
  /** `POST Analytics/ItemLists` (token, name, audience, folder) — the list, shared with its audience. */
  async create(body: ItemListCreate): Promise<ItemList> {
    return readItemList(await api.post<unknown>(CREATE, body))
  },
  /** `PUT Analytics/ItemLists/{id}` (token, baseRevision) — the re-upload, a new revision of its contents; its owner only
   * (BO `RequireEdit`, `ANALYTICS-403` otherwise). `baseRevision`, when given, must still be current (`ANALYTICS-405`). */
  async replace(id: string, token: string, baseRevision?: number): Promise<ItemList> {
    return readItemList(await api.put<unknown>(one(id), baseRevision ? { token, baseRevision } : { token }))
  },
  /** `GET Analytics/ItemLists/{id}` — anyone in its audience. */
  async get(id: string): Promise<ItemList> {
    return readItemList(await api.get<unknown>(one(id)))
  },
  /** `GET Analytics/ItemLists/{id}/Export` — the list back as `.xlsx`, anyone in its audience. */
  async export(id: string): Promise<ItemListFile> {
    return fileOf(EXPORT_FALLBACK_NAME)(await api.blob(exportOf(id)))
  },
  async versions(id: string): Promise<ItemListVersion[]> {
    return readVersions(await api.get<unknown>(revisionsOf(id)))
  },
  async folders(): Promise<{ id: string; name: string }[]> {
    return readFolders(await api.get<unknown>('Analytics/Folders'))
  },
}

export const ITEM_LISTS_KEY = ['analytics', 'itemLists'] as const
export const itemListKey = (id: string) => [...ITEM_LISTS_KEY, 'one', id] as const
export const itemListVersionsKey = (id: string) => [...ITEM_LISTS_KEY, 'versions', id] as const
export const ITEM_LIST_FOLDERS_KEY = [...ITEM_LISTS_KEY, 'folders'] as const
