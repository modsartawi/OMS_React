import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BATCH_FILTERS } from '@/core/models/stock-console'
import { localToday } from '@/core/util/date-window'
import { batchesQuery } from './api'
import { batchRowId, buildBatchesColumns } from './batches-columns'
import HowRead from './HowRead'
import { HOW_BATCHES } from './how-sections'
import ListGrid from './ListGrid'
import type { ListSpec } from './search'
import SearchFrame from './SearchFrame'
import { useListSearch } from './use-list-search'

/** What the Batches list owns in the address: no sort (the server sorts item, then expiry). */
const BATCHES_LIST: ListSpec = { filters: BATCH_FILTERS, keep: ['tab'] }

/**
 * A store's Batches tab (oms 941): the search-first frame over `StockConsole/Stores/{store}/Batches`. A vendor batch is
 * searched with or without an item; each row marks a placeholder batch and an expired or soon-expiring one.
 */
export default function BatchesTab({ store }: { store: string }) {
  const { t, i18n } = useTranslation('stock-console')
  const search = useListSearch(BATCHES_LIST)
  const read = useQuery(batchesQuery(store, search.state))
  // The reader's local day, taken once while the tab is open: the expiry marks compare against it.
  const today = useMemo(() => localToday(), [])
  const columns = useMemo(
    () => buildBatchesColumns(t, i18n.language, store, today),
    [t, i18n.language, store, today],
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SearchFrame
        name="batches"
        search={search}
        read={read}
        filterLabel={(f) => t(`batches.filter.${f}`)}
        empty={t('batches.empty')}
      >
        <ListGrid rows={read.data?.rows ?? []} columns={columns} rowId={batchRowId} name="batches" />
      </SearchFrame>
      <HowRead section="batches" paragraphs={HOW_BATCHES} />
    </div>
  )
}
