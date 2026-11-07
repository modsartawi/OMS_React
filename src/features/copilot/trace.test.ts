import { describe, expect, it } from 'vitest'
import en from '@/locales/en/copilot.json'
import { COPILOT_TOOLS, toolStepKey, traceRows } from './trace'

describe('the "How I got this" trace (spec 734 D2, D11, D21; ticket 736)', () => {
  it('copilotTrace_labelsKnownToolsAndKeepsUnknownNames', () => {
    const tools = [
      'order_timeline',
      'order_delay_facts',
      'orders_by_channel',
      'sales_summary',
      'callout_stats',
      'sap_posting_backlog',
      'store_lookup',
      'sourcing_explain',
      'sourcing_savings',
    ]
    const rows = traceRows([
      ...tools.map((tool) => ({ tool, input: {}, rows: 1, ms: 10, ok: true })),
      { tool: 'weather_now', input: { city: 'Riyadh' }, rows: 0, ms: 5, ok: true },
      { tool: 'order_timeline', input: { order: '7000123456', compareToPrevious: true, n: 3 }, rows: 0, ms: 9, ok: false },
    ])

    // Each of the nine catalogue tools reads in plain words, through its own key.
    expect(rows.slice(0, 9).map((r) => r.labelKey)).toEqual([
      'trace.tools.order_timeline',
      'trace.tools.order_delay_facts',
      'trace.tools.orders_by_channel',
      'trace.tools.sales_summary',
      'trace.tools.callout_stats',
      'trace.tools.sap_posting_backlog',
      'trace.tools.store_lookup',
      'trace.tools.sourcing_explain',
      'trace.tools.sourcing_savings',
    ])
    // An unknown tool has no label and keeps its raw name.
    expect(rows[9]).toMatchObject({ labelKey: null, tool: 'weather_now', inputs: [{ key: 'city', value: 'Riyadh' }], rows: 0, failed: false })
    // A failed call is marked, and its inputs read as key/value text in their order.
    expect(rows[10]).toMatchObject({
      labelKey: 'trace.tools.order_timeline',
      failed: true,
      inputs: [
        { key: 'order', value: '7000123456' },
        { key: 'compareToPrevious', value: 'true' },
        { key: 'n', value: '3' },
      ],
    })
  })

  it('copilotTrace_readsAMalformedEntryWithoutThrowing', () => {
    const odd = [{ tool: 7, input: null, rows: 'x', ok: 'yes' }] as unknown as Parameters<typeof traceRows>[0]
    expect(traceRows(odd)).toEqual([{ tool: '', labelKey: null, inputs: [], rows: null, failed: true }])
  })

  it('trace_theThreeAnalyticsToolsGetPlainLanguageLabels', () => {
    // Spec 766 D: describe_model, semantic_query and create_view join the one tool → label map.
    const rows = traceRows([
      { tool: 'describe_model', input: { area: 'orders' }, rows: 12, ms: 30, ok: true },
      { tool: 'semantic_query', input: { measures: ['orders.count'] }, rows: 4, ms: 210, ok: true },
      { tool: 'create_view', input: { chart: 'bar' }, rows: 1, ms: 40, ok: true },
    ])
    expect(rows.map((r) => r.labelKey)).toEqual([
      'trace.tools.describe_model',
      'trace.tools.semantic_query',
      'trace.tools.create_view',
    ])
    // …and the working state walks their steps too.
    expect(COPILOT_TOOLS).toEqual(expect.arrayContaining(['describe_model', 'semantic_query', 'create_view']))
    expect(toolStepKey('semantic_query')).toBe('steps.semantic_query')
  })

  it('a finished analytics step reads in the past tense, like its siblings; the working state stays present', () => {
    expect([en.trace.tools.describe_model, en.trace.tools.semantic_query, en.trace.tools.create_view]).toEqual([
      'Read the analytics model',
      'Ran the analytics query',
      'Saved a view',
    ])
    expect([en.steps.describe_model, en.steps.semantic_query, en.steps.create_view]).toEqual([
      'Reading the analytics model',
      'Running the analytics query',
      'Saving a view',
    ])
  })

  it('trace_theTwoReportToolsAreBuildingAReportAndEditingTheReport', () => {
    // Spec 819 §D (ticket 832): create_report and edit_report join the one map. The spec's words are the working
    // state's; a finished row reads in the past tense, like its siblings.
    const rows = traceRows([
      { tool: 'create_report', input: { title: 'Channel sales' }, rows: 1, ms: 120, ok: true },
      { tool: 'edit_report', input: { reportId: 'r-1' }, rows: 1, ms: 80, ok: true },
    ])
    expect(rows.map((r) => r.labelKey)).toEqual(['trace.tools.create_report', 'trace.tools.edit_report'])
    expect([en.steps.create_report, en.steps.edit_report]).toEqual(['Building a report', 'Editing the report'])
    expect([en.trace.tools.create_report, en.trace.tools.edit_report]).toEqual(['Built a report', 'Edited the report'])
    // The CTO demo's three report tools are retired: a newer server never sends them, an old one keeps its raw name.
    expect(traceRows([{ tool: 'build_report', input: {}, rows: 1, ms: 1, ok: true }])[0].labelKey).toBeNull()
  })
})
