/**
 * The Store database tab's fleet logic (oms 915, BackOffice spec 4016 D10). No React, no network — pinned by
 * `fleet-helpers.test.ts`.
 *
 * 🚩 **States come from the door.** The thresholds (Watch, Critical, Disk low, the days-to-cap window) are server
 * config: nothing here judges a store again, it only names, colours, orders and filters what `state` already says.
 */
import type { Severity } from '@/core/ui/severity'
import type { StoreDbFleetRow, StoreDbState } from '@/core/models/store-database'
import { codeBadge, type CodeBadge } from '../helpers'

// ── State → label + severity ────────────────────────────────────────────────────

/** A store not checked is never drawn healthy (spec story 6): an unreachable store is a store to look at. */
const STATE_SEVERITY: Record<StoreDbState, Severity> = {
  Ok: 'ok',
  Watch: 'warn',
  Critical: 'bad',
  DiskLow: 'bad',
  NotChecked: 'warn',
}

/** A state's badge; a state this bundle does not know is neutral with no key (shown raw). */
export const storeDbStateBadge = (state: string): CodeBadge => codeBadge(STATE_SEVERITY, 'storeDb.states', state)

// ── A row as drawn ──────────────────────────────────────────────────────────────

/** The used/cap bar: how full, in the state's colour. */
export interface UsedBar {
  percent: number
  sev: Severity
}

export interface FleetRowView {
  chip: CodeBadge
  /** `null` when there is no cap or no reading: no bar, never an empty one that reads "0 % used". */
  bar: UsedBar | null
}

export function fleetRowView(row: StoreDbFleetRow): FleetRowView {
  const chip = storeDbStateBadge(row.state)
  const share = row.capKb > 0 ? row.usedShare : null
  const bar = share == null || !Number.isFinite(share) ? null : { percent: clampPercent(share * 100), sev: chip.sev }
  return { chip, bar }
}

const clampPercent = (n: number): number => Math.min(100, Math.max(0, Math.round(n * 10) / 10))

// ── Order and filters ───────────────────────────────────────────────────────────

/**
 * Worst first (BO 4031 sorts the door the same way; the client sorts too, so an older door still reads right).
 * GUESSED rank: Critical, Disk low, Not checked, Watch, OK; a state this bundle does not know last.
 */
const STATE_RANK: Record<StoreDbState, number> = { Critical: 0, DiskLow: 1, NotChecked: 2, Watch: 3, Ok: 4 }
const stateRank = (state: string): number => (Object.hasOwn(STATE_RANK, state) ? STATE_RANK[state as StoreDbState] : 5)

/** Fewest days first; no forecast after every forecast. */
const byDays = (a: StoreDbFleetRow, b: StoreDbFleetRow): number =>
  (a.daysToCap ?? Number.POSITIVE_INFINITY) - (b.daysToCap ?? Number.POSITIVE_INFINITY)
const byState = (a: StoreDbFleetRow, b: StoreDbFleetRow): number => stateRank(a.state) - stateRank(b.state)
const byCode = (a: StoreDbFleetRow, b: StoreDbFleetRow): number => a.code.localeCompare(b.code)

/** The SQL Server Express cap a 2008 / 2008 R2 store lives under: 4 GB, in KB. */
export const FOUR_GB_KB = 4 * 1024 * 1024

export interface FleetFilter {
  /** `null` = every state. */
  state: string | null
  engine: string | null
  edition: string | null
  /** The Needs 2019 view: only the stores on a 4 GB cap, ranked by days to cap. */
  needs2019: boolean
}

export const ALL_FLEET: FleetFilter = { state: null, engine: null, edition: null, needs2019: false }

/** Whether any filter is set (the tab then says how many of the fleet it shows), field by field. */
export const fleetFiltered = (f: FleetFilter): boolean =>
  f.state !== ALL_FLEET.state || f.engine !== ALL_FLEET.engine || f.edition !== ALL_FLEET.edition || f.needs2019 !== ALL_FLEET.needs2019

/** The rows the tab shows for a filter, in the order it shows them. Filtering is client-side: the door is unpaged. */
export function shownFleet(rows: readonly StoreDbFleetRow[], filter: FleetFilter): StoreDbFleetRow[] {
  const kept = rows.filter(
    (r) =>
      (filter.state === null || r.state === filter.state) &&
      (filter.engine === null || r.engine === filter.engine) &&
      (filter.edition === null || r.edition === filter.edition) &&
      (!filter.needs2019 || r.capKb === FOUR_GB_KB),
  )
  const order = filter.needs2019
    ? (a: StoreDbFleetRow, b: StoreDbFleetRow) => byDays(a, b) || byState(a, b) || byCode(a, b)
    : (a: StoreDbFleetRow, b: StoreDbFleetRow) => byState(a, b) || byDays(a, b) || byCode(a, b)
  return kept.sort(order)
}

/** The editions the fleet holds, once each, for the edition filter. */
export function fleetEditions(rows: readonly StoreDbFleetRow[]): string[] {
  return [...new Set(rows.map((r) => r.edition).filter((e): e is string => !!e))].sort((a, b) => a.localeCompare(b))
}
