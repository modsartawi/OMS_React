import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { localToday } from '@/core/util/date-window'
import { itemBatchesQuery, itemHoldsQuery, itemTakesQuery } from './api'
import { batchRowId, buildBatchesColumns } from './batches-columns'
import { buildHoldsColumns, holdRowId } from './holds-columns'
import HowRead from './HowRead'
import { HOW_ITEM_BATCHES, HOW_ITEM_HOLDS, HOW_ITEM_TAKES } from './how-sections'
import { withoutItemColumns } from './item-tabs'
import FailedLeftOut from './FailedLeftOut'
import ItemTabListFrame from './ItemTabListFrame'
import { buildTakesColumns, takeRowId } from './takes-columns'

/** What every item tab is given: the store and the item of the page. */
export interface ItemTabProps {
  store: string
  item: string
}

/**
 * The item's Batches (oms 943, spec 4157 story 56): the store's Batches read for this item, on 941's columns without the
 * item's own — expiry with its marks, and free for the take door.
 */
export function ItemBatchesTab({ store, item }: ItemTabProps) {
  const { t, i18n } = useTranslation('stock-console')
  const read = useQuery(itemBatchesQuery(store, item))
  // The reader's local day, taken once while the tab is open: the expiry marks compare against it.
  const today = useMemo(() => localToday(), [])
  const columns = useMemo(
    () => withoutItemColumns(buildBatchesColumns(t, i18n.language, store, today)),
    [t, i18n.language, store, today],
  )
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ItemTabListFrame name="item-batches" read={read} empty={t('itemTabs.empty.batches')} columns={columns} rowId={batchRowId} />
      <HowRead section="itemBatches" paragraphs={HOW_ITEM_BATCHES} />
    </div>
  )
}

/**
 * The item's Holds (story 57): open and released in the last 7 days, one list — so on 942's columns with when and why a
 * hold was released. A hold's age is measured when the list was read.
 */
export function ItemHoldsTab({ store, item }: ItemTabProps) {
  const { t, i18n } = useTranslation('stock-console')
  const read = useQuery(itemHoldsQuery(store, item))
  const now = read.dataUpdatedAt
  const columns = useMemo(
    () => withoutItemColumns(buildHoldsColumns(t, i18n.language, store, 'released', now)),
    [t, i18n.language, store, now],
  )
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ItemTabListFrame name="item-holds" read={read} empty={t('itemTabs.empty.holds')} columns={columns} rowId={holdRowId} />
      <HowRead section="itemHolds" paragraphs={HOW_ITEM_HOLDS} />
    </div>
  )
}

/** The item's Takes (story 58): today and the two days before, on 942's columns. Failed calls carry no item. */
export function ItemTakesTab({ store, item }: ItemTabProps) {
  const { t, i18n } = useTranslation('stock-console')
  const read = useQuery(itemTakesQuery(store, item))
  const columns = useMemo(
    () => withoutItemColumns(buildTakesColumns(t, i18n.language, store)),
    [t, i18n.language, store],
  )
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ItemTabListFrame
        name="item-takes"
        read={read}
        empty={t('itemTabs.empty.takes')}
        columns={columns}
        rowId={takeRowId}
        above={read.data?.failedLeftOut && <FailedLeftOut />}
      />
      <HowRead section="itemTakes" paragraphs={HOW_ITEM_TAKES} />
    </div>
  )
}
