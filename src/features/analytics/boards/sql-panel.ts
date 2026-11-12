import type { AnalyticsLabel, AnalyticsQueryInput, AnalyticsQueryResult, AnalyticsReportBlock, AnalyticsReportSqlBlock, Param } from '@/core/models/analytics'
import { ANALYTICS_SQL_PANEL_REASON, type AnalyticsSqlItem, type AnalyticsSqlRefusal, type AnalyticsSqlResult } from '@/core/models/analytics-sql'
import type { BoardContext } from './effective-query'

/**
 * A SQL item where it is drawn (ticket 891; BackOffice 3675-3677, spec 3632 Q43, Q48, Q49), pure: its mark in the
 * library, on a board panel, in a report block and on the print page, and what a SQL panel's answer draws.
 */

/** The mark a SQL item carries: "SQL", or "SQL, verified" (3676); `null` for anything else (absent `engine` is cube). */
export type SqlMark = 'sql' | 'verified'

/**
 * The mark of a library row, a board panel, a report block or a panel answer. An answer's `verified` is its `sql`
 * part's (`sql.verified`, 3677); an item's is its own.
 */
export function sqlMark(x: { engine?: string; verified?: boolean; sql?: object | null } | null | undefined): SqlMark | null {
  if (!x || x.engine !== 'sql') return null
  const verified = x.sql && 'verified' in x.sql ? x.sql.verified === true : x.verified === true
  return verified ? 'verified' : 'sql'
}

/** A report block holding a SQL item by reference (3677). */
export const isSqlBlock = (b: AnalyticsReportBlock): b is AnalyticsReportSqlBlock => b.kind === 'panel' && b.engine === 'sql'

/** What a SQL panel's body draws (Q47, Q49): its rows, the reason it can no longer run in place of the chart, or neither. */
export type SqlPanelBody = { kind: 'result'; result: AnalyticsSqlResult } | { kind: 'refusal'; refusal: AnalyticsSqlRefusal } | { kind: 'notRun' }

export interface SqlPanelView {
  mark: SqlMark
  /** The SQL item's id: "Open the SQL" goes to its page, where a viewer reads the statement (Q7). */
  itemId: string
  title: AnalyticsLabel
  ranAt: string | null
  /** Q48: the board or report declares parameters, and none reach a SQL panel. */
  filtersDoNotApply: boolean
  body: SqlPanelBody
}

/**
 * A SQL panel's answer as the panel draws it, or `null` for an answer that is not a SQL panel's (a Cube answer). A
 * refusal wins over any result: a statement that no longer runs shows its reason and never a chart (Q49).
 * `params`: the board's or report's declared parameters.
 */
export function sqlPanelView(answer: AnalyticsQueryResult | undefined, params: readonly Param[]): SqlPanelView | null {
  const sql = answer?.engine === 'sql' ? answer.sql : undefined
  if (!answer || !sql) return null
  const body: SqlPanelBody = sql.refusal ? { kind: 'refusal', refusal: sql.refusal } : sql.result ? { kind: 'result', result: sql.result } : { kind: 'notRun' }
  const unreached = (answer.notReached ?? []).some((n) => n.reason === ANALYTICS_SQL_PANEL_REASON)
  return {
    mark: sql.verified ? 'verified' : 'sql',
    itemId: sql.itemId,
    title: sql.title,
    ranAt: sql.ranAt,
    filtersDoNotApply: params.length > 0 && (unreached || !sql.filtersApply),
    body,
  }
}

/**
 * How a SQL panel asks `Analytics/Query` (3677): by the saved board or report and its panel, or by the draft and its
 * panel. Its `values` are always empty — no parameter reaches it (Q48), so moving a filter is not a new question.
 * `null` when the context names neither (a v1 board the server has not converted): the panel reads the item instead.
 */
export function sqlPanelInput(panelId: string, context: Pick<BoardContext, 'item' | 'draft'>): AnalyticsQueryInput | null {
  if (context.draft) return { draft: context.draft, panelId, values: {} }
  if (context.item) return { itemId: context.item.id, revision: context.item.revision, panelId, values: {} }
  return null
}

/** A SQL item's own read (`GET Analytics/Item/{id}`, 3675) as a SQL panel's answer, for a panel with no board item to ask by. */
export function sqlItemAnswer(item: AnalyticsSqlItem): AnalyticsQueryResult {
  return {
    engine: 'sql',
    columns: [],
    rows: [],
    total: 0,
    truncated: false,
    period: null,
    previous: [],
    fetchedAt: item.sql?.ranAt ?? '',
    dataAsOf: '',
    notReached: [],
    sql: {
      itemId: item.id,
      title: item.title,
      subtitle: item.subtitle,
      chart: item.definition.chart,
      filtersApply: false,
      verified: item.verified,
      revision: item.sql?.revision ?? item.revision,
      ranAt: item.sql?.ranAt ?? null,
      result: item.sql?.result ?? null,
      refusal: item.sql?.refusal ?? null,
    },
  }
}
