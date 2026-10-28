import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'

import Ltr from '@/core/ui/Ltr'
import { formatFigure } from '@/core/util/number-format'
import { TD, TH } from '@/core/insurance-rules/parts'
import { rowMessage } from './upload'

/** One row an IDF upload report lists. An item report (622) lists failing rows only; a groups report (653) lists
 *  every row with its action, `rule` empty on a passing one. */
export interface UploadReportRow {
  line: number
  rule: string
  messageEn: string
  messageAr: string
  itemNumber?: string
  idfNumber?: string
  action?: string
}

export interface UploadReport {
  uploadId: string
  ok: boolean
  lineCount?: number | null
  rows: UploadReportRow[] | null
}

/**
 * An IDF upload's row report (622's report, shared by 649 / 653). `applicable` is the caller's verdict (a clean
 * report: `isPublishable` for a master upload, `isGroupsImportApplicable` for a groups import) — clean shows the
 * caller's `clean` line, else the failed-row count (`notOk` when the server failed it with no row). The rows table
 * shows whatever rows the report lists, in the server's order.
 *
 * Every word is read under `keyPrefix` (`upload`, `groupsImport`, …): `clean`, `rowsFailed_*` (`<v>{{n}}</v>`),
 * `notOk`, `lineCount`, `columns.{line,item|group,action,rule,message}` and, for groups, `action.{add,update}`.
 * `summary` renders under the status line (e.g. the add / update counts).
 *
 * Hooks: `data-idf-report="clean|failed"`, `data-idf-report-summary`, `data-idf-report-rows`, rows `data-line` /
 * `data-rule` (and `data-action`), cells `data-col`.
 */
export default function UploadRowReport({
  report,
  kind,
  applicable,
  ruleWordKey,
  keyPrefix,
  summary,
}: {
  report: UploadReport
  /** `item`: line, item, rule, message. `group`: line, group, action, rule, message. */
  kind: 'item' | 'group'
  applicable: boolean
  ruleWordKey: (rule: string) => string | null
  keyPrefix: string
  summary?: ReactNode
}) {
  const { t, i18n } = useTranslation('insurance-idf')
  const rows = report.rows ?? []
  // An item report lists failing rows only; a groups report lists every row, so count those naming a rule.
  const failedCount = kind === 'group' ? rows.filter((r) => r.rule).length : rows.length
  const lines =
    report.lineCount != null ? (
      <p className="text-xs text-muted-foreground" data-idf-report-lines="">
        <Trans t={t} i18nKey={`${keyPrefix}.lineCount`} values={{ n: formatFigure(report.lineCount) }} components={{ v: <Ltr /> }} />
      </p>
    ) : null
  const table =
    rows.length > 0 ? (
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" data-idf-report-rows="">
          <thead className="bg-muted/50">
            <tr>
              <th className={`${TH} text-end`}>{t(`${keyPrefix}.columns.line`)}</th>
              <th className={TH}>{t(`${keyPrefix}.columns.${kind}`)}</th>
              {kind === 'group' && <th className={TH}>{t(`${keyPrefix}.columns.action`)}</th>}
              <th className={TH}>{t(`${keyPrefix}.columns.rule`)}</th>
              <th className={TH}>{t(`${keyPrefix}.columns.message`)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const word = r.rule ? ruleWordKey(r.rule) : null
              const id = kind === 'group' ? r.idfNumber : r.itemNumber
              return (
                <tr
                  key={`${r.line}-${i}`}
                  className={`border-t border-border/60 ${kind === 'group' && r.rule ? 'bg-destructive/5' : ''}`}
                  data-line={r.line}
                  data-rule={r.rule ?? ''}
                  data-action={kind === 'group' ? r.action : undefined}
                >
                  <td className={`${TD} text-end tabular-nums`} data-col="line">
                    <Ltr>{formatFigure(r.line)}</Ltr>
                  </td>
                  <td className={TD} data-col={kind}>
                    {id && <Ltr>{id}</Ltr>}
                  </td>
                  {kind === 'group' && (
                    <td className={TD} data-col="action">
                      {r.action ? t(`${keyPrefix}.action.${r.action}`, { defaultValue: r.action }) : null}
                    </td>
                  )}
                  <td className={TD} data-col="rule">
                    {word ? t(word) : r.rule ? <Ltr>{r.rule}</Ltr> : null}
                  </td>
                  <td className={TD} data-col="message">
                    {(r.rule || kind === 'item') && <bdi>{rowMessage(r, i18n.language)}</bdi>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    ) : null
  if (applicable) {
    return (
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm" data-idf-report="clean">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
          {t(`${keyPrefix}.clean`)}
        </p>
        {lines}
        {summary}
        {table}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2" data-idf-report="failed" data-upload-id={report.uploadId}>
      {lines}
      <p className="text-sm" data-idf-report-summary="">
        {failedCount === 0 ? (
          t(`${keyPrefix}.notOk`)
        ) : (
          <Trans t={t} i18nKey={`${keyPrefix}.rowsFailed`} count={failedCount} values={{ n: formatFigure(failedCount) }} components={{ v: <Ltr /> }} />
        )}
      </p>
      {summary}
      {table}
    </div>
  )
}
