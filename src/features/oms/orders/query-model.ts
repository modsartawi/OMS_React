/**
 * The Order / ERX list's query-bar token model (ticket 786; BackOffice 3391's criteria and date
 * rule). Pure: the bar renders it, the search store keeps it, and saved views store it as it is.
 * A copy of the Deliveries list's model with the order criteria — the relative Date, the keys and
 * the Limit's bounds are shared from `@/core/list`.
 *
 * - The 15 `OrderSearchCriteria` are 14 entries: From/To is ONE **Date** entry, kept
 *   **relative** ("Last 3 days") and resolved only when a search runs ({@link toSearchCriteria}).
 * - 🚩 **3391's date rule, mirrored.** An identifier (order, document, approval, patient, mobile,
 *   member) ignores the date, so none is sent. Without one, a range is required — the bar opens on
 *   the last 3 days — and one longer than 31 days is refused here before the server would.
 * - 🚩 **Patient and member ID only with the insurance-view grant.** Without it they are not
 *   offered, not sent, and not counted as identifiers (a saved view may still carry one).
 * - The **draft** is measured against the **last search that ran** ({@link pendingDiff}).
 */
import { dateIsComplete, resolveDate, type DateEntry } from '@/core/list/relative-date'
import {
  ORDER_IDENTIFIER_FIELDS,
  ORDER_SEARCH_DATE_RULE,
  ORDER_SEARCH_DEFAULT_LIMIT,
  type MoneySource,
  type OrderSearchCriteria,
} from '@/core/models/order-document'
import { toIsoDate } from '@/core/util/date-format'
import { windowProblem } from '@/core/util/date-window'

export { DATE_PRESETS, type DateEntry } from '@/core/list/relative-date'
export { LIMIT_MAX, limitIsInvalid, QUERY_FOCUS_KEYS } from '@/core/list/list-keys'

/** The search as the bar holds it: the criteria, with From/To as one relative Date. */
export type QueryCriteria = Omit<OrderSearchCriteria, 'fromDate' | 'toDate'> & { date: DateEntry | null }

/** One entry of the bar: a criterion, or the Date that stands for From and To. */
export type QueryField = keyof QueryCriteria

/** + Filter's four groups, in this order. */
export const QUERY_GROUPS = ['when', 'find', 'narrow', 'rows'] as const
export type QueryGroup = (typeof QUERY_GROUPS)[number]

/** The coded dropdowns, read from the session-cached lookups. They send the CODE (the row's own). */
export type LookupName = 'documentTypes' | 'documentSources'

/** The money sources the Money source token offers. */
export const MONEY_SOURCES: readonly MoneySource[] = ['CHANNEL', 'ENGINE']

/** The control a token's popover holds. */
export type FieldControl =
  | { kind: 'date' }
  | { kind: 'text'; type: 'text' | 'tel' }
  | { kind: 'lookup'; lookup: LookupName }
  | { kind: 'moneySource' }
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
  control: FieldControl
  value: ValueKind
  /** Health data: offered only with the insurance-view grant. */
  insurance?: true
}

/** The 14 entries in bar and menu order: When · Find one · Narrow · Rows. */
export const QUERY_FIELDS: readonly QueryFieldDef[] = [
  { id: 'date', group: 'when', control: { kind: 'date' }, value: 'word' },
  { id: 'orderNo', group: 'find', control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'documentNo', group: 'find', control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'approval', group: 'find', control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'mobile', group: 'find', control: { kind: 'text', type: 'tel' }, value: 'machine' },
  { id: 'patientId', group: 'find', control: { kind: 'text', type: 'text' }, value: 'id', insurance: true },
  { id: 'memberId', group: 'find', control: { kind: 'text', type: 'text' }, value: 'id', insurance: true },
  { id: 'documentSource', group: 'narrow', control: { kind: 'lookup', lookup: 'documentSources' }, value: 'id' },
  { id: 'storeCode', group: 'narrow', control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'documentType', group: 'narrow', control: { kind: 'lookup', lookup: 'documentTypes' }, value: 'id' },
  { id: 'status', group: 'narrow', control: { kind: 'text', type: 'text' }, value: 'id' },
  { id: 'hasDelivery', group: 'narrow', control: { kind: 'yesNo' }, value: 'word' },
  { id: 'moneySource', group: 'narrow', control: { kind: 'moneySource' }, value: 'word' },
  { id: 'limit', group: 'rows', control: { kind: 'limit' }, value: 'machine' },
]

/** What a session may search by. */
export interface QueryGrants {
  canViewInsurance: boolean
}

