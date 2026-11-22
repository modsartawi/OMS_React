import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import { formatFigure } from '@/core/util/number-format'
import { itemStoresQuery } from './api'
import { buildItemStoresColumns, itemStoreRowId } from './item-stores-columns'
import ListGrid from './ListGrid'
import Loading from './Loading'
import RefusalBanner from './RefusalBanner'
import { STOCK_CONSOLE_PAGE_SIZE } from './search'

/**
 * The item at every store (oms 943, spec 4157 story 59), 25 a page — the item page's Other stores tab and Find's view of
 * an item found. Read on opening. Each row opens the same item at its store. The page is the caller's (the item page's
 * `page`, Find's `storesPage`), so a link keeps it.
 */
export default function ItemStoresList({ item, page, onPage }: { item: string; page: number; onPage: (page: number) => void }) {
  const { t } = useTranslation('stock-console')
  const read = useQuery(itemStoresQuery(item, page))
  const columns = useMemo(() => buildItemStoresColumns(t, item), [t, item])

  if (read.isError) return <RefusalBanner error={read.error} />
  if (!read.data) return <Loading label={t('itemTabs.loading')} />
  const { rows, total } = read.data
  if (total === 0 && rows.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-list-empty="item-stores">
        {t('itemTabs.empty.stores')}
      </p>
    )
  return (
    <div className="flex min-w-0 flex-col gap-2" data-item-stores={item}>
      <span className="text-xs text-muted-foreground" data-list-count={total}>
        <Trans t={t} i18nKey="search.count" count={total} values={{ n: formatFigure(total) }} components={{ n: <Ltr /> }} />
      </span>
      <ListGrid rows={rows} columns={columns} rowId={itemStoreRowId} name="item-stores" />
      {showsPager(total, STOCK_CONSOLE_PAGE_SIZE) && (
        <GridPager
          page={page}
          pageSize={STOCK_CONSOLE_PAGE_SIZE}
          totalMatches={total}
          busy={read.isFetching || read.isPlaceholderData}
          onPage={onPage}
        />
      )}
    </div>
  )
}
