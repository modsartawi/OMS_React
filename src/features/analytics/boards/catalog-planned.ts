import type {
  AnalyticsCatalog,
  AnalyticsCatalogPlanned,
  AnalyticsCatalogSource,
  AnalyticsCatalogUntapped,
  AnalyticsPlannedStatus,
} from '@/core/models/analytics'

/**
 * The catalog's Planned / untapped section (ticket 842, BackOffice spec 3437 §C, 3440; stories 31–33) — pure: no
 * React, no i18n. The tree (`./catalog-tree`) and 845's print both group and resolve through here.
 *
 * - **Planned areas** group by roadmap status in the roadmap's order (idea → approved → building → live), the wire's
 *   order inside a status; a status no planned area holds is left out.
 * - A planned area's **sources** resolve against the lineage's sources, then the untapped sources; a key naming
 *   neither (the server's `unknownSources`, or one the web cannot resolve) is kept and flagged, never dropped.
 */

export const PLANNED_STATUSES: readonly AnalyticsPlannedStatus[] = ['idea', 'approved', 'building', 'live']

export interface PlannedGroup {
  status: AnalyticsPlannedStatus
  planned: AnalyticsCatalogPlanned[]
}

export function groupPlanned(planned: readonly AnalyticsCatalogPlanned[]): PlannedGroup[] {
  return PLANNED_STATUSES.map((status) => ({ status, planned: planned.filter((p) => p.status === status) })).filter((g) => g.planned.length > 0)
}

export type PlannedSource =
  | { key: string; kind: 'lineage'; source: AnalyticsCatalogSource }
  | { key: string; kind: 'untapped'; untapped: AnalyticsCatalogUntapped }
  | { key: string; kind: 'unknown' }

export function plannedSources(p: AnalyticsCatalogPlanned, catalog: Pick<AnalyticsCatalog, 'sources' | 'untappedSources'>): PlannedSource[] {
  const lineage = new Map(catalog.sources.map((s) => [s.key, s]))
  const untapped = new Map(catalog.untappedSources.map((u) => [u.key, u]))
  const unknown = new Set(p.unknownSources)
  const keys = [...new Set([...p.sources, ...p.unknownSources])]
  return keys.map((key): PlannedSource => {
    const s = unknown.has(key) ? undefined : lineage.get(key)
    if (s) return { key, kind: 'lineage', source: s }
    const u = unknown.has(key) ? undefined : untapped.get(key)
    if (u) return { key, kind: 'untapped', untapped: u }
    return { key, kind: 'unknown' }
  })
}

/** The planned areas that would read a source table. */
export const plannedNaming = (sourceKey: string, planned: readonly AnalyticsCatalogPlanned[]): AnalyticsCatalogPlanned[] =>
  planned.filter((p) => p.sources.includes(sourceKey))
