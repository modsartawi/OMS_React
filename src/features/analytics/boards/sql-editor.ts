import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'
import type {
  AnalyticsSqlChart,
  AnalyticsSqlItem,
  AnalyticsSqlItemRun,
  AnalyticsSqlItemUpdate,
  AnalyticsSqlPanelAnswer,
  AnalyticsSqlRefusal,
  AnalyticsSqlResult,
} from '@/core/models/analytics-sql'
import type { AnalyticsLabel, AnalyticsTier } from '@/core/models/analytics'

/**
 * The SQL editor (ticket 890, BackOffice spec 3632 Q44, Q45), pure. Run is `POST Analytics/Sql/Run` (BackOffice 3672);
 * its refusal names a reason, and `not-parsed` also the line and column the parser stopped at, which the editor shows
 * in place. Saving, restoring and verifying are the item's own doors (3675, 3676), read in `./api`.
 */

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const place = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

/** The door's answer (3672's run shape, also a SQL item's kept `sql.result`), every array present. */
export function readSqlResult(raw: unknown): AnalyticsSqlResult {
  const r = obj(raw)
  return {
    columns: strings(r.columns),
    rows: Array.isArray(r.rows) ? r.rows.map(obj) : [],
    rowCount: count(r.rowCount),
    isCut: r.isCut === true,
    durationMs: count(r.durationMs),
    statement: str(r.statement),
    tables: strings(r.tables),
  }
}

/** The rows read to the columns, for drawing: a value as text, SQL NULL (or a missing key) as `null`. */
export function sqlCells(result: AnalyticsSqlResult): (string | null)[][] {
  return result.rows.map((row) =>
    result.columns.map((c) => {
      const v = row[c]
      if (v === null || v === undefined) return null
      return typeof v === 'object' ? JSON.stringify(v) : String(v)
    }),
  )
}

/** The codes that are the SQL door's own answers about a statement (3672), and the missing SQL grant. */
const SQL_CODES = new Set(['ANALYTICS-425', 'ANALYTICS-408', 'ANALYTICS-409', 'ANALYTICS-428'])

/**
 * A Run's (or a save's run's) refusal: its reason and, for `not-parsed`, the line and column. `ANALYTICS-428` carries
 * no data and reads as `needs-sql-grant`. Anything else is `null`: the caller words it as any analytics failure.
 */
export function sqlRunRefusal(err: unknown): AnalyticsSqlRefusal | null {
  const code = apiErrorCode(err)
  if (!code || !SQL_CODES.has(code)) return null
  return readSqlRefusal({ ...obj(apiErrorData(err)), code, message: apiErrorMessage(err, '') })
}

/** `{ code, reason, line, column, message }` — a refusal from an error's data, or a SQL item's `sql.refusal`. */
export function readSqlRefusal(raw: unknown): AnalyticsSqlRefusal {
  const r = obj(raw)
  const code = str(r.code)
  return {
    code,
    reason: str(r.reason) || (code === 'ANALYTICS-428' ? 'needs-sql-grant' : ''),
    line: place(r.line),
    column: place(r.column),
    message: str(r.message),
  }
}

/** Where a refusal points in the statement: its line split at the (1-based) column. */
export interface RefusalSpot {
  line: number
  column: number
  before: string
  at: string
  after: string
}

/**
 * The refusal at its line: the text of `line` (1-based, as the parser counts) cut at `column`, so the screen can mark
 * the character. A column past the line's end points just after it. No place, or a line the statement does not have,
 * is `null` (the reason is still shown).
 */
export function refusalSpot(statement: string, line: number | null, column: number | null): RefusalSpot | null {
  if (line === null || column === null) return null
  const lines = statement.split(/\r\n|\r|\n/)
  if (line < 1 || line > lines.length) return null
  const text = lines[line - 1]
  const i = Math.min(Math.max(column - 1, 0), text.length)
  return { line, column, before: text.slice(0, i), at: text.slice(i, i + 1), after: text.slice(i + 1) }
}

const CHART_TYPES: readonly AnalyticsSqlChart['type'][] = ['kpi', 'line', 'area', 'bar', 'donut', 'table', 'heatmap', 'combo']
const FORMATS = ['number', 'money', 'percent'] as const
const said = (v: unknown): AnalyticsLabel => ({ en: str(obj(v).en), ar: str(obj(v).ar) })

/** A SQL item's chart as stored, kept as the server sent it; absent (or an unknown type) is a table (3675 Q41). */
function readChart(raw: unknown): AnalyticsSqlChart {
  const c = obj(raw)
  const type = CHART_TYPES.find((t) => t === c.type) ?? 'table'
  return {
    type,
    ...(str(c.axis) ? { axis: str(c.axis) } : {}),
    ...(str(c.series) ? { series: str(c.series) } : {}),
    values: (Array.isArray(c.values) ? c.values : []).map(obj).map((v) => ({
      column: str(v.column),
      label: said(v.label),
      format: FORMATS.find((f) => f === v.format) ?? 'number',
    })),
  }
}

