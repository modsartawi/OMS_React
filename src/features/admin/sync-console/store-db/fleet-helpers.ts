/**
 * The Store database tab's fleet logic (oms 915, BackOffice spec 4016 D10). No React, no network — pinned by
 * `fleet-helpers.test.ts`.
 *
 * 🚩 **States come from the door.** The thresholds (Watch, Critical, Disk low, the days-to-cap window) are server
 * config: nothing here judges a store again, it only names, colours, orders and filters what `state` already says.
 */
import type { TFunction } from 'i18next'
import type { Severity } from '@/core/ui/severity'
import { STORE_DB_ENGINES, type StoreDbFleetRow, type StoreDbState } from '@/core/models/store-database'
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
  const percent = (row.capKb ?? 0) > 0 ? row.usedPercent : null
  const bar = percent == null || !Number.isFinite(percent) ? null : { percent: clampPercent(percent), sev: chip.sev }
  return { chip, bar }
}

const clampPercent = (n: number): number => Math.min(100, Math.max(0, Math.round(n * 10) / 10))

// ── Order and filters ───────────────────────────────────────────────────────────

/**
 * Worst first, as the door sorts (`StoreDatabaseFleetReads`): Critical, Disk low, Watch, Not checked, OK; a state this
 * bundle does not know last. The client sorts too, so a filter keeps the order.
 */
const STATE_RANK: Record<StoreDbState, number> = { Critical: 0, DiskLow: 1, Watch: 2, NotChecked: 3, Ok: 4 }
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

const engineRank = (e: string): number => {
  const i = (STORE_DB_ENGINES as readonly string[]).indexOf(e)
  return i < 0 ? STORE_DB_ENGINES.length : i
}

/** The engines the fleet holds (the server's labels), once each, by release — a label this bundle does not know last. */
export function fleetEngines(rows: readonly StoreDbFleetRow[]): string[] {
  return [...new Set(rows.map((r) => r.engine).filter((e): e is string => !!e))].sort((a, b) => engineRank(a) - engineRank(b) || a.localeCompare(b))
}

/** The editions the fleet holds, once each, for the edition filter. */
export function fleetEditions(rows: readonly StoreDbFleetRow[]): string[] {
  return [...new Set(rows.map((r) => r.edition).filter((e): e is string => !!e))].sort((a, b) => a.localeCompare(b))
}

/** The words for the server's bitness (`x64` / `x86`); `null` for none or a value this bundle does not know (shown raw). */
export const bitnessKey = (bitness: string | null | undefined): string | null =>
  bitness === 'x64' || bitness === 'x86' ? `storeDb.fleet.bitness.${bitness}` : null

/** A bitness in words: the known ones named, an unknown one raw, none blank. Fits a grid `valueFormatter`. */
export const bitnessText = (t: TFunction, bitness: string | null | undefined): string => {
  const key = bitnessKey(bitness)
  return key ? t(key) : (bitness ?? '')
}
