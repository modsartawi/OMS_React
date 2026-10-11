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
  type DoubleSendRow,
  type FleetStoreRow,
  type FleetSummary,
  type Flag,
  type Label,
  type IdentityBreakRow,
  type LabelCounts,
  type Paged,
  type Runner,
  type Runners,
  type StoreDay,
  type StoreDayRow,
  type StoreDays,
  type StoreDaySummary,
  type StoreDetail,
  type StoreExportFacts,
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

// ── Store (2584) ────────────────────────────────────────────────────────────────

/** A store as a door may send it: its row filled like a fleet row; the facts are 2584's own, as sent. */
export type WireStoreDetail = WireFleetStoreRow & { facts: StoreExportFacts }

/** `GET SapExport/Store`. */
export function normaliseStore(data: WireStoreDetail): StoreDetail {
  return { ...normaliseFleetRow(data), facts: data.facts }
}

/**
 * A strip day as a door may send it: counts and the verdict that come with 2583's checks may be
 * missing. `accounting: null` is the contract's own "never computed", so only an ABSENT verdict is filled.
 */
export type WireStoreDaySummary = Omit<Partially<StoreDaySummary, 'states' | 'flags'>, 'labels' | 'accounting'> & {
  labels: Partial<LabelCounts>
  accounting?: StoreDaySummary['accounting']
}

export type WireStoreDays = { items: WireStoreDaySummary[] }

/**
 * `GET SapExport/Store/Days`: each day's counts filled. A computed day with no verdict reads `agrees`,
 * as the store-day read does until 2583; a sent verdict, `null` included, and `worst` pass as sent.
 */
export function normaliseStoreDays(data: WireStoreDays): StoreDays {
  return {
    items: data.items.map((d) => ({
      ...d,
      labels: countsOf<Label>(LABELS, d.labels),
      states: d.states ?? {},
      flags: countsOf<Flag>(FLAGS, d.flags),
      accounting: d.accounting !== undefined ? d.accounting : d.noData ? null : 'agrees',
    })),
  }
}

// ── Double sends and identity breaks (2583) ─────────────────────────────────────

export type WireDoubleSendRow = Partially<DoubleSendRow, 'version' | 'legacyFile' | 'legacyUploadedAt'>
export type WireDoubleSends = Omit<Paged<DoubleSendRow>, 'items'> & { items: WireDoubleSendRow[] }

/** `GET SapExport/DoubleSends`: an absent version, legacy file or upload time reads `null`. */
export function normaliseDoubleSends(data: WireDoubleSends): Paged<DoubleSendRow> {
  return {
    ...data,
    items: data.items.map((r) => ({ ...r, version: r.version ?? null, legacyFile: r.legacyFile ?? null, legacyUploadedAt: r.legacyUploadedAt ?? null })),
  }
}

export type WireIdentityBreakRow = Partially<IdentityBreakRow, 'machineCode' | 'day'>
export type WireIdentityBreaks = Omit<Paged<IdentityBreakRow>, 'items'> & { items: WireIdentityBreakRow[] }

/** `GET SapExport/IdentityBreaks`: an absent machine or day reads `null` (the contract sends them only where they exist). */
export function normaliseIdentityBreaks(data: WireIdentityBreaks): Paged<IdentityBreakRow> {
  return { ...data, items: data.items.map((r) => ({ ...r, machineCode: r.machineCode ?? null, day: r.day ?? null })) }
}

// ── Runners (2585) ──────────────────────────────────────────────────────────────

export type WireRunner = Partially<
  Runner,
  'fromHeartbeat' | 'host' | 'lastCycleStartedAt' | 'lastCycleEndedAt' | 'lastMoved' | 'lastMessage' | 'lastNonIdleAt'
>
export type WireRunners = { items: WireRunner[] }

/**
 * `GET SapExport/Runners`: an absent time, host, count or message reads `null`. An absent
 * `fromHeartbeat` reads `false` — the card then says the row is inferred, which claims less than a
 * heartbeat the door never vouched for. Liveness stays the door's.
 */
export function normaliseRunners(data: WireRunners): Runners {
  return {
    items: data.items.map((r) => ({
      ...r,
      fromHeartbeat: r.fromHeartbeat ?? false,
      host: r.host ?? null,
      lastCycleStartedAt: r.lastCycleStartedAt ?? null,
      lastCycleEndedAt: r.lastCycleEndedAt ?? null,
      lastMoved: r.lastMoved ?? null,
      lastMessage: r.lastMessage ?? null,
      lastNonIdleAt: r.lastNonIdleAt ?? null,
    })),
  }
}
