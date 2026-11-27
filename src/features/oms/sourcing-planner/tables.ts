/**
 * The eight planner tables (ticket 968, BackOffice spec 4354 §2, §5, §8, §19): their fields as the forms and grids read
 * them, which grant holds each, and whether the server keeps a reason with a change. BO 4375 keeps a reason (buffer
 * overrides, stock confidence); BO 4361 and 4362 keep who, when, old and new and no reason — so only those two tables
 * ask for one (owner, ticket 968 Comments).
 *
 * 🚩 PROVISIONAL (spec 4354: not specified) — every field name and value code below. The server tickets list each
 * table's content in prose and name no field.
 */
import type { Permissions } from '@/core/permissions'
import {
  OVERRIDE_LEVELS,
  PLANNER_MODES,
  RULE_GROUP_KINDS,
  RULE_KINDS,
  type PlannerTableKey,
  type PlannerValue,
  type PlannerValues,
} from '@/core/models/sourcing-planner'
import { canEditPlannerBuffer, canEditPlannerRules, canEditPlannerTables } from '@/core/sourcing-advisor/access'

export type FieldKind = 'text' | 'number' | 'date' | 'time' | 'bool' | 'select' | 'store' | 'item' | 'category' | 'listCode' | 'storeList'

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
  /** Sent by the server, never typed. */
  derived?: boolean
}

export interface TableSpec {
  key: PlannerTableKey
  fields: readonly FieldSpec[]
  /** The server keeps a reason with every change (BO 4375); otherwise none is asked. */
  reasonKept: boolean
  /** A boolean field switched straight from the list. */
  switchField?: string
}

const CARRIER_MODES = ['CARRIER_SAME_DAY', 'CARRIER_NEXT_DAY'] as const

