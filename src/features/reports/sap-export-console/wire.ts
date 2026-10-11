/**
 * The console's reads, filled where a door has not shipped all of the contract yet
 * (BackOffice spec 2579, ticket 461).
 *
 * 🚩 The model matches the contract exactly, but the doors land in steps: 2580 builds the
 * store-day door, 2581/2582 add its reasons and holds, and 2583 its flags and its verdict. So
 * each read fills a member the door did not send, at the boundary, and nothing past `api.ts`
 * ever sees a half shape — the page never crashes on a partial door:
 *
 * - no `flags` counts → every flag at 0; no `accounting` → `agrees` (the contract's own
 *   "until 2583 fills the checks");
 * - no `labels` count → 0 (the contract sends every key); no `states` → none;
 * - a row with no `flags` → `[]`, no `held` → `null`, no `reason` → `''`, no `watermark` → `null`.
 *
 * Only a MISSING (or null) member is filled. A member the door did send is passed through as
 * it is, and nothing is derived here: labels, states and verdicts stay the door's.
 */
import {
  FLAGS,
  LABELS,
  type FleetStoreRow,
  type FleetSummary,
  type Flag,
  type Label,
  type LabelCounts,
  type Paged,
  type StoreDay,
  type StoreDayRow,
} from '@/core/models/sap-export'
import { FLEET_TILE_KEYS } from './fleet-helpers'

/** Members an older door leaves out (or sends as null). */
type Partially<T, K extends keyof T> = Omit<T, K> & { [P in K]?: T[P] | null }

export type WireStoreDayRow = Partially<StoreDayRow, 'flags' | 'held' | 'reason' | 'watermark'>

export type WireStoreDay = Omit<Partially<StoreDay, 'flags' | 'accounting' | 'states'>, 'labels' | 'rows'> & {
  labels: Partial<LabelCounts>
  rows: Omit<Paged<StoreDayRow>, 'items'> & { items: WireStoreDayRow[] }
}

function countsOf<K extends string>(keys: readonly K[], sent: Partial<Record<K, number>> | null | undefined): Record<K, number> {
  const filled = { ...(sent ?? {}) } as Record<K, number>
  for (const k of keys) filled[k] = sent?.[k] ?? 0
  return filled
}

function normaliseRow(row: WireStoreDayRow): StoreDayRow {
  return { ...row, flags: row.flags ?? [], held: row.held ?? null, reason: row.reason ?? '', watermark: row.watermark ?? null }
}

/** `GET SapExport/StoreDay`. */
export function normaliseStoreDay(data: WireStoreDay): StoreDay {
  return {
    ...data,
    labels: countsOf<Label>(LABELS, data.labels),
    states: data.states ?? {},
    flags: countsOf<Flag>(FLAGS, data.flags),
    accounting: data.accounting ?? 'agrees',
    rows: { ...data.rows, items: data.rows.items.map(normaliseRow) },
  }
}

// ── Fleet (2584) ────────────────────────────────────────────────────────────────

/**
 * A fleet row as a door may send it: 2584 reads the rollup, whose flag counts and break days
 * come with 2583's checks, so those may be missing on a door that shipped first.
 */
export type WireFleetStoreRow = Omit<Partially<FleetStoreRow, 'states' | 'flags' | 'breakDays' | 'legacyStalled' | 'legacyInventoryGated'>, 'labels'> & {
  labels: Partial<LabelCounts>
}

export type WireFleet = Omit<Paged<FleetStoreRow>, 'items'> & { items: WireFleetStoreRow[] }

export type WireFleetSummary = Omit<FleetSummary, 'tiles'> & { tiles: Partial<FleetSummary['tiles']> }

/** `GET SapExport/Fleet/Summary`: a tile a door does not count yet reads 0. */
export function normaliseFleetSummary(data: WireFleetSummary): FleetSummary {
  return { ...data, tiles: countsOf(FLEET_TILE_KEYS, data.tiles) }
}

function normaliseFleetRow(row: WireFleetStoreRow): FleetStoreRow {
  return {
    ...row,
    labels: countsOf<Label>(LABELS, row.labels),
    states: row.states ?? {},
    flags: countsOf<Flag>(FLAGS, row.flags),
    breakDays: row.breakDays ?? 0,
    legacyStalled: row.legacyStalled ?? false,
    legacyInventoryGated: row.legacyInventoryGated ?? false,
  }
}

/** `GET SapExport/Fleet`. */
export function normaliseFleet(data: WireFleet): Paged<FleetStoreRow> {
  return { ...data, items: data.items.map(normaliseFleetRow) }
}
