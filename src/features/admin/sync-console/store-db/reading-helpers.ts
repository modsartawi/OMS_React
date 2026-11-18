/**
 * The store page's Readings logic (oms 916, BackOffice spec 4016 / door 4031). No React, no network — pinned by
 * `reading-helpers.test.ts`.
 *
 * 🚩 **Nothing is judged again here.** State, days to cap and the growth rate are the server's; this module only
 * decides what to show and turns sizes into the shapes the view and the chart draw.
 */
import type { ChartSeriesRow } from '@/core/charts/SeriesChart'
import type { StoreDbHistoryDay, StoreDbReading, StoreDbStore } from '@/core/models/store-database'
import { KB_PER_GB, KB_PER_MB, kbSize, sharePercent, type Size } from './size'

// ── The Not checked banner ──────────────────────────────────────────────────────

export interface NotCheckedBanner {
  /** The last attempt's time; `null` when the store was never tried. */
  at: string | null
  /** The server's error text (data, shown isolated); `null` when it sent none. */
  error: string | null
}

/**
 * The banner over a store the worker could not read: shown when the server says Not checked, or when the latest
 * attempt failed (a failed attempt may land before the state is judged again). `null` = no banner.
 */
export function notCheckedBanner(store: Pick<StoreDbStore, 'state' | 'lastAttempt'>): NotCheckedBanner | null {
  const failed = store.lastAttempt?.succeeded === false
  if (store.state !== 'NotChecked' && !failed) return null
  return { at: store.lastAttempt?.takenAt ?? null, error: (failed ? store.lastAttempt?.error : null) || null }
}

// ── The history chart ───────────────────────────────────────────────────────────

/**
 * The file sizes' series keys, in drawing order. Drive free is NOT among them: it runs at a different scale (tens of
 * GB beside a 4 GB cap), so it draws on its own chart — never a second axis (dataviz rule).
 */
export const FILE_SERIES = ['used', 'allocated', 'log'] as const

const toMb = (kb: number | null | undefined): number | null => (kb == null || !Number.isFinite(kb) ? null : Math.round(kb / KB_PER_MB))
const toGb = (kb: number | null | undefined): number | null =>
  kb == null || !Number.isFinite(kb) ? null : Math.round((kb / KB_PER_GB) * 10) / 10

export interface HistoryRows {
  /** Used, allocated and log, in MB, with the cap as a flat line when the store has one. */
  files: ChartSeriesRow[]
  /** The data drive's free space, in GB to one place. */
  drive: ChartSeriesRow[]
}

/**
 * The kept daily history → the two charts' rows for `core/charts` `SeriesChart`, oldest day first. A size a day did
 * not read stays `null` and draws a gap, never a 0. The day is read as text (`yyyy-MM-dd`), never through `Date`.
 */
export function historyRows(history: readonly StoreDbHistoryDay[] | undefined, capKb: number): HistoryRows {
  const days = [...(history ?? [])].sort((a, b) => String(a.day).localeCompare(String(b.day)))
  const cap = capKb > 0 ? toMb(capKb) : null
  const files = days.map((d) => {
    const values: Record<string, number | null> = { used: toMb(d.usedKb), allocated: toMb(d.allocatedKb), log: toMb(d.logKb) }
    if (cap !== null) values.cap = cap
    return { x: d.day, label: d.day, values, slot: null }
  })
  const drive = days.map((d) => ({ x: d.day, label: d.day, values: { driveFree: toGb(d.driveFreeKb) }, slot: null }))
  return { files, drive }
}

// ── The reading in plain words ──────────────────────────────────────────────────

/** One line of the latest reading. The view puts the words (`storeDb.readings.lines.<key>`) beside the value. */
export type ReadingLine =
  | { key: 'engine'; kind: 'engine'; engine: string; version: string | null; edition: string | null; is64Bit: boolean | null }
  | { key: ReadingLineKey; kind: 'size'; size: Size | null }
  | { key: 'cap'; kind: 'noCap' }
  | { key: 'used'; kind: 'used'; size: Size | null; share: string | null }
  | { key: 'log'; kind: 'log'; used: Size | null; size: Size | null }
  | { key: ReadingLineKey; kind: 'text'; text: string | null }
  | { key: 'driveFree'; kind: 'drive'; drive: string | null; size: Size | null }
  | { key: 'uptime'; kind: 'uptime'; days: number; hours: number }
  | { key: ReadingLineKey; kind: 'count'; n: number }
  | { key: 'longestTransaction'; kind: 'age'; hours: number; minutes: number; seconds: number }
  | { key: 'longestTransaction'; kind: 'noTransaction' }
  | { key: 'lastBackup'; kind: 'backup'; at: string; size: Size | null }
  | { key: ReadingLineKey; kind: 'missing' }

