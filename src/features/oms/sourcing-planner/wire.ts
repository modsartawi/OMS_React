/**
 * The planner doors as the screen meets them (ticket 968), reconciled with BackOffice at pricing2 35a4e56be. Pure.
 *
 * The server has three families of doors, each with its own shapes (`@/core/models/sourcing-planner`): BO 4375 for
 * buffer overrides and stock confidence, BO 4362 for the product rules and the two lists, BO 4361 for the three planner
 * tables. The screen keeps ONE row shape (`PlannerRow`: a version's values by field, who set it and when, its ending) and
 * one history (`PlannerChange`), so the owner's variant A — a tab per table, a side sheet per row with its own history —
 * reads every table alike. This module reads each reply into rows, finds a row's versions, and writes each change to
 * its door in the door's own body.
 *
 * Only the planner tables have a history door (`PlannerTables/History`); the other doors list ended rows on asking
 * (`withEnded`, `withHistory`), and a row's versions are found among them: an override by its `replaces`/`replacedBy`
 * chain, a store's confidence by its store, a rule by its rule id, a list entry by its list, kind and code.
 */
import type {
  BufferOverrideView,
  PlannerRowReply,
  PlannerTableName,
  ProductListRow,
  ProductRuleListing,
  ProductRuleRow,
  StoreConfidenceView,
} from '@/core/models/sourcing-planner'

/** The eight tabs. */
export type PlannerTableKey = 'overrides' | 'confidence' | 'rules' | 'restricted' | 'bulky' | 'storeModes' | 'contracts' | 'slots'

/** One field's value: a list field (stores, cities) is a list of codes. */
export type PlannerValue = string | number | boolean | readonly string[] | null
export type PlannerValues = Readonly<Record<string, PlannerValue>>

/** One version of a planner row, whichever door it came from. */
export interface PlannerRow {
  id: string
  /** What names the row across its versions (an override: its own id; a rule: its rule id; a table row: its key). */
  key: string
  values: PlannerValues
  setAt: string
  setBy: string
  replaces?: string | null
  replacedBy?: string | null
  endedAt?: string | null
  endedBy?: string | null
  /** The reason kept with the version (BO 4375 tables only) and with its ending. */
  reason?: string | null
  endReason?: string | null
  /** In force but past its last day (an override) or its end date (a confidence): the run no longer reads it. */
  flag?: 'EXPIRED' | 'PAST_END' | null
}

export type PlannerChangeAction = 'ADD' | 'CHANGE' | 'END' | 'SWITCH_ON' | 'SWITCH_OFF'

export interface PlannerDiff {
  field: string
  old: PlannerValue
  new: PlannerValue
}

/** One change of a row: what was done, who, when, each field's old and new value, and the reason where one is kept. */
export interface PlannerChange {
  id: string
  rowId: string
  action: PlannerChangeAction
  diffs: PlannerDiff[]
  reason?: string | null
  by: string
  at: string
}

export const PLANNER_TABLES: Readonly<Record<Exclude<PlannerTableKey, 'overrides' | 'confidence' | 'rules' | 'restricted' | 'bulky'>, PlannerTableName>> = {
  storeModes: 'storeModes',
  contracts: 'carrierContracts',
  slots: 'slotRules',
}
const isPlannerTable = (t: PlannerTableKey): t is keyof typeof PLANNER_TABLES => t in PLANNER_TABLES
const LIST_OF = { restricted: 'RESTRICTED', bulky: 'BULKY' } as const

const blank = (s: string | null | undefined) => (s == null || s === '' ? null : s)

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The door a tab reads, and its query. Ended rows come on asking, except a planner table's, which has none to list. */
export function readCall(table: PlannerTableKey, withEnded: boolean): { path: string; params: Record<string, string | null> } {
  const asked = withEnded ? 'true' : null
  if (table === 'overrides') return { path: 'SourcingAdvisor/BufferOverrides', params: { withEnded: asked } }
  if (table === 'confidence') return { path: 'SourcingAdvisor/StoreConfidences', params: { withEnded: asked } }
  if (isPlannerTable(table)) return { path: 'SourcingAdvisor/PlannerTables', params: { table: PLANNER_TABLES[table] } }
  return { path: 'SourcingAdvisor/ProductRules', params: { withHistory: asked } }
}

const overrideRow = (o: BufferOverrideView): PlannerRow => ({
  id: o.id,
  key: o.id,
  values: {
    level: o.level,
    store: blank(o.store),
    item: blank(o.item),
    category: blank(o.category),
    keepUnits: o.keepUnits ?? null,
    keepDays: o.keepDays ?? null,
    firstDay: o.firstDay,
    lastDay: o.lastDay ?? null,
  },
  setAt: o.createdAt,
  setBy: o.createdBy,
  replaces: o.replaces ?? null,
  replacedBy: o.replacedBy ?? null,
  endedAt: o.ended ? (o.endedAt ?? null) : null,
  endedBy: o.endedBy ?? null,
  reason: o.reason,
  endReason: o.endReason ?? null,
  flag: o.expired ? 'EXPIRED' : null,
})

