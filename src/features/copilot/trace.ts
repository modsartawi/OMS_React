import type { CopilotTraceEntry } from '@/core/models/copilot'

/**
 * The "How I got this" trace's view model (ticket 736, spec 734 D11): each tool call the server made,
 * in plain words from ONE fixed tool → label map — the seven catalogue tools of D2 plus the two
 * sourcing tools of D21, plus spec 766 D's three analytics tools and spec 819 D's two report tools (832). The same map names the working
 * state's generic steps.
 *
 * A tool the map does not know (a newer server) keeps its raw name: `labelKey` is `null`.
 */
export const COPILOT_TOOLS = [
  'order_timeline',
  'order_delay_facts',
  'orders_by_channel',
  'sales_summary',
  'callout_stats',
  'sap_posting_backlog',
  'store_lookup',
  'sourcing_explain',
  'sourcing_savings',
  'describe_model',
  'semantic_query',
  'create_view',
  'create_report',
  'edit_report',
  'edit_board',
] as const
export type CopilotTool = (typeof COPILOT_TOOLS)[number]

const isKnownTool = (tool: string): tool is CopilotTool => (COPILOT_TOOLS as readonly string[]).includes(tool)

/** The trace row's label key in the `copilot` namespace, or `null` for an unknown tool. */
export const toolLabelKey = (tool: string): string | null => (isKnownTool(tool) ? `trace.tools.${tool}` : null)

/** The working state's step key for a tool (D11: "Looking up the order", "Counting orders"). */
export const toolStepKey = (tool: CopilotTool): string => `steps.${tool}`

export interface TraceInput {
  key: string
  value: string
}

export interface TraceRow {
  /** The raw tool name, shown when `labelKey` is null. */
  tool: string
  labelKey: string | null
  /** The call's inputs in the order the server sent them, each value as text. */
  inputs: TraceInput[]
  /** Rows the tool returned, or `null` when the server sent no count. */
  rows: number | null
  /** The call did not succeed: anything but `ok: true`. */
  failed: boolean
}

const inputText = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function traceRows(trace: readonly CopilotTraceEntry[]): TraceRow[] {
  return trace.map((e) => {
    const tool = typeof e?.tool === 'string' ? e.tool : ''
    const input = e?.input && typeof e.input === 'object' && !Array.isArray(e.input) ? e.input : {}
    return {
      tool,
      labelKey: toolLabelKey(tool),
      inputs: Object.entries(input).map(([key, value]) => ({ key, value: inputText(value) })),
      rows: typeof e?.rows === 'number' && Number.isFinite(e.rows) ? e.rows : null,
      failed: e?.ok !== true,
    }
  })
}
