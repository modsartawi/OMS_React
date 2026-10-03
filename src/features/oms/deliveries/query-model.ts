/**
 * The query bar's token model (ticket 399, spec 380 L8; ruling 368 §1). Pure: the bar renders
 * it, the search store keeps it, and 400's saved views store it as it is.
 *
 * - The 14 `DeliveryFilterCriteria` are 13 entries: From/To is ONE **Date** entry, kept
 *   **relative** ("Last 3 days") in the model and resolved to a concrete From/To only when a
 *   search runs ({@link toFilterCriteria}), so a saved "Last 3 days" still means the last three
 *   days tomorrow (366).
 * - Each criterion in the search is one **token** (`Field: value`). The **Limit** token is
 *   always there and never removed (L8).
 * - The **draft** on screen is measured against the **last search that ran**: an edit, a
 *   removal and an addition each flag their token until Search runs ({@link pendingDiff}).
 */
import { fromIsoDate } from '@/core/util/date-format'
import { BLANK_CRITERIA, effectiveLimit, type DeliveryFilterCriteria } from './filter'

/** `/` focuses the query bar (365 §5): a single key on the list, behind the switch. */
export const QUERY_FOCUS_KEYS = 'Slash'

/** The Date entry's relative presets, and Custom: two days of the operator's own. */
export const DATE_PRESETS = ['today', 'yesterday', 'last3', 'last7', 'custom'] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

/** One relative range. Custom holds its two days as `yyyy-MM-dd`; a blank end is `null`. */
export type DateEntry =
  | { preset: Exclude<DatePreset, 'custom'> }
  | { preset: 'custom'; from: string | null; to: string | null }

/** The search as the bar holds it: the 14 criteria, with From/To as one relative Date. */
export type QueryCriteria = Omit<DeliveryFilterCriteria, 'fromDate' | 'toDate'> & { date: DateEntry | null }

/** One entry of the bar: a criterion, or the Date that stands for From and To. */
export type QueryField = keyof QueryCriteria

/** + Filter's four groups, in this order (368 §1). */
export const QUERY_GROUPS = ['when', 'find', 'narrow', 'rows'] as const
export type QueryGroup = (typeof QUERY_GROUPS)[number]

/** The coded dropdowns, read from the session-cached lookups. They send the description (R-3). */
export type LookupName = 'documentTypes' | 'documentSources' | 'deliveryDocumentTypes'

/** The control a token's popover holds. */
export type FieldControl =
  | { kind: 'date' }
  | { kind: 'text'; type: 'text' | 'tel' }
  | { kind: 'lookup'; lookup: LookupName }
  | { kind: 'choice'; options: readonly string[] }
  | { kind: 'yesNo' }
  | { kind: 'limit' }

/**
 * How a token's value reads (`.claude/rules/bidi.md`): an ID or code in mono and isolated LTR,
 * another machine value isolated LTR, free text in a `<bdi>`, or a word the bar translates.
 */
export type ValueKind = 'id' | 'machine' | 'text' | 'word'

export interface QueryFieldDef {
  id: QueryField
  group: QueryGroup
  /** The `DeliveryFilterCriteria` it stands for: two for Date, one for the rest. */
  criteria: readonly (keyof DeliveryFilterCriteria)[]
  control: FieldControl
  value: ValueKind
}

/** Fixed Delivery Type options — the WPF strings, sent as-is (R-3). */
const DELIVERY_TYPE_OPTIONS = ['Delivery', 'PickInStore'] as const

