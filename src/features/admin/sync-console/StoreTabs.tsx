import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import type { StoreDetail } from '@/core/models/sync-console'
import { resolveStoreTab, storeTabs, type StoreTab } from './store-helpers'
import CountersTab from './CountersTab'
import AuditTab from './AuditTab'
import LocationTab from './LocationTab'
import PassesTab from './PassesTab'
import ScriptsTab from './ScriptsTab'

/**
 * The store page's tabs (ticket 446): Counters, Passes, Commands, Scripts, Audit and
 * Location — or Counters and Passes alone on a WPF store (`storeTabs`).
 *
 * The Loy member's tab shell is the precedent: `?tab=` is the open tab (an unknown or
 * withheld one falls back to the first), switching REPLACES the history entry, and
 * only the open tab's panel is mounted, so a tab reads its door only when opened.
 *
 * Commands is a placeholder until 448 fills it; Audit is 447's.
 */
export default function StoreTabs({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  const [searchParams, setSearchParams] = useSearchParams()
  const tabs = storeTabs(row)
  const open = resolveStoreTab(searchParams.get('tab'), tabs)

  const select = (tab: StoreTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card" data-store-tabs={tabs.join(' ')}>
      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1 overflow-x-auto border-b border-border/60 px-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`sync-store-tab-${tab}`}
            aria-selected={open === tab}
            aria-controls={TAB_PANEL_ID}
            onClick={() => select(tab)}
            data-tab={tab}
            className={
              'border-b-2 px-3 py-2 text-sm transition-colors ' +
              (open === tab
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={TAB_PANEL_ID} aria-labelledby={`sync-store-tab-${open}`} className="p-3" data-tab-panel={open}>
        {open === 'counters' ? (
          <CountersTab code={row.code} />
        ) : open === 'passes' ? (
          <PassesTab code={row.code} />
        ) : open === 'scripts' ? (
          <ScriptsTab code={row.code} />
        ) : open === 'location' ? (
          <LocationTab code={row.code} />
        ) : open === 'audit' ? (
          <AuditTab code={row.code} />
        ) : (
          // Commands (448) lands in its own slice.
          <p className="py-6 text-center text-sm text-muted-foreground" data-tab-placeholder={open}>
            {t(`placeholder.${open}`)}
          </p>
        )}
      </div>
    </div>
  )
}

/** One panel element, reused by every tab — the strip swaps its contents, not its identity. */
const TAB_PANEL_ID = 'sync-store-tab-panel'
