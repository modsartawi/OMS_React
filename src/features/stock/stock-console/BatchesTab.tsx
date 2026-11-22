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
import { useScan } from './use-scan'

/** What the Batches list owns in the address: no sort (the server sorts item, then expiry). */
const BATCHES_LIST: ListSpec = { filters: BATCH_FILTERS, keep: ['tab'] }

/**
 * A store's Batches tab (oms 941): the search-first frame over `StockConsole/Stores/{store}/Batches`. A vendor batch is
 * searched with or without an item; each row marks a placeholder batch and an expired or soon-expiring one. The GS1
 * box (944) searches a scanned code's item and lot, and each row then says whether its expiry is the scan's.
 */
export default function BatchesTab({ store }: { store: string }) {
  const { t, i18n } = useTranslation('stock-console')
  const search = useListSearch(BATCHES_LIST)
  const scan = useScan(search)
  const read = useQuery(batchesQuery(store, scan.state))
  // The reader's local day, taken once while the tab is open: the expiry marks compare against it.
  const today = useMemo(() => localToday(), [])
  const columns = useMemo(
    () => buildBatchesColumns(t, i18n.language, store, today, scan.answer),
    [t, i18n.language, store, today, scan.answer],
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SearchFrame
        name="batches"
        filterLabel={(f) => t(`batches.filter.${f}`)}
        empty={t('batches.empty')}
        {...scan.frame(read)}
      >
        <ListGrid rows={read.data?.rows ?? []} columns={columns} rowId={batchRowId} name="batches" />
      </SearchFrame>
      <HowRead section="batches" paragraphs={HOW_BATCHES} />
    </div>
  )
}
