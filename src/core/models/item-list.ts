import type { AnalyticsAudience, AnalyticsLabel, AnalyticsTier } from './analytics'

/**
 * An item list (BackOffice spec 4057, ticket 4058 — reconciled to BO spec4057 d919921f5): a shared analytics item of kind
 * `itemlist` holding items or item groups, each with the availability periods its team states. Not a named set (one
 * reader's stores) and not stock data. The wire is read defensively in `features/analytics/item-lists/api.ts`.
 */

/** A member's level: `item` (the zero-stripped `item_key`) or a level of the merchandising hierarchy. */
export const ITEM_LIST_LEVELS = ['item', 'category', 'class_b', 'class_c', 'therapeutic_class', 'ingredient_class', 'brand', 'vendor', 'manufacturer'] as const
export type ItemListLevel = (typeof ITEM_LIST_LEVELS)[number]
/** A level as read: one of {@link ITEM_LIST_LEVELS} (matched in any case), else the server's word as sent — never coerced. */
export type ItemListLevelRead = ItemListLevel | (string & {})

/** The five stated statuses (spec 4057 default 3). */
export const ITEM_LIST_STATUSES = ['unavailable', 'blocked', 'delisted', 'limited', 'available'] as const
export type ItemListStatus = (typeof ITEM_LIST_STATUSES)[number]

export interface ItemListMember {
  level: ItemListLevelRead
  /** The level's value as `item_sales` publishes it. */
  key: string
  /** Its words (an item's description, a group's name); may be empty. */
  label: string
}

export interface ItemListPeriod {
  /** The member's level: the wire names the member as `level:key` (BO `AnalyticsItemListMember.Ref`), split here. */
  level: ItemListLevelRead
  /** The member's key. */
  member: string
  /** A local calendar date, `yyyy-mm-dd`. */
  from: string
  /** `null` is open: "still", read as today on each question. */
  to: string | null
  /** `null` when the server's word is none of the five (drawn neutral, as `statusText`). */
  status: ItemListStatus | null
  /** The status as the server sent it. */
  statusText: string
  note: string
}

/** A file value that matched nothing, kept on the list for display. */
export interface ItemListUnknown {
  row: number
  level: string
  value: string
}

/** The last upload: file name, rows, matched, unknown, who and when (the wire's `who` / `when`). */
export interface ItemListUpload {
  fileName: string
  rows: number
  matched: number
  /** The rows whose value matched nothing. */
  unknown: number
  by: string
  /** Estate local wall clock, `yyyy-MM-ddTHH:mm:ss`. */
  at: string
}

/** `GET Analytics/ItemLists/{id}` — the list as anyone in its audience reads it. */
export interface ItemList {
  id: string
  title: AnalyticsLabel
  owner: string
  tier: AnalyticsTier
  revision: number
  updatedAt: string
  updatedBy: string
  audience?: AnalyticsAudience
  folderId: string | null
  members: ItemListMember[]
  periods: ItemListPeriod[]
  unknown: ItemListUnknown[]
  upload: ItemListUpload | null
}

/**
 * What the preview says of the file, sorted by the server's `reason`: a row repeated (`duplicate`), two periods of one
 * member that overlap (`overlap`), a date that is not one (`from` / `to`: `badDate`), anything else it refuses
 * (`refused`: a level or status it does not know, no key, a note with personal data, the name), and what the save keeps
 * but the author should know (`notice`: a note clamped, a note on a row with no period). The values that matched
 * nothing are not problems: they are the preview's `unknown`, kept on the list (story 6).
 */
export type ItemListProblemKind = 'unknown' | 'duplicate' | 'badDate' | 'overlap' | 'refused' | 'notice'

/** `AnalyticsItemListProblem`: its rows (two or more for a duplicate or an overlap; none for the name), the column, the
 * server's reason code and its words. */
export interface ItemListProblem {
  kind: ItemListProblemKind
  rows: number[]
  /** The column at fault: `level`, `key`, `from`, `to`, `status`, `note`, or `name`. */
  field: string
  reason: string
  /** The server's words; free text. */
  message: string
}

/** An item row whose own periods win over a group row's ("the most specific wins"). */
export interface ItemListOverride {
  item: string
  level: ItemListLevelRead
  group: string
}

/**
 * `POST Analytics/ItemLists/Preview` — nothing kept. The list as it would be kept (`members`, `periods`, `unknown`), what
 * refuses the save (`problems`) and what does not (`notices`). The server keeps the preview 30 minutes under `token`, and
 * only when it may be saved: a preview with any problem (or no member) has none.
 */
export interface ItemListPreview {
  /** Empty when the preview cannot be saved. */
  token: string
  /** Estate local wall clock, `yyyy-MM-ddTHH:mm:ss`, no zone; empty with no token. Shown, never compared with this
   * machine's clock. */
  expiresAt: string
  /** The name the preview was given, cleaned (oms sends none: the name is given at Save). */
  name: string
  fileName: string
  rowCount: number
  matchedRows: number
  unknownRows: number
  members: ItemListMember[]
  periods: ItemListPeriod[]
  unknown: ItemListUnknown[]
  problems: ItemListProblem[]
  notices: ItemListProblem[]
  overrides: ItemListOverride[]
}

/** A version of the list: its revision, who saved it, when. */
export interface ItemListVersion {
  revision: number
  by: string
  at: string
}

/** `POST Analytics/ItemLists` — create from a preview's token. BO: no audience keeps the list Personal (oms always sends one). */
export interface ItemListCreate {
  token: string
  name: string
  audience: { everyone: true } | { roles: string[]; users: string[] }
  folderId: string | null
}