function readRun(raw: unknown): AnalyticsSqlItemRun | null {
  if (!raw || typeof raw !== 'object') return null
  const r = obj(raw)
  return {
    revision: count(r.revision),
    ranAt: str(r.ranAt) || null,
    result: r.result && typeof r.result === 'object' ? readSqlResult(r.result) : null,
    refusal: r.refusal && typeof r.refusal === 'object' ? readSqlRefusal(r.refusal) : null,
  }
}

/** `GET Analytics/Item/{id}` (and every write door's answer) read as a SQL item (3675, 3676). */
export function readSqlItem(raw: unknown): AnalyticsSqlItem {
  const i = obj(raw)
  const d = obj(i.definition)
  const tier: AnalyticsTier = i.tier === 'shared' || i.tier === 'certified' ? i.tier : 'personal'
  return {
    id: str(i.id),
    kind: 'view',
    engine: 'sql',
    title: said(i.title),
    subtitle: said(i.subtitle),
    owner: str(i.owner),
    tier,
    revision: count(i.revision),
    updatedAt: str(i.updatedAt),
    updatedBy: str(i.updatedBy),
    sourceChangedSinceCopy: i.sourceChangedSinceCopy === true,
    copiedFrom: str(i.copiedFrom) || null,
    verified: i.verified === true,
    definition: { statement: str(d.statement), question: str(d.question), chart: readChart(d.chart) },
    sql: readRun(i.sql),
    ...(Array.isArray(i.actions) ? { actions: strings(i.actions) } : {}),
  }
}

/** 891: a SQL panel's `sql` part of a query answer (BackOffice 3677), every field present. */
export function readSqlPanelAnswer(raw: unknown): AnalyticsSqlPanelAnswer {
  const s = obj(raw)
  return {
    itemId: str(s.itemId),
    title: said(s.title),
    subtitle: said(s.subtitle),
    chart: readChart(s.chart),
    filtersApply: s.filtersApply === true,
    verified: s.verified === true,
    revision: count(s.revision),
    ranAt: str(s.ranAt) || null,
    result: s.result && typeof s.result === 'object' ? readSqlResult(s.result) : null,
    refusal: s.refusal && typeof s.refusal === 'object' ? readSqlRefusal(s.refusal) : null,
  }
}

/**
 * Save's body: the edited statement, the item's own question and chart, at the revision the editor opened, or (Q46) the
 * one the copilot opened the item at (`baseRevision`), so a save made in between is refused `ANALYTICS-405`.
 */
export function sqlSaveBody(item: AnalyticsSqlItem, statement: string, baseRevision?: number): AnalyticsSqlItemUpdate {
  return { definition: { statement, question: item.definition.question, chart: item.definition.chart }, baseRevision: baseRevision ?? item.revision }
}

/**
 * 3676 Q44: a save (or restore) whose statement differs from the one the item holds removes the verified mark. The
 * server compares ordinally, so this does too: the editor warns before such a save.
 */
export const removesVerified = (item: Pick<AnalyticsSqlItem, 'verified' | 'definition'>, statement: string): boolean =>
  item.verified && statement !== item.definition.statement

/** Who is acting on a SQL item: the session's user and the `Analytics/Access` grants. */
export interface SqlActor {
  userId: string | null
  canView: boolean
  canSql: boolean
  canCurate: boolean
}

export interface SqlItemActions {
  /** Edit the statement, Run it, Save a revision (Q45). */
  edit: boolean
  /** List the revisions and Restore one (Q45): the same rule as `edit`, under the server's own `revisions` action. */
  revisions: boolean
  /** A curator's mark (Q44): `verify` on an unverified item, `unverify` on a verified one, never both. */
  verify: 'verify' | 'unverify' | null
}

const sameUser = (a: string, b: string | null) => !!b && a.toLowerCase() === b.toLowerCase()

/**
 * What the SQL editor offers (3675, 3676): changing a SQL item is for its owner with the SQL grant, or a curator (who
 * needs the SQL grant too: every write runs the statement); Verify / Unverify only for a curator. When the server sends
 * the caller's `actions`, they can only take an action away (3632 review, item 5: a curator without the SQL grant gets
 * `verify`/`unverify` but neither `edit` nor `revisions`). Pure; the server stays the judge.
 */
export function sqlItemActions(item: AnalyticsSqlItem, actor: SqlActor): SqlItemActions {
  const server = item.actions
  const allows = (key: string) => !server || server.includes(key)
  const changer = actor.canView && actor.canSql && (actor.canCurate || sameUser(item.owner, actor.userId))
  const mark = item.verified ? 'unverify' : 'verify'
  const verify = actor.canView && actor.canCurate && allows(mark) ? mark : null
  return { edit: changer && allows('edit'), revisions: changer && allows('revisions'), verify }
}

/**
 * Q46 (BackOffice 3678): "Change by asking" (open the item in the copilot, in SQL mode) is offered only when the server's
 * actions for this reader include `edit` (absent actions are not enough: the copilot's door applies that same rule), the
 * copilot is there (`useCopilotPanel` `available`) and the reader holds the SQL grant (SQL mode is theirs).
 */
export const changeByAsking = (item: Pick<AnalyticsSqlItem, 'actions'>, there: { copilot: boolean; canSql: boolean }): boolean =>
  there.copilot && there.canSql && (item.actions?.includes('edit') ?? false)
