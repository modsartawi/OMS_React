import type { AnalyticsReportBlock, AnalyticsReportDefinition, Param } from '@/core/models/analytics'
import type { ViewPanel } from './effective-query'
import { tokensIn } from './live-figures'
import { valueOf, type ParamValues } from './params'

/**
 * A report's definition, read (spec 819 §C, ticket 827) — pure. The runner's page, the print page and the
 * designer (828–832) walk a report through these: its blocks top to bottom, its panels, and whether a run
 * asks the Words door.
 */

export type ReportPanelBlock = Extract<AnalyticsReportBlock, { kind: 'panel' }>

/** Every block, section by section, top to bottom. */
export const reportBlocks = (def: AnalyticsReportDefinition): AnalyticsReportBlock[] => def.sections.flatMap((s) => s.blocks)

/** The panel blocks, top to bottom: what a run asks `Analytics/Query` for, one `panelId` each. */
export const reportPanels = (def: AnalyticsReportDefinition): ReportPanelBlock[] => reportBlocks(def).filter((b): b is ReportPanelBlock => b.kind === 'panel')

/** Whether a run asks `Analytics/Report/{id}/Words`: some text names a live figure (in either language), or there is a summary. */
export const wordsAsked = (def: AnalyticsReportDefinition): boolean =>
  reportBlocks(def).some((b) => b.kind === 'summary' || (b.kind === 'text' && tokensIn(`${b.text.en} ${b.text.ar}`).length > 0))

/** The full-width place a report panel stands in (a report flows top to bottom; it has no grid). */
const FLOW = { x: 0, y: 0, w: 12, h: 4 }

/**
 * A report panel as the board's view panel, so it runs through v1's panel frame (loading, freshness, actions,
 * drill): its id is the `panelId`, it references no saved view (its definition is inline), and it is opted out
 * of the cross-filter — a report has none (§E).
 */
export const asBoardPanel = (block: ReportPanelBlock): ViewPanel => ({ id: block.id, kind: 'view', viewId: '', layout: FLOW, optOut: ['crossFilter'] })

/**
 * The values one run of the report is asked with (the Words door's `values`): every declared parameter's value,
 * its default where the viewer chose none, members sorted once each — so equal choices are one cache entry.
 */
export function runValues(params: readonly Param[], values: ParamValues): ParamValues {
  return Object.fromEntries(
    params.map((p) => {
      const v = valueOf(p, values)
      return [p.name, v.kind === 'members' ? { kind: 'members', values: [...new Set(v.values)].sort() } : v]
    }),
  )
}
