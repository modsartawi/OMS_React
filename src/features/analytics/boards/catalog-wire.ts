import type {
  AnalyticsAreaReader,
  AnalyticsCatalog,
  AnalyticsCatalogArea,
  AnalyticsCatalogMart,
  AnalyticsCatalogPlanned,
  AnalyticsCatalogSource,
  AnalyticsCatalogUntapped,
  AnalyticsCatalogUsedBy,
  AnalyticsLabel,
  AnalyticsMartKind,
  AnalyticsPlannedStatus,
} from '@/core/models/analytics'
import { readDimension, readMeasure, readReason } from './wire'

/**
 * Reading `GET Analytics/Catalog` (BackOffice spec 3437 §C, built in 3438–3442; ticket 841) tolerantly, like the
 * rest of the analytics wire: an absent array reads empty, an absent label `{en:'',ar:''}`, a curator-only field
 * stays `null` when the server leaves it null, and an unknown enum value is dropped (or read as the safe one).
 *
 * Pure: no React. `./api` passes the answer through here.
 */

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strs = (v: unknown): string[] => arr<unknown>(v).filter((s): s is string => typeof s === 'string' && s !== '')
const said = (v: unknown): AnalyticsLabel => ({ en: str(obj(v).en), ar: str(obj(v).ar) })
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const keyed = <T extends { key: string }>(list: T[]) => list.filter((x) => x.key !== '')

const READERS: readonly AnalyticsAreaReader[] = ['copilot', 'designer']
const MART_KINDS: readonly AnalyticsMartKind[] = ['mart', 'fact', 'dim']
const PLANNED: readonly AnalyticsPlannedStatus[] = ['idea', 'approved', 'building', 'live']

function readUsedBy(v: unknown): AnalyticsCatalogUsedBy | null {
  if (!v || typeof v !== 'object') return null
  const u = obj(v)
  return { views: num(u.views) ?? 0, boards: num(u.boards) ?? 0, reports: num(u.reports) ?? 0 }
}

export function readCatalogArea(raw: unknown): AnalyticsCatalogArea {
  const a = obj(raw)
  return {
    key: str(a.key),
    label: said(a.label),
    description: said(a.description),
    owner: str(a.owner),
    available: a.available === true,
    unavailableReason: readReason(a.unavailableReason),
    dataAsOf: str(a.dataAsOf),
    historyStart: str(a.historyStart),
    refresh: said(a.refresh),
    boundary: arr<unknown>(a.boundary).map(said),
    readBy: strs(a.readBy).filter((r): r is AnalyticsAreaReader => READERS.includes(r as AnalyticsAreaReader)),
    usedBy: readUsedBy(a.usedBy),
    access: { grant: str(obj(a.access).grant) },
    measures: arr<unknown>(a.measures).map(readMeasure),
    dimensions: arr<unknown>(a.dimensions).map(readDimension),
    marts: strs(a.marts),
  }
}

export function readCatalogMart(raw: unknown): AnalyticsCatalogMart {
  const m = obj(raw)
  const kind = str(m.kind) as AnalyticsMartKind
  return {
    key: str(m.key),
    kind: MART_KINDS.includes(kind) ? kind : 'mart',
    description: str(m.description),
    grain: str(m.grain),
    sources: strs(m.sources),
    columns: Array.isArray(m.columns)
      ? m.columns.map(obj).filter((c) => !!str(c.name)).map((c) => ({ name: str(c.name), previewable: c.previewable === true }))
      : null,
    rows: num(m.rows),
    sizeMb: num(m.sizeMb),
  }
}

function readSource(raw: unknown): AnalyticsCatalogSource {
  const s = obj(raw)
  return {
    key: str(s.key),
    server: str(s.server),
    database: str(s.database),
    table: str(s.table),
    description: str(s.description),
    usedBy: strs(s.usedBy),
  }
}

function readPlanned(raw: unknown): AnalyticsCatalogPlanned | null {
  const p = obj(raw)
  const status = str(p.status) as AnalyticsPlannedStatus
  if (!str(p.key)) return null
  return {
    key: str(p.key),
    label: said(p.label),
    // An unknown roadmap status reads as the earliest one rather than vanishing.
    status: PLANNED.includes(status) ? status : 'idea',
    questions: arr<unknown>(p.questions).map(said),
    sources: strs(p.sources),
    unknownSources: strs(p.unknownSources),
  }
}

function readUntapped(raw: unknown): AnalyticsCatalogUntapped {
  const u = obj(raw)
  return { key: str(u.key), server: str(u.server), database: str(u.database), table: str(u.table), note: str(u.note) }
}

export function readCatalog(raw: unknown): AnalyticsCatalog {
  const c = obj(raw)
  return {
    imageVersion: str(c.imageVersion),
    lineageAvailable: c.lineageAvailable === true,
    areas: keyed(arr<unknown>(c.areas).map(readCatalogArea)),
    marts: keyed(arr<unknown>(c.marts).map(readCatalogMart)),
    sources: keyed(arr<unknown>(c.sources).map(readSource)),
    planned: arr<unknown>(c.planned)
      .map(readPlanned)
      .filter((p): p is AnalyticsCatalogPlanned => p !== null),
    untappedSources: keyed(arr<unknown>(c.untappedSources).map(readUntapped)),
  }
}
