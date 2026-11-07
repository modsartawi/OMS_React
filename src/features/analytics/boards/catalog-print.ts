import { apiErrorCode } from '@/core/api'
import type {
  AnalyticsCatalog,
  AnalyticsCatalogArea,
  AnalyticsCatalogMart,
  AnalyticsCatalogPlanned,
  AnalyticsCatalogSource,
  AnalyticsCatalogUntapped,
  AnalyticsPlannedStatus,
} from '@/core/models/analytics'
import { analyticsCatalogQuery } from './api'
import { areaFacts, type AreaFacts } from './catalog-area'
import { groupPlanned, plannedSources, type PlannedSource } from './catalog-planned'
import { analyticsRefusal, type AnalyticsRefusal } from './wire'

/**
 * The catalog's print (ticket 845, BackOffice spec 3437 §G, story 52) — what `/analytics/print/catalog` lays out on
 * A4, in the order the paper reads: every area (what it holds — measures and dimensions —, its marts and the source
 * tables they read, its freshness and its area boundary), then the Planned and untapped section. The facts and the
 * roadmap come from 842's pure modules (`./catalog-area`, `./catalog-planned`), so the paper says what the screen says.
 *
 * Curator facts (rows, size, hidden columns) are drawn by **presence** in the answer, never by the access probe: under
 * a render ticket the probe is faked as a runner, while `Render/Catalog` answers as the requester sees it (ruling 6).
 */

export interface PrintMart extends AnalyticsCatalogMart {
  /** Columns not on the preview allow-list; `null` when the answer carried no columns (not a curator). */
  hidden: number | null
}

/** A source table an area reads (through its marts); `source` is `null` when the lineage cannot resolve the key. */
export interface PrintSource {
  key: string
  source: AnalyticsCatalogSource | null
}

export interface PrintArea {
  area: AnalyticsCatalogArea
  facts: AreaFacts
  marts: PrintMart[]
  /** Mart keys the area names with no mart in the answer (tolerated, listed as keys). */
  missingMarts: string[]
  sources: PrintSource[]
}

export interface PrintPlannedGroup {
  status: AnalyticsPlannedStatus
  planned: { planned: AnalyticsCatalogPlanned; sources: PlannedSource[] }[]
}

export interface CatalogPrint {
  imageVersion: string
  lineageAvailable: boolean
  /** Any mart carried curator facts: the requester is a curator. */
  curator: boolean
  areas: PrintArea[]
  planned: PrintPlannedGroup[]
  untapped: AnalyticsCatalogUntapped[]
}

export function catalogPrint(catalog: AnalyticsCatalog): CatalogPrint {
  const marts = new Map(catalog.marts.map((m) => [m.key, m]))
  const sources = new Map(catalog.sources.map((s) => [s.key, s]))
  const printMart = (m: AnalyticsCatalogMart): PrintMart => ({ ...m, hidden: m.columns ? m.columns.filter((c) => !c.previewable).length : null })
  const areas = catalog.areas.map((area): PrintArea => {
    const own = area.marts.map((k) => marts.get(k)).filter((m): m is AnalyticsCatalogMart => !!m)
    const keys = [...new Set(own.flatMap((m) => m.sources))]
    return {
      area,
      facts: areaFacts(area),
      marts: own.map(printMart),
      missingMarts: area.marts.filter((k) => !marts.has(k)),
      sources: keys.map((key) => ({ key, source: sources.get(key) ?? null })),
    }
  })
  return {
    imageVersion: catalog.imageVersion,
    lineageAvailable: catalog.lineageAvailable,
    curator: catalog.marts.some((m) => m.columns !== null),
    areas,
    planned: groupPlanned(catalog.planned).map((g) => ({ status: g.status, planned: g.planned.map((p) => ({ planned: p, sources: plannedSources(p, catalog) })) })),
    untapped: catalog.untappedSources,
  }
}

/**
 * Every read the print page makes. A catalog ticket opens ONLY `Render/Catalog` (BO 3444): no access probe, no
 * `analyticsApi.model()` (it would switch to `Render/Model` and be refused), nothing else that queries.
 */
export const catalogPrintQueries = () => [analyticsCatalogQuery()]

/** The PDF's file name when the server names none — the server's own (`AnalyticsCatalogPrint`). */
export const catalogPdfName = (lang: 'en' | 'ar'): string => (lang === 'ar' ? 'catalog-ar.pdf' : 'catalog.pdf')

/**
 * The PDF's own wording of a refusal (ruling 13): its timeout is the render budget and its 409 a failed render, not
 * a panel's. Everything else as every analytics door.
 */
const PDF_REFUSAL_KEYS: Record<string, string> = {
  'ANALYTICS-408': 'catalog.print.timedOut',
  'ANALYTICS-409': 'catalog.print.failed',
}

export function pdfRefusal(err: unknown, fallback: string): AnalyticsRefusal {
  const code = apiErrorCode(err)
  const key = code ? PDF_REFUSAL_KEYS[code] : undefined
  return key ? { code, key } : analyticsRefusal(err, fallback)
}
