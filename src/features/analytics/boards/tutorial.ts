import type { AnalyticsLabel, AnalyticsModel, AnalyticsReportDefinition, AnalyticsViewDefinition } from '@/core/models/analytics'
import { figuresOf, tokensIn } from './live-figures'
import { reportBlocks, reportPanels } from './report'
import { CANCELLATION_RATE, CHANNEL, DELIVERY_TYPE, HUNGERSTATION, NET_SALES, QC } from './sample-report'
import { seriesOf } from './series'

/**
 * The designer's tutorial (spec 819 §E, ticket 831; 798's `TUTORIAL`) — pure. One fixed checklist that builds the
 * acceptance case from a blank report, and **each step ticks itself from the draft**: the tutorial never asks "did
 * you do it?". So "Load the finished report" (`./sample-report`) ticks every step.
 *
 * 798 also had "Share" and "Save". They are not here: the audience is not part of the draft (it is shared from the
 * report's page), and a loaded or edited draft is unsaved by definition — neither could tick from the draft.
 * The last line, "Or ask the copilot", is not a check: it shows the acceptance sentence.
 */
export const TUTORIAL_STEPS = ['title', 'section', 'chart', 'series', 'rate', 'figure', 'summary', 'period'] as const
export type TutorialStep = (typeof TUTORIAL_STEPS)[number]

/** What the checks read: the draft's title and definition. */
export interface TutorialDraft {
  title: AnalyticsLabel
  definition: AnalyticsReportDefinition
}

/** A panel holding both a HungerStation series (by channel) and a QC series (by delivery type). */
const comparesHsQc = (d: AnalyticsViewDefinition): boolean => {
  const series = seriesOf(d)
  const has = (dimension: string, value: string) => series.some((s) => s.filters.some((f) => f.dimension === dimension && f.values.includes(value)))
  return has(CHANNEL, HUNGERSTATION) && has(DELIVERY_TYPE, QC)
}

export function tutorialChecks(draft: TutorialDraft, model: AnalyticsModel): Record<TutorialStep, boolean> {
  const def = draft.definition
  const panels = reportPanels(def)
  const blocks = reportBlocks(def)
  const byId = new Map(panels.map((p) => [p.id, p]))
  const period = def.params.find((p) => p.kind === 'period')
  return {
    title: draft.title.en.trim() !== '' || draft.title.ar.trim() !== '',
    section: def.sections.length > 0,
    chart: panels.some(
      ({ definition: d }) => d.chart.type === 'bar' && d.query.measures.includes(NET_SALES) && d.query.dimensions.includes(CHANNEL) && seriesOf(d).length === 0,
    ),
    series: panels.some((p) => comparesHsQc(p.definition)),
    rate: panels.some((p) => comparesHsQc(p.definition) && p.definition.query.measures.includes(CANCELLATION_RATE)),
    figure: blocks.some(
      (b) =>
        b.kind === 'text' &&
        tokensIn(`${b.text.en} ${b.text.ar}`).some((tok) => {
          const p = byId.get(tok.panel)
          return !!p && figuresOf(p.definition, model).some((f) => f.figure === tok.figure)
        }),
    ),
    summary: blocks.some((b) => b.kind === 'summary'),
    period:
      !!period &&
      period.default.kind === 'period' &&
      'token' in period.default &&
      period.default.token === 'yesterday' &&
      panels.length > 0 &&
      panels.every((p) => def.bindings[period.name]?.[p.id] !== undefined),
  }
}

/** The step to do next: the first not done, or `null` when every step is. */
export const currentStep = (done: Record<TutorialStep, boolean>): TutorialStep | null => TUTORIAL_STEPS.find((s) => !done[s]) ?? null
