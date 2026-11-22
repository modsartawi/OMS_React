import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import { storeTabKey } from './api'
import BatchesTab from './BatchesTab'
import ItemsTab from './ItemsTab'
import { STORE_TABS, resolveStoreTab, tabParams, type StoreTab } from './store-tabs'

/**
 * A store page's tabs (oms 941): the frame for all seven — Items, Holds, Batches, Takes, SAP movements, Feeds, Stage and
 * count — with Items and Batches built here (942 builds Holds, Takes, Feeds and Stage; 945 SAP movements).
 *
 * The open tab is the address's `?tab=`; only its panel is mounted, so only it reads. Switching writes the tab alone
 * (`tabParams`), so the new tab opens on "Nothing is read yet". **Refresh**, at the strip's end, re-reads the open tab
 * alone (`storeTabKey`) — and a list not yet searched stays unread.
 */
export default function StoreTabs({ store }: { store: string }) {
  const { t } = useTranslation('stock-console')
  const [searchParams, setSearchParams] = useSearchParams()
  const open = resolveStoreTab(searchParams.get('tab'))
  const qc = useQueryClient()
  const tabKey = storeTabKey(store, open)
  const reading = useIsFetching({ queryKey: tabKey }) > 0

  const select = (tab: StoreTab) => {
    if (tab !== open) setSearchParams(tabParams(tab), { replace: true })
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card" data-store-tabs="">
      <div className="flex items-center gap-2 border-b border-border/60 pe-3">
        <div role="tablist" aria-label={t('tabs.label')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-3 py-1.5">
          {STORE_TABS.map((tab) => (
            <Chip
              key={tab}
              variant="tab"
              on={open === tab}
              id={`stock-console-tab-${tab}`}
              aria-controls={TAB_PANEL_ID}
              onClick={() => select(tab)}
              data-tab={tab}
            >
              {t(`tabs.${tab}`)}
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
        id={TAB_PANEL_ID}
        aria-labelledby={`stock-console-tab-${open}`}
        className="p-3"
        data-tab-panel={open}
      >
        {open === 'items' ? (
          <ItemsTab store={store} />
        ) : open === 'batches' ? (
          <BatchesTab store={store} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground" data-tab-not-yet={open}>
            {t('tabs.notYet')}
          </p>
        )}
      </div>
    </div>
  )
}

/** One panel element, reused by every tab — the strip swaps its contents, not its identity. */
const TAB_PANEL_ID = 'stock-console-tab-panel'
