/**
 * The eight planner tables (ticket 968, BackOffice spec 4354 §2, §5, §8, §19): their fields as the forms and grids read
 * them, which grant holds each, and what each table's doors allow. Reconciled with BackOffice at pricing2 35a4e56be:
 * - BO 4375 keeps a reason with every change and every ending (buffer overrides, stock confidence) — the only tables
 *   that ask for one (owner, ticket 968 Comments);
 * - BO 4362: a rule row is changed or switched, never ended; a list entry is added or taken off, never changed;
 * - BO 4361: a planner table row keeps a free note with its save (`note`), no reason.
 * The field names are each door's own (`@/core/models/sourcing-planner`); the checks below are the server's, read first.
 */
import type { Permissions } from '@/core/permissions'
import { BULKY_KINDS, OVERRIDE_LEVELS, PLANNER_MODES, RULE_GROUPS, RULE_REASONS } from '@/core/models/sourcing-planner'
import { canEditPlannerBuffer, canEditPlannerRules, canEditPlannerTables } from '@/core/sourcing-advisor/access'
import type { PlannerTableKey, PlannerValue, PlannerValues } from './wire'

/** `code`: a store, item, category or sub-category code typed as is; `codeList`: such codes, comma-separated. */
export type FieldKind = 'text' | 'number' | 'date' | 'time' | 'bool' | 'select' | 'code' | 'codeList'

export interface FieldSpec {
  key: string
  kind: FieldKind
  /** `select`: the codes; labels are `opt.<optSet>.<code>`. */
  options?: readonly string[]
  optSet?: string
  min?: number
  max?: number
  step?: number
  optional?: boolean
  /** Names the row: fixed once the row exists (a different one is a new row). */
  identity?: boolean
}

export interface TableSpec {
  key: PlannerTableKey
  fields: readonly FieldSpec[]
  /** The server keeps a reason with every change and ending (BO 4375); otherwise none is asked. */
  reasonKept: boolean
  /** A row may be saved again as its next version (a list entry may not: it is added or taken off). */
  changeable: boolean
  /** A row may be ended (a rule may not: it is switched off). */
  endable: boolean
  /** The list door can list ended rows (a planner table's lists only its current rows; its history is per row). */
  listsEnded: boolean
  /** A boolean field switched straight from the list. */
  switchField?: string
}

const CARRIER_MODES = ['CARRIER_SAME_DAY', 'CARRIER_NEXT_DAY'] as const
const NOTE: FieldSpec = { key: 'note', kind: 'text', optional: true }

