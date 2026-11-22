import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ITEM_FILTERS, ITEM_SORTS } from '@/core/models/stock-console'
import { itemsQuery } from './api'
import HowRead from './HowRead'
import { HOW_ITEMS } from './how-sections'
import { buildItemsColumns, itemRowId } from './items-columns'
import ListGrid from './ListGrid'
import type { ListSpec } from './search'
import SearchFrame from './SearchFrame'
import { useListSearch } from './use-list-search'

/** What the Items list owns in the address; the store page's `tab` rides along. */
const ITEMS_LIST: ListSpec = { filters: ITEM_FILTERS, sorts: ITEM_SORTS, keep: ['tab'] }

/**
 * A store's Items tab (oms 941): the search-first frame over `StockConsole/Stores/{store}/Items`. Nothing is read until
 * a search ran. A row's number opens the item's page (943).
 */
export default function ItemsTab({ store }: { store: string }) {
  const { t, i18n } = useTranslation('stock-console')
  const search = useListSearch(ITEMS_LIST)
  const read = useQuery(itemsQuery(store, search.state))
  const columns = useMemo(() => buildItemsColumns(t, i18n.language, store), [t, i18n.language, store])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SearchFrame
        name="items"
        search={search}
        read={read}
        filterLabel={(f) => t(`items.filter.${f}`)}
        sortLabel={(s) => t(`items.sort.${s}`)}
        empty={t('items.empty')}
      >
        <ListGrid rows={read.data?.rows ?? []} columns={columns} rowId={itemRowId} name="items" />
      </SearchFrame>
      <HowRead section="items" paragraphs={HOW_ITEMS} />
    </div>
  )
}