/** The 13 entries in bar and menu order: When · Find one · Narrow · Rows. */
export const QUERY_FIELDS: readonly QueryFieldDef[] = [
  { id: 'date', group: 'when', criteria: ['fromDate', 'toDate'], control: { kind: 'date' }, value: 'word' },
  { id: 'deliveryNo', group: 'find', criteria: ['deliveryNo'], control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'documentNo', group: 'find', criteria: ['documentNo'], control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'orderNo', group: 'find', criteria: ['orderNo'], control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'customerPhone', group: 'find', criteria: ['customerPhone'], control: { kind: 'text', type: 'tel' }, value: 'machine' },
  { id: 'storeCode', group: 'narrow', criteria: ['storeCode'], control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'documentType', group: 'narrow', criteria: ['documentType'], control: { kind: 'lookup', lookup: 'documentTypes' }, value: 'text' },
  { id: 'documentSource', group: 'narrow', criteria: ['documentSource'], control: { kind: 'lookup', lookup: 'documentSources' }, value: 'text' },
  { id: 'deliveryDocumentType', group: 'narrow', criteria: ['deliveryDocumentType'], control: { kind: 'lookup', lookup: 'deliveryDocumentTypes' }, value: 'text' },
  { id: 'deliveryType', group: 'narrow', criteria: ['deliveryType'], control: { kind: 'choice', options: DELIVERY_TYPE_OPTIONS }, value: 'text' },
  { id: 'isExpress', group: 'narrow', criteria: ['isExpress'], control: { kind: 'yesNo' }, value: 'word' },
  { id: 'documentReason', group: 'narrow', criteria: ['documentReason'], control: { kind: 'text', type: 'text' }, value: 'text' },
  { id: 'limit', group: 'rows', criteria: ['limit'], control: { kind: 'limit' }, value: 'machine' },
]

export function fieldDef(field: QueryField): QueryFieldDef {
  const def = QUERY_FIELDS.find((f) => f.id === field)
  if (!def) throw new Error(`Unknown query field: ${field}`)
  return def
}

/** The blank search: no criteria, the default Limit — the blank panel's own value. */
export const BLANK_QUERY: QueryCriteria = (() => {
  const { fromDate: _from, toDate: _to, ...rest } = BLANK_CRITERIA
  return { ...rest, date: null }
})()

/** The draft with one entry set. A blank text box is stored as `null`, which means "no filter". */
export function withField<F extends QueryField>(query: QueryCriteria, field: F, value: QueryCriteria[F]): QueryCriteria {
  return { ...query, [field]: value === '' ? null : value }
}

const blankText = (value: unknown) => typeof value === 'string' && value.trim() === ''

/**
 * Whether the entry is in the search: set, and not blank text. The Limit always is. A Custom
 * Date missing an end is not: the search would send no range for it, so the bar must not show
 * it as one.
 */
export function inSearch(query: QueryCriteria, field: QueryField): boolean {
  if (field === 'limit') return true
  if (field === 'date') {
    const date = query.date
    if (date === null) return false
    return date.preset !== 'custom' || (fromIsoDate(date.from) !== null && fromIsoDate(date.to) !== null)
  }
  const value = query[field]
  return value !== null && value !== undefined && !blankText(value)
}

/** One token: the entry and its value as the model holds it. */
export interface CriterionToken {
  field: QueryField
  value: QueryCriteria[QueryField]
}

/** The search as tokens, in bar order: one per criterion in it, then the Limit. */
export function tokensOf(query: QueryCriteria): CriterionToken[] {
  return QUERY_FIELDS.filter((f) => inSearch(query, f.id)).map((f) => ({ field: f.id, value: query[f.id] }))
}

/** The tokens back into the search. An entry with no token is no filter. */
export function queryOfTokens(tokens: readonly CriterionToken[]): QueryCriteria {
  return tokens.reduce<QueryCriteria>((query, token) => ({ ...query, [token.field]: token.value }), BLANK_QUERY)
}

/** Local midnight, `days` before `now`'s own day. */
function dayBefore(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
}

/**
 * The Date entry as a concrete From/To against `now`, both at local midnight (the estate is
 * single-timezone local time, so no UTC round trip). `null` when there is no range to send:
 * no Date, or a Custom range missing an end — the search then sends neither, as the panel did.
 */
export function resolveDate(entry: DateEntry | null, now: Date): { from: Date; to: Date } | null {
  if (!entry) return null
  switch (entry.preset) {
    case 'today':
      return { from: dayBefore(now, 0), to: dayBefore(now, 0) }
    case 'yesterday':
      return { from: dayBefore(now, 1), to: dayBefore(now, 1) }
    case 'last3':
      return { from: dayBefore(now, 2), to: dayBefore(now, 0) }
    case 'last7':
      return { from: dayBefore(now, 6), to: dayBefore(now, 0) }
    case 'custom': {
      const from = fromIsoDate(entry.from)
      const to = fromIsoDate(entry.to)
      return from && to ? { from, to } : null
    }
  }
}