export const TABLES: Record<PlannerTableKey, TableSpec> = {
  overrides: {
    key: 'overrides',
    reasonKept: true,
    changeable: true,
    endable: true,
    listsEnded: true,
    fields: [
      { key: 'level', kind: 'select', options: OVERRIDE_LEVELS, optSet: 'level', identity: true },
      { key: 'store', kind: 'code', optional: true, identity: true },
      { key: 'item', kind: 'code', optional: true, identity: true },
      { key: 'category', kind: 'code', optional: true, identity: true },
      { key: 'keepUnits', kind: 'number', min: 0, step: 1, optional: true },
      { key: 'keepDays', kind: 'number', min: 0, step: 0.5, optional: true },
      { key: 'firstDay', kind: 'date' },
      { key: 'lastDay', kind: 'date', optional: true },
    ],
  },
  confidence: {
    key: 'confidence',
    reasonKept: true,
    changeable: true,
    endable: true,
    listsEnded: true,
    fields: [
      { key: 'store', kind: 'code', identity: true },
      { key: 'confidence', kind: 'number', min: 0.6, max: 1, step: 0.05 },
      { key: 'endsOn', kind: 'date' },
    ],
  },
  rules: {
    key: 'rules',
    reasonKept: false,
    changeable: true,
    endable: false,
    listsEnded: true,
    switchField: 'on',
    fields: [
      { key: 'group', kind: 'select', options: RULE_GROUPS, optSet: 'group', identity: true },
      { key: 'value', kind: 'text', optional: true, identity: true },
      { key: 'mode', kind: 'select', options: PLANNER_MODES, optSet: 'mode', optional: true },
      { key: 'onlyFrom', kind: 'codeList', optional: true },
      { key: 'reason', kind: 'select', options: RULE_REASONS, optSet: 'ruleReason' },
      { key: 'on', kind: 'bool' },
      NOTE,
    ],
  },
  restricted: {
    key: 'restricted',
    reasonKept: false,
    changeable: false,
    endable: true,
    listsEnded: true,
    fields: [{ key: 'code', kind: 'code', identity: true }, NOTE],
  },
  bulky: {
    key: 'bulky',
    reasonKept: false,
    changeable: false,
    endable: true,
    listsEnded: true,
    fields: [{ key: 'kind', kind: 'select', options: BULKY_KINDS, optSet: 'bulkyKind', identity: true }, { key: 'code', kind: 'code', identity: true }, NOTE],
  },
  storeModes: {
    key: 'storeModes',
    reasonKept: false,
    changeable: true,
    endable: true,
    listsEnded: false,
    fields: [
      { key: 'store', kind: 'code', identity: true },
      { key: 'mode', kind: 'select', options: PLANNER_MODES, optSet: 'mode', identity: true },
      { key: 'gives', kind: 'bool' },
      NOTE,
    ],
  },
  contracts: {
    key: 'contracts',
    reasonKept: false,
    changeable: true,
    endable: true,
    listsEnded: false,
    fields: [
      { key: 'contract', kind: 'code', identity: true },
      { key: 'mode', kind: 'select', options: CARRIER_MODES, optSet: 'mode' },
      { key: 'courier', kind: 'code', optional: true },
      { key: 'cities', kind: 'codeList' },
      { key: 'cutOff', kind: 'time' },
      { key: 'daysToDeliver', kind: 'number', min: 0, max: 30, step: 1 },
      { key: 'deliverBy', kind: 'time' },
      { key: 'rate', kind: 'number', min: 0, step: 0.5 },
      { key: 'collectAt', kind: 'time' },
      { key: 'keepsCold', kind: 'bool' },
      { key: 'assumed', kind: 'bool' },
      NOTE,
    ],
  },
  slots: {
    key: 'slots',
    reasonKept: false,
    changeable: true,
    endable: true,
    listsEnded: false,
    fields: [
      { key: 'kind', kind: 'select', options: ['SLOT', 'NEXT_DAY_AFTER'], optSet: 'slotKind', identity: true },
      { key: 'from', kind: 'time', identity: true },
      { key: 'to', kind: 'time', optional: true },
      NOTE,
    ],
  },
}

export type GrantGroupKey = 'buffer' | 'rules' | 'tables'

/** The three planner grants and the tables each holds (spec §19). A tab shows only to its grant's holder. */
export const GRANT_GROUPS: readonly { key: GrantGroupKey; can: (p: Permissions) => boolean; tables: readonly PlannerTableKey[] }[] = [
  { key: 'buffer', can: canEditPlannerBuffer, tables: ['overrides', 'confidence'] },
  { key: 'rules', can: canEditPlannerRules, tables: ['rules', 'restricted', 'bulky'] },
  { key: 'tables', can: canEditPlannerTables, tables: ['storeModes', 'contracts', 'slots'] },
]

/** The tabs a user sees, in order: every table of every grant held. */
export const visibleTables = (p: Permissions): PlannerTableKey[] => GRANT_GROUPS.filter((g) => g.can(p)).flatMap((g) => g.tables)

// ── The generic form (every table but the overrides, whose form is `./override-form-model`) ──────────────────────────

/** A form as typed: text for every field, a boolean for a switch. */
export type RowForm = Record<string, string | boolean>

export type FormProblem =
  | { key: 'required'; field: string }
  | { key: 'badNumber'; field: string }
  | { key: 'confidenceRange' | 'confidenceDecimals' | 'endTooFar' | 'endPast' | 'needStores' | 'storesOnlyNamed' | 'needModeOrStores' | 'needValue' }
  | { key: 'excludeOnlyOpen' | 'badDaysToDeliver' | 'toAfterFrom' | 'nextDayNoEnd' }

const CONFIDENCE_DAYS_AHEAD = 90

/** `yyyy-MM-dd` of a local date, `days` after `iso`. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Today, local wall clock (`yyyy-MM-dd`). */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** The furthest end date a hand-set stock confidence may take (spec §5, BO 4375: at most 90 days ahead). */
export const confidenceLastEnd = (today: string) => addDays(today, CONFIDENCE_DAYS_AHEAD)

type Generic = Exclude<PlannerTableKey, 'overrides'>