export const TABLES: Record<PlannerTableKey, TableSpec> = {
  overrides: {
    key: 'overrides',
    reasonKept: true,
    fields: [
      { key: 'level', kind: 'select', options: OVERRIDE_LEVELS, optSet: 'level', identity: true },
      { key: 'store', kind: 'store', optional: true, identity: true },
      { key: 'item', kind: 'item', optional: true, identity: true },
      { key: 'category', kind: 'category', optional: true, identity: true },
      { key: 'keepUnits', kind: 'number', min: 0, step: 1, optional: true },
      { key: 'keepDays', kind: 'number', min: 0, step: 0.5, optional: true },
      { key: 'firstDay', kind: 'date' },
      { key: 'lastDay', kind: 'date', optional: true },
    ],
  },
  confidence: {
    key: 'confidence',
    reasonKept: true,
    fields: [
      { key: 'store', kind: 'store', identity: true },
      { key: 'confidence', kind: 'number', min: 0.6, max: 1, step: 0.05 },
      { key: 'endDay', kind: 'date' },
    ],
  },
  rules: {
    key: 'rules',
    reasonKept: false,
    switchField: 'on',
    fields: [
      { key: 'groupKind', kind: 'select', options: RULE_GROUP_KINDS, optSet: 'groupKind', identity: true },
      { key: 'group', kind: 'text', identity: true },
      { key: 'ruleKind', kind: 'select', options: RULE_KINDS, optSet: 'ruleKind', identity: true },
      { key: 'mode', kind: 'select', options: PLANNER_MODES, optSet: 'mode', identity: true },
      { key: 'stores', kind: 'storeList', optional: true },
      { key: 'on', kind: 'bool' },
    ],
  },
  restricted: {
    key: 'restricted',
    reasonKept: false,
    fields: [
      { key: 'item', kind: 'item', identity: true },
      { key: 'source', kind: 'select', options: ['SAP', 'OURS'], optSet: 'source', derived: true },
    ],
  },
  bulky: {
    key: 'bulky',
    reasonKept: false,
    fields: [
      { key: 'kind', kind: 'select', options: ['SUB_CATEGORY', 'ITEM'], optSet: 'bulkyKind', identity: true },
      { key: 'code', kind: 'listCode', identity: true },
    ],
  },
  storeModes: {
    key: 'storeModes',
    reasonKept: false,
    fields: [
      { key: 'store', kind: 'store', identity: true },
      ...PLANNER_MODES.map((m): FieldSpec => ({ key: m, kind: 'bool' })),
      { key: 'note', kind: 'text', optional: true },
    ],
  },
  contracts: {
    key: 'contracts',
    reasonKept: false,
    fields: [
      { key: 'courier', kind: 'text', identity: true },
      { key: 'mode', kind: 'select', options: CARRIER_MODES, optSet: 'mode', identity: true },
      { key: 'cities', kind: 'text' },
      { key: 'cutoff', kind: 'time' },
      { key: 'daysToDeliver', kind: 'number', min: 0, step: 1 },
      { key: 'deliveredBy', kind: 'time' },
      { key: 'rate', kind: 'number', min: 0, step: 0.5 },
      { key: 'collectionTime', kind: 'time' },
      { key: 'keepsCold', kind: 'bool' },
      { key: 'assumed', kind: 'bool' },
    ],
  },
  slots: {
    key: 'slots',
    reasonKept: false,
    switchField: 'on',
    fields: [
      { key: 'from', kind: 'time', identity: true },
      { key: 'to', kind: 'time', identity: true },
      { key: 'ordersUntil', kind: 'time' },
      { key: 'day', kind: 'select', options: ['SAME_DAY', 'NEXT_DAY'], optSet: 'day' },
      { key: 'on', kind: 'bool' },
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

export type FormProblem = { key: 'required'; field: string } | { key: 'badNumber'; field: string } | { key: 'confidenceRange' | 'endTooFar' | 'endPast' | 'needStores' }

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

/** The furthest end date a hand-set stock confidence may take (spec §5: at most 90 days ahead). */
export const confidenceLastEnd = (today: string) => addDays(today, CONFIDENCE_DAYS_AHEAD)

const blankValues: Record<Exclude<PlannerTableKey, 'overrides'>, (today: string) => PlannerValues> = {
  confidence: (today) => ({ store: null, confidence: 0.9, endDay: addDays(today, 30) }),
  rules: () => ({ groupKind: 'NAMED_LIST', group: '', ruleKind: 'NOT_BY_MODE', mode: 'DAWAA_NOW', stores: null, on: true }),
  restricted: () => ({ item: null, source: 'OURS' }),
  bulky: () => ({ kind: 'ITEM', code: null }),
  storeModes: () => ({ store: null, DAWAA_NOW: true, SLOT: true, CARRIER_SAME_DAY: true, CARRIER_NEXT_DAY: true, BEYOND_BORDER: false, PICK_UP: true, note: null }),
  contracts: () => ({
    courier: '',
    mode: 'CARRIER_SAME_DAY',
    cities: '',
    cutoff: '14:00',
    daysToDeliver: 0,
    deliveredBy: '22:00',
    rate: null,
    collectionTime: '16:00',
    keepsCold: false,
    assumed: true,
  }),
  slots: () => ({ from: '', to: '', ordersUntil: '', day: 'SAME_DAY', on: true }),
}

/** A row's values (or a new row's defaults) as the form types them. */
export function formOf(table: Exclude<PlannerTableKey, 'overrides'>, values: PlannerValues | null, today: string): RowForm {
  const v = values ?? blankValues[table](today)
  const out: RowForm = {}
  for (const f of TABLES[table].fields) {
    const x = v[f.key]
    out[f.key] = f.kind === 'bool' ? x === true : f.kind === 'storeList' ? (Array.isArray(x) ? (x as readonly string[]).join(', ') : '') : x == null ? '' : String(x)
  }
  return out
}

const isBlank = (x: string | boolean | undefined) => typeof x !== 'boolean' && (x ?? '').trim() === ''

const storeCodes = (s: string): string[] =>
  s
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean)

/** What stops a generic form from saving. */
export function formProblems(table: Exclude<PlannerTableKey, 'overrides'>, form: RowForm, today: string): FormProblem[] {
  const out: FormProblem[] = []
  for (const f of TABLES[table].fields) {
    if (f.derived || f.kind === 'bool') continue
    const x = form[f.key]
    if (!f.optional && isBlank(x)) out.push({ key: 'required', field: f.key })
    else if (f.kind === 'number' && !isBlank(x) && !Number.isFinite(Number(x))) out.push({ key: 'badNumber', field: f.key })
  }
  if (table === 'confidence' && !isBlank(form.confidence)) {
    const c = Number(form.confidence)
    if (!(c >= 0.6 && c <= 1)) out.push({ key: 'confidenceRange' })
  }
  if (table === 'confidence' && !isBlank(form.endDay)) {
    const end = String(form.endDay)
    if (end > confidenceLastEnd(today)) out.push({ key: 'endTooFar' })
    else if (end <= today) out.push({ key: 'endPast' })
  }
  if (table === 'rules' && form.ruleKind === 'ONLY_FROM_STORES' && storeCodes(String(form.stores ?? '')).length === 0) out.push({ key: 'needStores' })
  return out
}

/** The values the door is sent; null while a problem stands. */
export function formValues(table: Exclude<PlannerTableKey, 'overrides'>, form: RowForm, today: string): PlannerValues | null {
  if (formProblems(table, form, today).length > 0) return null
  const out: Record<string, PlannerValue> = {}
  for (const f of TABLES[table].fields) {
    if (f.derived) continue
    const x = form[f.key]
    if (f.kind === 'bool') out[f.key] = x === true
    else if (f.kind === 'storeList') out[f.key] = isBlank(x) ? null : storeCodes(String(x))
    else if (f.kind === 'number') out[f.key] = isBlank(x) ? null : Number(x)
    else out[f.key] = isBlank(x) ? null : String(x).trim()
  }
  return out
}
