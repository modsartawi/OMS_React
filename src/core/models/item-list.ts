import type { AnalyticsAudience, AnalyticsLabel, AnalyticsTier } from './analytics'

/**
 * An item list (BackOffice spec 4057, ticket 4058 — ⚠ PROPOSED, not built when oms 925 was): a shared analytics item
 * holding items or item groups, each with the availability periods its team states. Not a named set (one reader's
 * stores) and not stock data. The wire is read defensively in `features/analytics/item-lists/api.ts`.
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

/** The last upload: file name, rows, matched, who and when. */
export interface ItemListUpload {
  fileName: string
  rows: number
  matched: number
  by: string
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

/** A matched row of the preview, with its row number in the file. */
export interface ItemListPreviewRow {
  row: number
  level: ItemListLevelRead
  key: string
  label: string
  from: string | null
  to: string | null
  status: ItemListStatus | null
  /** The status as the file said it. */
  statusText: string
  note: string
}

/**
 * What the preview refuses, each naming its rows: a value that matched nothing, a row repeated, a date that is not
 * one, two periods of one member that overlap, and a note the scrubber refused (or a row past a limit).
 */
export type ItemListProblemKind = 'unknown' | 'duplicate' | 'badDate' | 'overlap' | 'refused'

export interface ItemListProblem {
  kind: ItemListProblemKind
  /** The file's row numbers, ascending; an overlap and a duplicate name two or more. */
  rows: number[]
  /** The level the row named (may be what the file said, unrecognised). */
  level: string
  /** The value at fault: the unmatched key, the bad date, the member's key. */
  value: string
  /** The server's words on a refused row (the scrubber's reason, a limit); free text. */
  reason: string
}

/** `POST Analytics/ItemLists/Preview` — nothing kept; the token saves it for 30 minutes. */
export interface ItemListPreview {
  token: string
  /** ⚠ Guessed: the server's own now when it answered; empty when it sent none. With `expiresAt` it gives the window. */
  issuedAt: string
  /** ISO instant the token lapses at, on the server's clock; empty when the server sent none. */
  expiresAt: string
  fileName: string
  rowCount: number
  matched: ItemListPreviewRow[]
  problems: ItemListProblem[]
}

/** A version of the list: its revision, who saved it, when. */
export interface ItemListVersion {
  revision: number
  by: string
  at: string
}

/** `POST Analytics/ItemLists` — create from a preview's token. */
export interface ItemListCreate {
  token: string
  name: string
  audience: { everyone: true } | { roles: string[]; users: string[] }
  folderId: string | null
}
