import type {
  AnalyticsBoard,
  AnalyticsItem,
  AnalyticsItemCreate,
  AnalyticsModel,
  AnalyticsReportBlock,
  AnalyticsReportDefinition,
  AnalyticsReportSection,
} from '@/core/models/analytics'
import { inLogicalOrder } from './board'
import { keptBindings } from './bindings'
import { convertV1Board } from './params'
import { measureOf } from './wire'

/**
 * "Save as report" (spec 819 §E, ticket 830; 801 item 6): a board turned into a new report's create body.
 * There is no conversion back.
 *
 * - The panels are read in the board's reading order (`inLogicalOrder`: row by row, then by logical column).
 * - A view panel becomes an inline panel block — the view's definition COPIED, titled as the view — recording
 *   `from { viewId, revision }`. A text panel becomes a text block.
 * - A section panel becomes a heading: reports hold headings on sections only, so each section panel opens a
 *   new section headed by its title, and the blocks after it fall under it. Blocks before the first section
 *   panel go into one leading section with no heading — so a board with no section panels is one section.
 * - The parameters and bindings are copied. The blocks keep their board panel ids, so the bindings carry over
 *   unchanged. A v1 board's filters and opt-outs are converted first, bound only where v1's implicit rule
 *   reached (some measure of the panel's view breaks down by the dimension) — the report's bindings are
 *   applied as written, so a binding v1 would have dropped is not created.
 * - A view panel whose view is not in `views` (removed, or not readable) is left out with its bindings, and
 *   named in `missing`.
 */
export interface BoardAsReport {
  create: AnalyticsItemCreate & { kind: 'report'; definition: AnalyticsReportDefinition }
  /** Ids of the board's view panels left out because their view could not be read. */
  missing: string[]
}

/** The leading section's id when the board does not open on a section panel. */
const LEAD = 's1'

export function boardToReport(board: AnalyticsBoard, views: ReadonlyMap<string, AnalyticsItem>, model: AnalyticsModel): BoardAsReport {
  const def = board.definition
  const declared =
    def.params && def.bindings
      ? { params: def.params, bindings: def.bindings }
      : convertV1Board(def, (panel, dimension) => {
          const view = views.get(panel.viewId)
          return !!view && view.definition.query.measures.some((k) => measureOf(model, k)?.dimensions.includes(dimension))
        })

  const sections: AnalyticsReportSection[] = []
  const missing: string[] = []
  const current = (): AnalyticsReportSection => {
    if (sections.length === 0) sections.push({ id: freeLead(def.panels.map((p) => p.id)), heading: { en: '', ar: '' }, blocks: [] })
    return sections[sections.length - 1]
  }
  for (const p of inLogicalOrder(def.panels)) {
    if (p.kind === 'section') {
      sections.push({ id: p.id, heading: { ...p.title }, blocks: [] })
      continue
    }
    let block: AnalyticsReportBlock
    if (p.kind === 'text') block = { id: p.id, kind: 'text', text: { ...p.text } }
    else {
      const view = views.get(p.viewId)
      if (!view) {
        missing.push(p.id)
        continue
      }
      block = { id: p.id, kind: 'panel', title: { ...view.title }, definition: structuredClone(view.definition), from: { viewId: view.id, revision: view.revision } }
    }
    current().blocks.push(block)
  }
  if (sections.length === 0) current()

  const panelIds = new Set(sections.flatMap((s) => s.blocks.filter((b) => b.kind === 'panel').map((b) => b.id)))
  return {
    create: {
      kind: 'report',
      title: { ...board.title },
      subtitle: { ...board.subtitle },
      definition: { params: structuredClone(declared.params), bindings: keptBindings(declared.bindings, panelIds), sections },
    },
    missing,
  }
}

/** `s1`, or the first `s<n>` no board panel already holds. */
function freeLead(taken: readonly string[]): string {
  if (!taken.includes(LEAD)) return LEAD
  for (let i = 2; ; i++) if (!taken.includes(`s${i}`)) return `s${i}`
}
