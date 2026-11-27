/**
 * The product rule rows (ticket 968, BackOffice spec 4354 §8, BO 4362): a row says an item group may not ship by a
 * mode, or may ship only from named stores, and has a switch. The owner's pick (variant A, ticket 968 Comments): a
 * list of rows, by item group and then by mode. Whoever holds the product rules grant switches any row, a rule that
 * guards a medicine too, with no extra step; BO 4362 keeps no reason, so a switch asks for none.
 *
 * 🚩 PROVISIONAL (spec 4354: not specified) — the field names `groupKind`, `group`, `ruleKind`, `mode`, `stores`,
 * `on` and their codes (`@/core/models/sourcing-planner`).
 */
import {
  PLANNER_MODES,
  RULE_GROUP_KINDS,
  type PlannerChangeRequest,
  type PlannerMode,
  type PlannerRow,
  type RuleGroupKind,
  type RuleKind,
} from '@/core/models/sourcing-planner'

export interface RuleRow {
  id: string
  groupKind: RuleGroupKind
  /** The group's code: a class, a status, a list's code, or one item's code. */
  group: string
  /** The name the server sends for the group (one item's name), when it sends one. */
  groupName: string | null
  ruleKind: RuleKind
  mode: PlannerMode
  stores: string[]
  on: boolean
  row: PlannerRow
}

export interface RuleGroup {
  key: string
  groupKind: RuleGroupKind
  group: string
  groupName: string | null
  rows: RuleRow[]
  on: number
  off: number
}

const order = <T extends string>(list: readonly T[], v: string) => {
  const i = list.indexOf(v as T)
  return i < 0 ? list.length : i
}

function ruleRowOf(r: PlannerRow): RuleRow {
  const v = r.values
  return {
    id: r.id,
    groupKind: v.groupKind as RuleGroupKind,
    group: String(v.group ?? ''),
    groupName: r.names?.group ?? null,
    ruleKind: v.ruleKind as RuleKind,
    mode: v.mode as PlannerMode,
    stores: Array.isArray(v.stores) ? [...(v.stores as readonly string[])] : [],
    on: v.on === true,
    row: r,
  }
}

/** The rows in force, by group kind, then group, then mode in the six modes' order. */
export function ruleRows(rows: readonly PlannerRow[]): RuleRow[] {
  return rows
    .filter((r) => !r.endedAt)
    .map(ruleRowOf)
    .sort(
      (a, b) =>
        order(RULE_GROUP_KINDS, a.groupKind) - order(RULE_GROUP_KINDS, b.groupKind) ||
        a.group.localeCompare(b.group) ||
        order(PLANNER_MODES, a.mode) - order(PLANNER_MODES, b.mode) ||
        a.ruleKind.localeCompare(b.ruleKind),
    )
}

/** The rows in force grouped by item group, with how many switches are on and off. */
export function ruleGroups(rows: readonly PlannerRow[]): RuleGroup[] {
  const out: RuleGroup[] = []
  for (const r of ruleRows(rows)) {
    const key = `${r.groupKind}:${r.group}`
    let g = out.find((x) => x.key === key)
    if (!g) {
      g = { key, groupKind: r.groupKind, group: r.group, groupName: r.groupName, rows: [], on: 0, off: 0 }
      out.push(g)
    }
    g.rows.push(r)
    if (r.on) g.on++
    else g.off++
  }
  return out
}

/** The change a click on a row's switch sends: the version on screen, its switch flipped, nothing else. */
export function switchRequest(row: PlannerRow): PlannerChangeRequest {
  return { rowId: row.id, values: { ...row.values, on: row.values.on !== true } }
}