const blankValues: Record<Generic, (today: string) => PlannerValues> = {
  confidence: (today) => ({ store: null, confidence: 0.9, endsOn: addDays(today, 30) }),
  rules: () => ({ group: 'LIST', value: '', mode: 'DAWAA_NOW', onlyFrom: null, reason: 'BULKY', on: true, note: null }),
  restricted: () => ({ code: null, note: null }),
  bulky: () => ({ kind: 'ITEM', code: null, note: null }),
  storeModes: () => ({ store: null, mode: 'SLOT', gives: true, note: null }),
  contracts: () => ({
    contract: '',
    mode: 'CARRIER_SAME_DAY',
    courier: '',
    cities: null,
    cutOff: '14:00',
    daysToDeliver: 0,
    deliverBy: '22:00',
    rate: null,
    collectAt: '16:00',
    keepsCold: false,
    assumed: true,
    note: null,
  }),
  slots: () => ({ kind: 'SLOT', from: '', to: '', note: null }),
}

/** A row's values (or a new row's defaults) as the form types them. */
export function formOf(table: Generic, values: PlannerValues | null, today: string): RowForm {
  const v = values ?? blankValues[table](today)
  const out: RowForm = {}
  for (const f of TABLES[table].fields) {
    const x = v[f.key]
    out[f.key] = f.kind === 'bool' ? x === true : f.kind === 'codeList' ? (Array.isArray(x) ? (x as readonly string[]).join(', ') : '') : x == null ? '' : String(x)
  }
  return out
}

const isBlank = (x: string | boolean | undefined) => typeof x !== 'boolean' && (x ?? '').trim() === ''

const codeList = (s: string): string[] =>
  s
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean)

/** The modes every open store ships by unless a row excludes it (BO 4361 `StoreByMode.OpenToEveryStore`). */
const OPEN_TO_EVERY_STORE = ['DAWAA_NOW', 'PICK_UP']

/** What stops a generic form from saving: the server's own checks, read first. */
export function formProblems(table: Generic, form: RowForm, today: string): FormProblem[] {
  const out: FormProblem[] = []
  for (const f of TABLES[table].fields) {
    if (f.kind === 'bool') continue
    const x = form[f.key]
    if (!f.optional && isBlank(x)) out.push({ key: 'required', field: f.key })
    else if (f.kind === 'number' && !isBlank(x) && !Number.isFinite(Number(x))) out.push({ key: 'badNumber', field: f.key })
  }
  if (table === 'confidence' && !isBlank(form.confidence)) {
    const c = Number(form.confidence)
    if (!(c >= 0.6 && c <= 1)) out.push({ key: 'confidenceRange' })
    else if (Math.abs(Math.round(c * 100) - c * 100) > 1e-9) out.push({ key: 'confidenceDecimals' })
  }
  if (table === 'confidence' && !isBlank(form.endsOn)) {
    const end = String(form.endsOn)
    if (end > confidenceLastEnd(today)) out.push({ key: 'endTooFar' })
    else if (end < today) out.push({ key: 'endPast' })
  }
  if (table === 'rules') {
    const stores = codeList(String(form.onlyFrom ?? ''))
    if (form.group !== 'COLD_CHAIN' && isBlank(form.value)) out.push({ key: 'needValue' })
    if (form.reason === 'NAMED_STORES' && stores.length === 0) out.push({ key: 'needStores' })
    if (form.reason !== 'NAMED_STORES' && stores.length > 0) out.push({ key: 'storesOnlyNamed' })
    if (isBlank(form.mode) && stores.length === 0) out.push({ key: 'needModeOrStores' })
  }
  if (table === 'storeModes' && form.gives === false && !OPEN_TO_EVERY_STORE.includes(String(form.mode))) out.push({ key: 'excludeOnlyOpen' })
  if (table === 'contracts' && !isBlank(form.daysToDeliver)) {
    const d = Number(form.daysToDeliver)
    if (!(Number.isInteger(d) && d >= 0 && d <= 30)) out.push({ key: 'badDaysToDeliver' })
  }
  if (table === 'slots') {
    if (form.kind === 'SLOT' && (isBlank(form.to) || String(form.to) <= String(form.from))) out.push({ key: 'toAfterFrom' })
    if (form.kind === 'NEXT_DAY_AFTER' && !isBlank(form.to)) out.push({ key: 'nextDayNoEnd' })
  }
  return out
}

/** The values the door is sent; null while a problem stands. */
export function formValues(table: Generic, form: RowForm, today: string): PlannerValues | null {
  if (formProblems(table, form, today).length > 0) return null
  const out: Record<string, PlannerValue> = {}
  for (const f of TABLES[table].fields) {
    const x = form[f.key]
    if (f.kind === 'bool') out[f.key] = x === true
    else if (f.kind === 'codeList') out[f.key] = isBlank(x) ? null : codeList(String(x))
    else if (f.kind === 'number') out[f.key] = isBlank(x) ? null : Number(x)
    else out[f.key] = isBlank(x) ? null : String(x).trim()
  }
  return out
}