const confidenceRow = (c: StoreConfidenceView): PlannerRow => ({
  id: c.id,
  key: c.store,
  values: { store: c.store, confidence: c.confidence, endsOn: c.endsOn },
  setAt: c.createdAt,
  setBy: c.createdBy,
  endedAt: c.ended ? (c.endedAt ?? null) : null,
  endedBy: c.endedBy ?? null,
  reason: c.reason,
  endReason: c.endReason ?? null,
  flag: c.pastEndDate ? 'PAST_END' : null,
})

const ended = (r: { ended: boolean; endedAt?: string | null; endedBy?: string | null }) => ({
  endedAt: r.ended ? (r.endedAt ?? null) : null,
  endedBy: r.endedBy ?? null,
})

const ruleRow = (r: ProductRuleRow): PlannerRow => ({
  id: `${r.rule}@${r.startedAt}`,
  key: r.rule,
  values: {
    group: r.group,
    value: blank(r.value),
    mode: blank(r.mode),
    onlyFrom: r.onlyFrom.length ? [...r.onlyFrom] : null,
    reason: r.reason,
    on: r.on,
    note: blank(r.note),
  },
  setAt: r.startedAt,
  setBy: r.startedBy,
  ...ended(r),
})

const listRow = (l: ProductListRow): PlannerRow => {
  const key = `${l.list}|${l.kind}|${l.code}`
  return {
    id: `${key}@${l.startedAt}`,
    key,
    values: l.list === 'RESTRICTED' ? { code: l.code, note: blank(l.note) } : { kind: l.kind, code: l.code, note: blank(l.note) },
    setAt: l.startedAt,
    setBy: l.startedBy,
    ...ended(l),
  }
}

const tableRow = (r: PlannerRowReply): PlannerRow => {
  const values: Record<string, PlannerValue> = {}
  for (const [k, v] of Object.entries(r.row)) values[k] = Array.isArray(v) ? [...(v as string[])] : ((v ?? null) as PlannerValue)
  values.note = blank(r.note)
  return { id: r.id, key: r.key, values, setAt: r.addedAt, setBy: r.addedBy, replaces: r.replaces ?? null, ...ended(r) }
}

/** A door's reply read into the tab's rows. */
export function rowsOf(table: PlannerTableKey, reply: unknown): PlannerRow[] {
  if (table === 'overrides') return (reply as BufferOverrideView[]).map(overrideRow)
  if (table === 'confidence') return (reply as StoreConfidenceView[]).map(confidenceRow)
  if (isPlannerTable(table)) return (reply as PlannerRowReply[]).map(tableRow)
  const listing = reply as ProductRuleListing
  if (table === 'rules') return listing.rules.map(ruleRow)
  return listing.lists.filter((l) => l.list === LIST_OF[table]).map(listRow)
}

/** A planner table's history door for one row's key; null for the tables whose versions are read off their list. */
export function historyCall(table: PlannerTableKey, row: PlannerRow): { path: string; params: Record<string, string> } | null {
  return isPlannerTable(table) ? { path: 'SourcingAdvisor/PlannerTables/History', params: { table: PLANNER_TABLES[table], key: row.key } } : null
}

const byTime = (a: PlannerRow, b: PlannerRow) => a.setAt.localeCompare(b.setAt) || a.id.localeCompare(b.id)

/** Every version of the row, oldest first, found in a list that holds the ended rows too. */
export function versionsOf(table: PlannerTableKey, all: readonly PlannerRow[], row: PlannerRow): PlannerRow[] {
  if (table !== 'overrides') return all.filter((r) => r.key === row.key).sort(byTime)
  const byId = new Map(all.map((r) => [r.id, r]))
  const chain = [row]
  for (let r = row; r.replaces && byId.has(r.replaces) && !chain.includes(byId.get(r.replaces)!); ) chain.unshift((r = byId.get(r.replaces)!))
  for (let r = row; r.replacedBy && byId.has(r.replacedBy) && !chain.includes(byId.get(r.replacedBy)!); ) chain.push((r = byId.get(r.replacedBy)!))
  return chain
}

const same = (a: PlannerValue | undefined, b: PlannerValue | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const isSet = (v: PlannerValue | undefined) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)

/** Whether `next` took `prev`'s place in one change (the server ends the one and writes the other in one go). */
const succeeds = (prev: PlannerRow, next: PlannerRow) =>
  next.replaces === prev.id || prev.replacedBy === next.id || (!!prev.endedAt && prev.endedAt === next.setAt)

