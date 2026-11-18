import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { RefreshCw } from 'lucide-react'

import type { StoreDbStore } from '@/core/models/store-database'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import { storeDbStoreKey } from './api'
import { PANEL_VIEWS } from './panel-views'
import { resolveStoreDbPanel, storeDbPanels, type StoreDbPanel } from './panels'

/**
 * The store page's panel strip (oms 916), on the console's store-tab pattern (`StoreTabs`): `?panel=` is the open
 * panel (an unknown or unmounted one falls back to the first), switching REPLACES the history entry, and only the
 * open panel is mounted, so a panel reads its own door only when opened.
 *
 * **Refresh** re-reads the store (`storeDbStoreKey(code)`) and every OPEN panel's read nested under it.
 */
export default function StoreDbPanels({ store }: { store: StoreDbStore }) {
  const { t } = useTranslation('sync-console')
  const [searchParams, setSearchParams] = useSearchParams()
  const panels = storeDbPanels(Object.keys(PANEL_VIEWS))
  const open = resolveStoreDbPanel(searchParams.get('panel'), panels)
  const View = PANEL_VIEWS[open]
  const qc = useQueryClient()
  const key = storeDbStoreKey(store.code)
  const reading = useIsFetching({ queryKey: key }) > 0

  const select = (panel: StoreDbPanel) => {
    const next = new URLSearchParams(searchParams)
    next.set('panel', panel)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card" data-store-db-panels={panels.join(' ')}>
      <div className="flex items-center gap-2 border-b border-border/60 pe-3">
        <div role="tablist" aria-label={t('storeDb.panels.label')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-3 py-1.5">
          {panels.map((panel) => (
            <Chip
              key={panel}
              variant="tab"
              on={open === panel}
              id={`store-db-panel-${panel}`}
              aria-controls={PANEL_ID}
              onClick={() => select(panel)}
              data-panel={panel}
            >
              {t(`storeDb.panels.${panel}`)}
            </Chip>
          ))}
        </div>
        <Button
          variant="outlined"
          onClick={() => void qc.invalidateQueries({ queryKey: key })}
          className="shrink-0"
          data-store-db-refresh=""
        >
          <RefreshCw className={'h-3.5 w-3.5 ' + (reading ? 'animate-spin' : '')} aria-hidden />
          {t('storeDb.panels.refresh')}
        </Button>
      </div>
      <div role="tabpanel" id={PANEL_ID} aria-labelledby={`store-db-panel-${open}`} className="p-3" data-panel-open={open}>
        {View && <View store={store} />}
      </div>
    </div>
  )
}

/** One panel element — the strip swaps its contents, not its identity. */
const PANEL_ID = 'store-db-panel'
