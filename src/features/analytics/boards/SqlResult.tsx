import { useTranslation } from 'react-i18next'
import type { AnalyticsSqlRefusal, AnalyticsSqlResult } from '@/core/models/analytics-sql'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { refusalSpot, sqlCells } from './sql-editor'

/** The reasons the editor words in its own terms (BackOffice 3672); any other shows the server's message. */
const KNOWN_REASONS = new Set([
  'not-parsed',
  'not-one-select',
  'table-not-allowed',
  'column-not-allowed',
  'join-not-on-list',
  'facts-not-grouped',
  'function-not-allowed',
  'too-long',
  'busy',
  'timed-out',
  'not-available',
  'needs-sql-grant',
])

/**
 * A SQL run's rows (ticket 890): the count and the time, the cut line, every row (column names are machine values,
 * `Ltr`; a cell may be a name in either script, `<bdi>`; SQL NULL is said), and the tables read.
 */
export function SqlResultTable({ result }: { result: AnalyticsSqlResult }) {
  const { t } = useTranslation('boards')
  const cells = sqlCells(result)
  return (
    <section aria-label={t('sqlEditor.result')} className="flex min-w-0 flex-col gap-2 text-xs" data-analytics-sql-result>
      <p className="text-muted-foreground" data-analytics-sql-count>
        {t('sqlEditor.rows', { count: result.rowCount, n: fsi(formatNumber(result.rowCount)) })}
        {' · '}
        {t('sqlEditor.duration', { ms: fsi(formatNumber(result.durationMs)) })}
      </p>
      {result.isCut && (
        <p role="note" className="text-muted-foreground" data-analytics-sql-cut>
          {t('sqlEditor.cut', { n: fsi(formatNumber(result.rows.length)) })}
        </p>
      )}
      {result.columns.length > 0 && (
        <div className="max-h-[28rem] overflow-auto rounded-md border border-border/60 print:max-h-none print:overflow-visible">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {result.columns.map((c, i) => (
                  <th key={i} className="border-b border-border px-2 py-1 text-start font-semibold">
                    <Ltr>{c}</Ltr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.map((row, r) => (
                <tr key={r} data-analytics-sql-row>
                  {row.map((cell, i) => (
                    <td key={i} className="border-b border-border/60 px-2 py-1 text-start">
                      {cell === null ? <span className="text-muted-foreground">{t('sqlEditor.null')}</span> : <bdi>{cell}</bdi>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.tables.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground">
          <span>{t('sqlEditor.tablesRead')}</span>
          {result.tables.map((name) => (
            <span key={name} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              <Ltr>{name}</Ltr>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

/**
 * A refusal (ticket 890, Q45; a SQL item's kept refusal, Q49): its reason in the editor's words and, for a statement
 * the parser could not read, the line it stopped at with the character marked.
 */
export function SqlRefusalNote({ refusal, statement }: { refusal: AnalyticsSqlRefusal; statement: string }) {
  const { t } = useTranslation('boards')
  const spot = refusalSpot(statement, refusal.line, refusal.column)
  const words = KNOWN_REASONS.has(refusal.reason) ? t(`sqlEditor.reason.${refusal.reason}`) : refusal.message || t('sqlEditor.reason.unknown')
  return (
    <div role="alert" className="flex flex-col gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" data-analytics-sql-refusal={refusal.reason}>
      <p className="font-medium text-destructive">{words}</p>
      {spot && (
        <>
          <p className="text-xs text-muted-foreground" data-analytics-sql-refusal-at={`${spot.line}:${spot.column}`}>
            {t('sqlEditor.at', { line: fsi(String(spot.line)), column: fsi(String(spot.column)) })}
          </p>
          <pre dir="ltr" className="overflow-x-auto whitespace-pre rounded bg-muted p-2 text-start font-mono text-xs text-foreground">
            {spot.before}
            <mark className="rounded-sm bg-destructive/25 text-foreground underline decoration-destructive decoration-wavy">{spot.at || ' '}</mark>
            {spot.after}
          </pre>
        </>
      )}
    </div>
  )
}
