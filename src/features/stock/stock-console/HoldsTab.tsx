import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HOLD_STATES } from '@/core/models/stock-console'
import { holdsQuery } from './api'
import { buildHoldsColumns, holdRowId } from './holds-columns'
import HowRead from './HowRead'
import { HOW_HOLDS } from './how-sections'
import ListGrid from './ListGrid'
import type { ListSpec } from './search'
import SearchFrame from './SearchFrame'
import { useListSearch } from './use-list-search'

/** What the Holds list owns in the address: its state filter (standing and sold not applied by default), no sort. */
const HOLDS_LIST: ListSpec = { filters: HOLD_STATES, keep: ['tab'] }

/**
 * A store's Holds tab (oms 942, spec 4157 stories 36–39): the search-first frame over
 * `StockConsole/Stores/{store}/Holds`, oldest first. Released in the last 7 days adds when and why. A hold's age is
 * measured when the page was read.
 */
export default function HoldsTab({ store }: { store: string }) {
  const { t, i18n } = useTranslation('stock-console')
  const search = useListSearch(HOLDS_LIST)
  const read = useQuery(holdsQuery(store, search.state))
  const filter = search.state.filter
  const now = read.dataUpdatedAt
  const columns = useMemo(
    () => buildHoldsColumns(t, i18n.language, store, filter, now),
    [t, i18n.language, store, filter, now],
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SearchFrame
        name="holds"
        search={search}
        read={read}
        filterLabel={(f) => t(`holds.filter.${f}`)}
        empty={t('holds.empty')}
      >
        <ListGrid rows={read.data?.rows ?? []} columns={columns} rowId={holdRowId} name="holds" />
      </SearchFrame>
      <HowRead section="holds" paragraphs={HOW_HOLDS} />
    </div>
  )
}
