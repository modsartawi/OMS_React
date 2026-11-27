/**
 * The product rule rows (ticket 968, BackOffice spec 4354 §8; BO 4362 `ProductRuleEndpoints`, pricing2 35a4e56be): a
 * row keeps an item group (an A class, the cold chain, a SAP status, one of our lists, one item) off a mode, or on named
 * stores only, says why, and has a switch. The owner's pick (variant A, ticket 968 Comments): a list of rows, by item
 * group and then by mode. Whoever holds the product rules grant switches any row, a rule that guards a medicine too,
 * with no extra step; BO 4362 keeps no reason, so a switch asks for none (`switchCall` in `./wire`).
 */
import { PLANNER_MODES, RULE_GROUPS, type RuleGroup, type RuleReason } from '@/core/models/sourcing-planner'
import type { PlannerRow } from './wire'

export interface RuleRow {
  /** The rule's id across its rows. */
  rule: string
  group: RuleGroup
  /** The group's value: an A class, a SAP status, a list's name, an item's code; null for the cold chain. */
  value: string | null
  /** Null for a row that names stores and no mode. */
  mode: string | null
  onlyFrom: string[]
  reason: RuleReason
  on: boolean
  row: PlannerRow
}

export interface RuleGroupRows {
  key: string
  group: RuleGroup
  value: string | null
  rows: RuleRow[]
  on: number
  off: number
}

const order = (list: readonly string[], v: string | null) => {
  const i = v == null ? -1 : list.indexOf(v)
  return i < 0 ? list.length : i
}

function ruleRowOf(r: PlannerRow): RuleRow {
  const v = r.values
  return {
    rule: r.key,
    group: v.group as RuleGroup,
    value: v.value == null ? null : String(v.value),
    mode: v.mode == null ? null : String(v.mode),
    onlyFrom: Array.isArray(v.onlyFrom) ? [...(v.onlyFrom as readonly string[])] : [],
    reason: v.reason as RuleReason,
    on: v.on === true,
    row: r,
  }
}

/** The rows in force, by group, then the group's value, then mode in the six modes' order. */
export function ruleRows(rows: readonly PlannerRow[]): RuleRow[] {
  return rows
    .filter((r) => !r.endedAt)
    .map(ruleRowOf)
    .sort(
      (a, b) =>
        order(RULE_GROUPS, a.group) - order(RULE_GROUPS, b.group) ||
        (a.value ?? '').localeCompare(b.value ?? '') ||
        order(PLANNER_MODES, a.mode) - order(PLANNER_MODES, b.mode) ||
        a.rule.localeCompare(b.rule),
    )
}

/** The rows in force grouped by item group, with how many switches are on and off. */
export function ruleGroups(rows: readonly PlannerRow[]): RuleGroupRows[] {
  const out: RuleGroupRows[] = []
  for (const r of ruleRows(rows)) {
    const key = `${r.group}:${r.value ?? ''}`
    let g = out.find((x) => x.key === key)
    if (!g) {
      g = { key, group: r.group, value: r.value, rows: [], on: 0, off: 0 }
      out.push(g)
    }
    g.rows.push(r)
    if (r.on) g.on++
    else g.off++
  }
  return out
}

/**
 * The rows whose switch waits on its answer (review 2 #5): each switch is held until its own answer comes, so a row
 * cannot be switched twice while another row's switch is in flight. Null when the row is waiting already.
 */
export function switchStarted(pending: ReadonlySet<string>, rowId: string): ReadonlySet<string> | null {
  return pending.has(rowId) ? null : new Set([...pending, rowId])
}

/** The rows still waiting once a row's switch is answered, done or refused. */
export function switchEnded(pending: ReadonlySet<string>, rowId: string): ReadonlySet<string> {
  const next = new Set(pending)
  next.delete(rowId)
  return next
}
