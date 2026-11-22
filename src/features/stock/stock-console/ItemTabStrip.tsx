import type { ReactNode } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import { itemTabKey } from './api'
import HowRead from './HowRead'
import { HOW_ITEM_STORES } from './how-sections'
import { ITEM_TABS, itemTabParams, resolveItemTab, type ItemTab } from './item-tabs'
import { ItemBatchesTab, ItemHoldsTab, ItemTakesTab, type ItemTabProps } from './ItemTabPanels'
import ItemStoresList from './ItemStoresList'
import MovementsTab from './MovementsTab'

/** Each tab's panel. Movements (945) reads only by its own Read button, never on opening. */
const PANELS: Record<ItemTab, (props: ItemTabProps) => ReactNode> = {
  batches: (p) => <ItemBatchesTab {...p} />,
  holds: (p) => <ItemHoldsTab {...p} />,
  takes: (p) => <ItemTakesTab {...p} />,
  stores: (p) => <ItemStoresTab {...p} />,
  movements: (p) => <MovementsTab {...p} />,
}

/**
 * An item page's tabs (oms 943, spec 4157 stories 56–61): Batches, Holds, Takes, Other stores, and Movements (945).
 * Each but Movements is one small read on opening. The open tab is the address's `?tab=`; only its panel is mounted, so only it reads.
 * Switching writes the tab alone. **Refresh** re-reads the open tab alone (`itemTabKey`).
 */
export default function ItemTabStrip({ store, item }: ItemTabProps) {
  const { t } = useTranslation('stock-console')
  const [searchParams, setSearchParams] = useSearchParams()
  const open = resolveItemTab(searchParams.get('tab'))
  const qc = useQueryClient()
  const tabKey = itemTabKey(store, item, open)
  const reading = useIsFetching({ queryKey: tabKey }) > 0

  const select = (tab: ItemTab) => {
    if (tab !== open) setSearchParams(itemTabParams(tab), { replace: true })
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card" data-item-tabs="">
      <div className="flex items-center gap-2 border-b border-border/60 pe-3">
        <div role="tablist" aria-label={t('itemTabs.label')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-3 py-1.5">
          {ITEM_TABS.map((tab) => (
            <Chip
              key={tab}
              variant="tab"
              on={open === tab}
              id={`stock-console-item-tab-${tab}`}
              aria-controls={ITEM_TAB_PANEL_ID}
              onClick={() => select(tab)}
              data-item-tab={tab}
            >
              {t(`itemTabs.${tab}`)}
            </Chip>
          ))}
        </div>
        <Button
          variant="outlined"
          onClick={() => void qc.invalidateQueries({ queryKey: tabKey })}
          className="shrink-0"
          data-tab-refresh={open}
        >
          <RefreshCw className={'h-3.5 w-3.5 ' + (reading ? 'animate-spin' : '')} aria-hidden />
          {t('tabs.refresh')}
        </Button>
      </div>
      <div
        role="tabpanel"
        id={ITEM_TAB_PANEL_ID}
        aria-labelledby={`stock-console-item-tab-${open}`}
        className="p-3"
        data-item-tab-panel={open}
      >
        {PANELS[open]({ store, item })}
      </div>
    </div>
  )
}

/** One panel element, reused by every tab — the strip swaps its contents, not its identity. */
const ITEM_TAB_PANEL_ID = 'stock-console-item-tab-panel'

/** The item at every store, its page in the address beside the tab (`?tab=stores&page=2`). */
function ItemStoresTab({ item }: ItemTabProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const asked = Number.parseInt(searchParams.get('page') ?? '', 10)
  const page = Number.isFinite(asked) && asked >= 1 ? asked : 1
  const onPage = (n: number) => {
    const next = itemTabParams('stores')
    if (n > 1) next.set('page', String(n))
    setSearchParams(next, { replace: true })
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ItemStoresList item={item} page={page} onPage={onPage} />
      <HowRead section="itemStores" paragraphs={HOW_ITEM_STORES} />
    </div>
  )
}
