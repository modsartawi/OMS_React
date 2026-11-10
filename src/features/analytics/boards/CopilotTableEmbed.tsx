import { useMemo } from 'react'
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
import AreaNotes, { useAreaNoteWords } from './AreaNotes'
import {
  copilotTableDefinition,
  copilotTableDownload,
  copilotTableModel,
  copilotTableOpenAsView,
  copilotTableResult,
  copilotTableView,
  type CopilotTableWords,
} from './copilot-table'
import { panelCsv, panelFileBase, panelSheet } from './panel-table'
import { columnTooltip } from './unsplit'
import TruncatedNote from './TruncatedNote'
import UntilNote from './UntilNote'

/** Until the model arrives (or when it cannot be read) the wire's labels name every column; members show as sent. */
const NO_MODEL: AnalyticsModel = { areas: [], measures: [], dimensions: [] }

/**
 * One table of a copilot answer (ticket 868, BackOffice spec 3558 D5-D6): the view panel's table form over every row
 * as sent (a long table scrolls in its own viewport), its notes (until, notSplit, notFiltered) and "All" rows last, the
 * CSV and xlsx downloads, and "Open as view" — the editor seeded with the table's query, for an author (as the drill's
 * "Save as view", 822). Registered with `@/core/copilot-view-embed` by the app shell; pure pieces in `./copilot-table`.
 */
export default function CopilotTableEmbed({ table }: { table: CopilotAnswerTable }) {
  const { t, i18n } = useTranslation('boards')
  const { t: tc } = useTranslation('common')
  const lang = i18n.language
  const navigate = useNavigate()
  const author = canAuthorAnalytics(useQuery(analyticsAccessQuery()).data)
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false }).data ?? NO_MODEL
  const noteWords = useAreaNoteWords()

  const result = useMemo(() => copilotTableResult(table), [table])
  const definition = useMemo(() => copilotTableDefinition(table), [table])
  const drawing = useMemo(() => copilotTableModel(table, model), [table, model])
  const words: CopilotTableWords = {
    series: t('view.seriesColumn'),
    previous: (measure) => t('view.previousColumn', { measure: fsi(measure) }),
    all: t('view.allMembers'),
    tooltip: (key) => columnTooltip(key, result, drawing, lang, noteWords),
  }
  const view = copilotTableView(table, model, lang, words)

  const dims = view.columns.filter((c) => c.role === 'dimension').map((c) => c.label)
  const measures = view.columns.filter((c) => c.role === 'measure').map((c) => c.label)
  const base = panelFileBase(`copilot-${table.step}`)
  const download = () => copilotTableDownload(table, model, lang, words)
  const openAsView = () => {
    const link = copilotTableOpenAsView(table)
    navigate(link.to, { state: link.state })
  }

  return (
    <section className="flex min-w-0 flex-col gap-1.5" data-copilot-table={table.step}>
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
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={t('copilotTable.actions')} data-copilot-table-actions>
        <Button
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => downloadCsv(xlsxFileName(base).replace(/\.xlsx$/, '.csv'), panelCsv(download()))}
          data-copilot-table-action="csv"
        >
          <FileText className="size-3.5" aria-hidden />
          {t('panel.csv')}
        </Button>
        <Button
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => void writeWorkbook([panelSheet(download(), measures[0] ?? '')], xlsxFileName(base))}
          data-copilot-table-action="xlsx"
        >
          <FileSpreadsheet className="size-3.5" aria-hidden />
          {t('panel.xlsx')}
        </Button>
        {author && (
          <Button variant="ghost" className="h-7 px-2 text-xs" onClick={openAsView} data-copilot-table-action="open-as-view">
            <ExternalLink className="size-3.5" aria-hidden />
            {t('copilotTable.openAsView')}
          </Button>
        )}
      </div>
    </section>
  )
}
