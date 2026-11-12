import { useId, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FileSpreadsheet, FileText } from 'lucide-react'
import TableChart from '@/core/charts/TableChart'
import type { AnalyticsModel } from '@/core/models/analytics'
import type { CopilotAnswerTable } from '@/core/models/copilot'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { downloadCsv } from '@/core/util/download-file'
import { writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { listText } from '@/core/util/list-format'
import { analyticsAccessQuery, canAuthorAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi } from './api'
import AreaNotes, { useAreaNoteWords, useTableWords } from './AreaNotes'
import ComputedColumnsNote from './ComputedColumnsNote'
import {
  copilotTableComputedColumns,
  copilotTableDownload,
  copilotTableFileBase,
  copilotTableOpenAsView,
  copilotTableOpensAsView,
  copilotTableParts,
  copilotTableTitle,
  copilotTableView,
} from './copilot-table'
import CopilotTableTitle from './CopilotTableTitle'
import LastYearNote from './LastYearNote'
import { panelCsv, panelSheet, stamped, type TableWords } from './panel-table'
import { columnTooltip } from './unsplit'
import TruncatedNote from './TruncatedNote'
import UntilNote from './UntilNote'
import { useCalculationWords } from './use-calculations'

/** Until the model arrives (or when it cannot be read) the wire's labels name every column; members show as sent. */
const NO_MODEL: AnalyticsModel = { areas: [], measures: [], dimensions: [] }

/**
 * One table of a copilot answer (ticket 868, BackOffice spec 3558 D5-D6): the view panel's table form over every row
 * as sent (a long table scrolls in its own viewport), its notes (until, notSplit, notFiltered) and "All" rows last, the
 * CSV and xlsx downloads, and "Open as view" — the editor seeded with the table's query, for an author (as the drill's
 * "Save as view", 822). Registered with `@/core/copilot-view-embed` by the app shell; pure pieces in `./copilot-table`.
 *
 * 878 (BackOffice spec 3587 B22, B13; tickets 3621, 3607):
 * - a table of an analysis result carries a TITLE, drawn above it in the screen's language; its cells are the server's
 *   texts, shown and downloaded as sent, and still sorted by number on a header click (`@/core/charts/table-columns`);
 * - several such tables share one step, so `index` — the table's place in the answer — names its downloads too;
 * - "Open as view" opens the table's own query: not offered when it has none (`{}`), and followed by one line naming
 *   the columns the analysis computed, which the query does not hold;
 * - a table whose query asked for the same weeks last year shows the last-year column and the "not held" note (877).
 *
 * A table without a title that did not ask for last year is drawn and downloaded exactly as before.
 */
export default function CopilotTableEmbed({ table, index = 0 }: { table: CopilotAnswerTable; index?: number }) {
  const { t, i18n } = useTranslation('boards')
  const { t: tc } = useTranslation('common')
  const lang = i18n.language
  const navigate = useNavigate()
  const author = canAuthorAnalytics(useQuery(analyticsAccessQuery()).data)
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false }).data ?? NO_MODEL
  const noteWords = useAreaNoteWords()
  const tableWords = useTableWords()
  const calculationWords = useCalculationWords()
  const titleId = useId()

  // Read once (review item 7): the table form, the downloads and "Open as view" all take these.
  const parts = useMemo(() => copilotTableParts(table, model, { lang, words: calculationWords }), [table, model, lang, calculationWords])
  const { result, definition, model: drawing } = parts
  const words: TableWords = useMemo(
    () => ({ ...tableWords, tooltip: (key: string) => columnTooltip(key, result, drawing, lang, noteWords) }),
    [tableWords, result, drawing, lang, noteWords],
  )
  const view = useMemo(() => copilotTableView(parts, lang, words), [parts, lang, words])

  const dims = view.columns.filter((c) => c.role === 'dimension').map((c) => c.label)
  const measures = view.columns.filter((c) => c.role === 'measure').map((c) => c.label)
  const title = copilotTableTitle(table, lang)
  const base = copilotTableFileBase(table, index)
  const download = () => copilotTableDownload(parts, lang, words)
  // "Open as view" needs a query to open; the columns the analysis computed are not in it, and the note says so.
  const opens = author && copilotTableOpensAsView(table)
  const computed = useMemo(() => (opens ? copilotTableComputedColumns(table, definition, lang) : []), [opens, table, definition, lang])
  const openAsView = () => {
    const link = copilotTableOpenAsView(definition)
    navigate(link.to, { state: link.state })
  }

  return (
    <section className="flex min-w-0 flex-col gap-1.5" aria-labelledby={title ? titleId : undefined} data-copilot-table={table.step} data-copilot-table-index={index}>
      <CopilotTableTitle table={table} lang={lang} id={titleId} />
      <TableChart
        columns={view.columns}
        rows={view.rows}
        sort={view.sort}
        locale={lang}
        ariaLabel={tc('charts.tableLabel', { measures: fsi(listText(measures, lang)), dimensions: fsi(listText(dims, lang)) })}
      />
      <TruncatedNote result={result} />
      <UntilNote definition={definition} result={result} model={drawing} lang={lang} />
      <AreaNotes definition={definition} result={result} model={drawing} lang={lang} />
      <LastYearNote result={result} model={drawing} lang={lang} />
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={t('copilotTable.actions')} data-copilot-table-actions>
        <Button
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => downloadCsv(stamped(base, 'csv'), panelCsv(download()))}
          data-copilot-table-action="csv"
        >
          <FileText className="size-3.5" aria-hidden />
          {t('panel.csv')}
        </Button>
        <Button
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => void writeWorkbook([panelSheet(download(), title || (measures[0] ?? ''))], xlsxFileName(base))}
          data-copilot-table-action="xlsx"
        >
          <FileSpreadsheet className="size-3.5" aria-hidden />
          {t('panel.xlsx')}
        </Button>
        {opens && (
          <Button variant="ghost" className="h-7 px-2 text-xs" onClick={openAsView} data-copilot-table-action="open-as-view">
            <ExternalLink className="size-3.5" aria-hidden />
            {t('copilotTable.openAsView')}
          </Button>
        )}
      </div>
      <ComputedColumnsNote columns={computed} lang={lang} />
    </section>
  )
}