/** The entries this session is offered: the patient and member ID only with the insurance grant. */
export function queryFields(grants: QueryGrants): readonly QueryFieldDef[] {
  return grants.canViewInsurance ? QUERY_FIELDS : QUERY_FIELDS.filter((f) => !f.insurance)
}

export function fieldDef(field: QueryField): QueryFieldDef {
  const def = QUERY_FIELDS.find((f) => f.id === field)
  if (!def) throw new Error(`Unknown query field: ${field}`)
  return def
}

/** The blank search: no criteria, the last 3 days, the server's default Limit. */
export const BLANK_QUERY: QueryCriteria = {
  orderNo: null,
  documentNo: null,
  approval: null,
  patientId: null,
  mobile: null,
  memberId: null,
  documentSource: null,
  storeCode: null,
  documentType: null,
  status: null,
  hasDelivery: null,
  moneySource: null,
  date: { preset: 'last3' },
  limit: ORDER_SEARCH_DEFAULT_LIMIT,
}

/** The draft with one entry set. A blank text box is stored as `null`, which means "no filter". */
export function withField<F extends QueryField>(query: QueryCriteria, field: F, value: QueryCriteria[F]): QueryCriteria {
  return { ...query, [field]: value === '' ? null : value }
}

const blankText = (value: unknown) => typeof value === 'string' && value.trim() === ''

/**
 * Whether the entry is in the search: set, and not blank text. The Limit always is. A Custom
 * Date missing an end is not: the search would send no range for it.
 */
export function inSearch(query: QueryCriteria, field: QueryField): boolean {
  if (field === 'limit') return true
  if (field === 'date') return dateIsComplete(query.date)
  const value = query[field]
  return value !== null && value !== undefined && !blankText(value)
}

/** Whether the search carries an identifier this session may use — then it ignores the date. */
export function hasIdentifier(query: QueryCriteria, grants: QueryGrants): boolean {
  return ORDER_IDENTIFIER_FIELDS.some(
    (field) => (grants.canViewInsurance || !fieldDef(field).insurance) && inSearch(query, field),
  )
}

/** Why a search may not run as it stands, or `null` when it may (3391's date rule). */
export type SearchProblem = 'needsDate' | 'rangeTooLong' | 'rangeInvalid'

export function searchProblem(query: QueryCriteria, now: Date, grants: QueryGrants): SearchProblem | null {
  if (hasIdentifier(query, grants)) return null
  const range = resolveDate(query.date, now)
  if (!range) return 'needsDate'
  const problem = windowProblem(toIsoDate(range.from), toIsoDate(range.to), { maxDays: ORDER_SEARCH_DATE_RULE.maxDays })
  if (problem === null) return null
  return problem === 'tooLong' ? 'rangeTooLong' : 'rangeInvalid'
}

/** The Limit the query searches with: a cleared or invalid one is the server's default. */
export function limitOf(query: Pick<QueryCriteria, 'limit'>): number {
  return query.limit && query.limit > 0 ? query.limit : ORDER_SEARCH_DEFAULT_LIMIT
}

const trimmed = (value: string | null) => (value?.trim() ? value.trim() : null)

/**
 * The search the door runs, resolved at search time. An identifier drops the date; otherwise the
 * relative Date becomes a concrete From/To against `now`. Patient and member ID go only with the
 * insurance grant.
 */
export function toSearchCriteria(query: QueryCriteria, now: Date, grants: QueryGrants): OrderSearchCriteria {
  const { date, ...rest } = query
  const range = hasIdentifier(query, grants) ? null : resolveDate(date, now)
  return {
    ...rest,
    orderNo: trimmed(rest.orderNo),
    documentNo: trimmed(rest.documentNo),
    approval: trimmed(rest.approval),
    mobile: trimmed(rest.mobile),
    patientId: grants.canViewInsurance ? trimmed(rest.patientId) : null,
    memberId: grants.canViewInsurance ? trimmed(rest.memberId) : null,
    documentSource: trimmed(rest.documentSource),
    storeCode: trimmed(rest.storeCode),
    documentType: trimmed(rest.documentType),
    status: trimmed(rest.status),
    limit: limitOf(query),
    fromDate: range ? toIsoDate(range.from) : null,
    toDate: range ? toIsoDate(range.to) : null,
  }
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

/** `applied` · `edited` / `added` (dashed amber) · `ghost` (removed: struck through, with a restore). */
export type TokenState = 'applied' | 'edited' | 'added' | 'ghost'

export interface BarToken {
  field: QueryField
  value: QueryCriteria[QueryField]
  state: TokenState
}

/**
 * The tokens the bar draws before + Filter, in bar order (the Limit is drawn on its own at the
 * inline end). A ghost shows the value that ran. The entry whose popover is open shows even
 * while its value is still blank, so a token being added has somewhere to sit.
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