export type ReadingLineKey =
  | 'engine'
  | 'cap'
  | 'used'
  | 'allocated'
  | 'freeInFile'
  | 'log'
  | 'recoveryModel'
  | 'driveFree'
  | 'machine'
  | 'cpus'
  | 'memory'
  | 'uptime'
  | 'longestTransaction'
  | 'blockedSessions'
  | 'lastBackup'

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/

/** A local wall-clock time as minutes on one scale — read as text, never through `Date`'s zone. */
function minutesOf(at: string | null | undefined): number | null {
  const m = LOCAL.exec(String(at ?? '').trim())
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  return Date.UTC(y, mo - 1, d, h, mi) / 60_000
}

/** Whole days and hours from SQL Server's start to the reading; `null` when either time is missing. */
export function uptime(startedAt: string | null | undefined, takenAt: string | null | undefined): { days: number; hours: number } | null {
  const from = minutesOf(startedAt)
  const to = minutesOf(takenAt)
  if (from === null || to === null || to < from) return null
  const hours = Math.floor((to - from) / 60)
  return { days: Math.floor(hours / 24), hours: hours % 24 }
}

const known = (n: number | null | undefined): n is number => n != null && Number.isFinite(n)

/** A count line; missing when the door did not send it (an older door, before story 15/16). */
const countLine = (key: ReadingLineKey, n: number | null | undefined): ReadingLine => (known(n) ? { key, kind: 'count', n } : { key, kind: 'missing' })

/** The longest open transaction's age (story 16) in whole hours, minutes and seconds; `0` = none open. */
function transactionLine(seconds: number | null | undefined): ReadingLine {
  if (!known(seconds)) return { key: 'longestTransaction', kind: 'missing' }
  const s = Math.max(0, Math.floor(seconds))
  if (s === 0) return { key: 'longestTransaction', kind: 'noTransaction' }
  return { key: 'longestTransaction', kind: 'age', hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}

const less = (a: number | null, b: number | null): number | null => (a == null || b == null ? null : Math.max(0, a - b))

/** The latest reading, line by line, in the panel's order; a store never read has none. */
export function readingLines(reading: StoreDbReading | null | undefined): ReadingLine[] {
  if (!reading) return []
  const r = reading
  const version = [r.productVersion, r.productLevel].filter(Boolean).join(' ') || null
  const up = uptime(r.sqlStartedAt, r.takenAt)
  return [
    { key: 'engine', kind: 'engine', engine: r.engine, version, edition: r.edition, is64Bit: r.is64Bit },
    r.capKb > 0 ? { key: 'cap', kind: 'size', size: kbSize(r.capKb) } : { key: 'cap', kind: 'noCap' },
    {
      key: 'used',
      kind: 'used',
      size: kbSize(r.dataUsedKb),
      share: r.capKb > 0 && r.dataUsedKb != null ? sharePercent(r.dataUsedKb / r.capKb) : null,
    },
    { key: 'allocated', kind: 'size', size: kbSize(r.dataAllocatedKb) },
    { key: 'freeInFile', kind: 'size', size: kbSize(less(r.dataAllocatedKb, r.dataUsedKb)) },
    { key: 'log', kind: 'log', used: kbSize(r.logUsedKb), size: kbSize(r.logAllocatedKb) },
    { key: 'recoveryModel', kind: 'text', text: r.recoveryModel },
    { key: 'driveFree', kind: 'drive', drive: r.dataDrive, size: kbSize(r.driveFreeKb) },
    { key: 'machine', kind: 'text', text: r.machineName },
    countLine('cpus', r.cpuCount),
    { key: 'memory', kind: 'size', size: kbSize(r.physicalMemoryKb) },
    up ? { key: 'uptime', kind: 'uptime', ...up } : { key: 'uptime', kind: 'missing' },
    transactionLine(r.longestOpenTransactionSeconds),
    countLine('blockedSessions', r.blockedSessions),
    r.lastFullBackupAt
      ? { key: 'lastBackup', kind: 'backup', at: r.lastFullBackupAt, size: kbSize(r.lastFullBackupSizeKb) }
      : { key: 'lastBackup', kind: 'missing' },
  ]
}

// ── Days to cap and the growth behind it ────────────────────────────────────────

export interface Growth {
  /** The server's forecast; `null` = none (flat or shrinking growth, or no cap). */
  days: number | null
  /** The rate's size a day (its magnitude — `shrinking` carries the sign). */
  perDay: Size | null
  windowDays: number | null
  /** The rate is zero or negative: the database is not growing. */
  shrinking: boolean
}

/** Days to cap with the growth rate behind it (BO 4031), as the server sent them; `null` when it sent neither. */
export function growth(store: Pick<StoreDbStore, 'daysToCap' | 'growthKbPerDay' | 'growthWindowDays'>): Growth | null {
  const rate = store.growthKbPerDay
  if (store.daysToCap == null && rate == null) return null
  return {
    days: store.daysToCap,
    perDay: rate == null ? null : kbSize(Math.abs(rate)),
    windowDays: store.growthWindowDays,
    shrinking: rate != null && rate <= 0,
  }
}
