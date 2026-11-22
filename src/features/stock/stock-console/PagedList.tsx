import type { ColDef } from 'ag-grid-community'
import { Trans, useTranslation } from 'react-i18next'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import { formatFigure } from '@/core/util/number-format'
import ListGrid from './ListGrid'
import { STOCK_CONSOLE_PAGE_SIZE } from './search'

/**
 * One page of a list read by a button (oms 945: an opened SAP row's lines, an item's ledger lines): the count of the
 * whole match, at most 25 rows, and the pager when there are more.
 */
export default function PagedList<T>({
  name,
  rows,
  total,
  page,
  busy,
  onPage,
  columns,
  rowId,
}: {
  name: string
  rows: T[]
  total: number
  page: number
  busy: boolean
  onPage: (page: number) => void
  columns: ColDef<T>[]
  rowId: (row: T) => string
}) {
  const { t } = useTranslation('stock-console')
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs text-muted-foreground" data-list-count={total}>
        <Trans t={t} i18nKey="search.count" count={total} values={{ n: formatFigure(total) }} components={{ n: <Ltr /> }} />
      </span>
      <ListGrid rows={rows} columns={columns} rowId={rowId} name={name} />
      {showsPager(total, STOCK_CONSOLE_PAGE_SIZE) && (
        <GridPager page={page} pageSize={STOCK_CONSOLE_PAGE_SIZE} totalMatches={total} busy={busy} onPage={onPage} />
      )}
    </div>
  )
}