/** The row's changes, newest first, read off its versions (oldest first). */
export function historyOf(table: PlannerTableKey, versions: readonly PlannerRow[]): PlannerChange[] {
  const out: PlannerChange[] = []
  versions.forEach((v, i) => {
    const prev = i > 0 && succeeds(versions[i - 1], v) ? versions[i - 1] : null
    const fields = [...new Set([...Object.keys(prev?.values ?? {}), ...Object.keys(v.values)])]
    const diffs = prev
      ? fields.filter((f) => !same(prev.values[f], v.values[f])).map((f) => ({ field: f, old: prev.values[f] ?? null, new: v.values[f] ?? null }))
      : Object.keys(v.values)
          .filter((f) => isSet(v.values[f]))
          .map((f) => ({ field: f, old: null, new: v.values[f] }))
    const switched = table === 'rules' && prev && diffs.length === 1 && diffs[0].field === 'on'
    out.push({
      id: v.id,
      rowId: v.id,
      action: !prev ? 'ADD' : switched ? (v.values.on === true ? 'SWITCH_ON' : 'SWITCH_OFF') : 'CHANGE',
      diffs: switched ? [] : diffs,
      reason: v.reason ?? null,
      by: v.setBy,
      at: v.setAt,
    })
    const next = versions[i + 1]
    if (v.endedAt && !(next && succeeds(v, next)))
      out.push({ id: `${v.id}-end`, rowId: v.id, action: 'END', diffs: [], reason: v.endReason ?? null, by: v.endedBy ?? '', at: v.endedAt })
  })
  return out.reverse()
}

// ── Writing ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface DoorCall {
  path: string
  body: unknown
}

const text = (v: PlannerValue | undefined) => (v == null ? '' : String(v))
const codes = (v: PlannerValue | undefined): string[] => (Array.isArray(v) ? [...v] : [])

const ruleBody = (values: PlannerValues) => ({
  group: values.group,
  value: text(values.value),
  mode: text(values.mode),
  onlyFrom: codes(values.onlyFrom),
  reason: values.reason,
  on: values.on === true,
  note: text(values.note),
})

/** A table row's own shape, the note taken out (it is the save's, not the row's). */
function tableRowShape(table: keyof typeof PLANNER_TABLES, values: PlannerValues): Record<string, unknown> {
  if (table === 'storeModes') return { store: values.store, mode: values.mode, gives: values.gives === true }
  if (table === 'slots') return { kind: values.kind, from: values.from, to: values.to ?? null }
  return {
    contract: values.contract,
    mode: values.mode,
    courier: text(values.courier),
    cities: codes(values.cities),
    cutOff: values.cutOff,
    daysToDeliver: values.daysToDeliver,
    deliverBy: values.deliverBy,
    rate: values.rate,
    collectAt: values.collectAt,
    keepsCold: values.keepsCold === true,
    assumed: values.assumed === true,
  }
}

/** The save of a new row (`row` null) or of a row's next version, with the reason where the table keeps one. */
export function saveCall(table: PlannerTableKey, row: PlannerRow | null, values: PlannerValues, reason: string): DoorCall {
  const why = reason.trim()
  if (table === 'overrides')
    return {
      path: 'SourcingAdvisor/BufferOverrides/Save',
      body: {
        replaces: row?.id ?? null,
        level: values.level,
        store: values.store ?? null,
        item: values.item ?? null,
        category: values.category ?? null,
        keepUnits: values.keepUnits ?? null,
        keepDays: values.keepDays ?? null,
        firstDay: values.firstDay,
        lastDay: values.lastDay ?? null,
        reason: why,
      },
    }
  if (table === 'confidence')
    return { path: 'SourcingAdvisor/StoreConfidences/Set', body: { store: values.store, confidence: values.confidence, reason: why, endsOn: values.endsOn } }
  if (table === 'rules') return { path: 'SourcingAdvisor/ProductRules/Change', body: row ? { rule: row.key, ...ruleBody(values) } : ruleBody(values) }
  if (table === 'restricted' || table === 'bulky')
    return {
      path: 'SourcingAdvisor/ProductRules/Lists/Add',
      body: { list: LIST_OF[table], kind: table === 'restricted' ? 'ITEM' : values.kind, code: values.code, note: text(values.note) },
    }
  return { path: 'SourcingAdvisor/PlannerTables/Save', body: { table: PLANNER_TABLES[table], row: tableRowShape(table, values), note: text(values.note) } }
}

/** The ending of a row; null for a rule, which is switched off and never ended. */
export function endCall(table: PlannerTableKey, row: PlannerRow, reason: string): DoorCall | null {
  const why = reason.trim()
  if (table === 'overrides') return { path: 'SourcingAdvisor/BufferOverrides/End', body: { id: row.id, reason: why } }
  if (table === 'confidence') return { path: 'SourcingAdvisor/StoreConfidences/End', body: { id: row.values.store, reason: why } }
  if (table === 'rules') return null
  if (table === 'restricted' || table === 'bulky')
    return {
      path: 'SourcingAdvisor/ProductRules/Lists/Remove',
      body: { list: LIST_OF[table], kind: table === 'restricted' ? 'ITEM' : row.values.kind, code: row.values.code },
    }
  return { path: 'SourcingAdvisor/PlannerTables/End', body: { table: PLANNER_TABLES[table], key: row.key } }
}

/** A rule's switch flipped on the version on screen, nothing else changed (BO 4362 keeps no reason). */
export const switchCall = (row: PlannerRow): DoorCall => ({
  path: 'SourcingAdvisor/ProductRules/Change',
  body: { rule: row.key, ...ruleBody({ ...row.values, on: row.values.on !== true }) },
})
