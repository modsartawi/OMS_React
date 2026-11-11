import { useTranslation } from 'react-i18next'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'

/**
 * The line under an analysis table's "Open as view" (ticket 878; BackOffice spec 3587 B22, ticket 3621): the view opens
 * the table's own query, and the columns the analysis computed itself (before, after, change, share) are not part of
 * it — "Open as view shows the table's query only, without Before, After, Change and Share of the change (computed by
 * the analysis)." `columns` are those columns' headers in the screen's language (`./copilot-table`
 * `copilotTableComputedColumns`), listed and isolated once. Nothing when there are none.
 */
export default function ComputedColumnsNote({ columns, lang }: { columns: readonly string[]; lang: string }) {
  const { t } = useTranslation('boards')
  if (columns.length === 0) return null
  return (
    <p className="text-xs text-muted-foreground" role="note" data-copilot-table-computed-note>
      {t('copilotTable.computedColumns', { columns: fsi(listText(columns, lang)) })}
    </p>
  )
}