/**
 * The search the list read runs, resolved at search time: the relative Date becomes a concrete
 * From/To against `now`, and everything else passes through unchanged into the one contract
 * `buildDeliveryQuery` already serves.
 */
export function toFilterCriteria(query: QueryCriteria, now: Date): DeliveryFilterCriteria {
  const { date, ...rest } = query
  const range = resolveDate(date, now)
  return { ...rest, fromDate: range?.from ?? null, toDate: range?.to ?? null }
}

/** The Limit the query searches with: a cleared or invalid one is the default. */
export function limitOf(query: Pick<QueryCriteria, 'limit'>): number {
  return effectiveLimit({ ...BLANK_CRITERIA, limit: query.limit })
}

/** A value as a search sees it, so a padded box or a cleared Limit is not mistaken for an edit. */
function normalised(query: QueryCriteria, field: QueryField): unknown {
  if (field === 'limit') return limitOf(query)
  if (!inSearch(query, field)) return null
  const value = query[field]
  if (typeof value === 'string') return value.trim()
  if (field === 'date' && query.date?.preset === 'custom') {
    return { preset: 'custom', from: query.date.from?.trim() || null, to: query.date.to?.trim() || null }
  }
  return value
}

const sameValue = (a: QueryCriteria, b: QueryCriteria, field: QueryField) =>
  JSON.stringify(normalised(a, field)) === JSON.stringify(normalised(b, field))

/** The unapplied edits: what the draft changed, removed and added since the last search ran. */
export interface PendingDiff {
  edited: QueryField[]
  removed: QueryField[]
  added: QueryField[]
  /** "N changes not searched". */
  count: number
}

/** The draft against the last search that ran — or, before any search, the blank query. */
export function pendingDiff(draft: QueryCriteria, lastRun: QueryCriteria | null): PendingDiff {
  const base = lastRun ?? BLANK_QUERY
  const diff: PendingDiff = { edited: [], removed: [], added: [], count: 0 }
  for (const { id } of QUERY_FIELDS) {
    const inDraft = inSearch(draft, id)
    const inBase = inSearch(base, id)
    if (inDraft && inBase) {
      if (!sameValue(draft, base, id)) diff.edited.push(id)
    } else if (inBase) diff.removed.push(id)
    else if (inDraft) diff.added.push(id)
  }
  diff.count = diff.edited.length + diff.removed.length + diff.added.length
  return diff
}

/**
 * - `applied` — in the search that ran, unchanged;
 * - `edited` / `added` — changed or new since then: dashed amber;
 * - `ghost` — removed since then: struck through, with a restore.
 */
export type TokenState = 'applied' | 'edited' | 'added' | 'ghost'

export interface BarToken extends CriterionToken {
  state: TokenState
}

/**
 * The tokens the bar draws before + Filter, in bar order (the Limit is drawn on its own at the
 * inline end). A ghost shows the value that ran. The entry whose popover is open (`editing`)
 * shows even while its value is still blank, so a token being added has somewhere to sit.
 */
export function barTokens(draft: QueryCriteria, lastRun: QueryCriteria | null, editing: QueryField | null): BarToken[] {
  const base = lastRun ?? BLANK_QUERY
  const tokens: BarToken[] = []
  for (const { id } of QUERY_FIELDS) {
    if (id === 'limit') continue
    const inDraft = inSearch(draft, id)
    const inBase = inSearch(base, id)
    if (inDraft && inBase) tokens.push({ field: id, value: draft[id], state: sameValue(draft, base, id) ? 'applied' : 'edited' })
    else if (inDraft) tokens.push({ field: id, value: draft[id], state: 'added' })
    else if (editing === id) tokens.push({ field: id, value: draft[id], state: inBase ? 'edited' : 'added' })
    else if (inBase) tokens.push({ field: id, value: base[id], state: 'ghost' })
  }
  return tokens
}

/** A ghost's restore: the entry goes back to the value that ran. */
export function restoreField(draft: QueryCriteria, lastRun: QueryCriteria | null, field: QueryField): QueryCriteria {
  return { ...draft, [field]: (lastRun ?? BLANK_QUERY)[field] }
}

/** Discard: the draft goes back to the last search that ran, or to blank before any search. */
export function discardedDraft(lastRun: QueryCriteria | null): QueryCriteria {
  return lastRun ?? BLANK_QUERY
}
