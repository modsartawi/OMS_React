import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import type { StoreDetail } from '@/core/models/sync-console'
import { resolveStoreTab, storeTabs, type StoreTab } from './store-helpers'
import { storeTabKey } from './api'
import CountersTab from './CountersTab'
import AgreementTab from './AgreementTab'
import AuditTab from './AuditTab'
import CommandsTab from './CommandsTab'
import LocationTab from './LocationTab'
import MirrorTab from './MirrorTab'
import PassesTab from './PassesTab'
import ScriptsTab from './ScriptsTab'
import TransactionsTab from './TransactionsTab'

/**
 * The store page's tabs (ticket 446): Counters, Passes, Commands, Scripts, Audit and
 * Location, then Mirror (spec 2563, ticket 457), Agreement (459) and Transactions (spec
 * 2586, ticket 467) — or Counters, Passes, Mirror, Agreement and Transactions on a WPF
 * store (`storeTabs`).
 *
 * The Loy member's tab shell is the precedent: `?tab=` is the open tab (an unknown or
 * withheld one falls back to the first), switching REPLACES the history entry, and
 * only the open tab's panel is mounted, so a tab reads its door only when opened.
 *
 * Audit is 447's; Commands is 448's.
 *
 * **Refresh** sits at the strip's end and refetches the open tab's reads alone
 * (`storeTabKey`), keeping its page and date: the newest passes, audit rows or
 * commands without leaving the tab. It spins while that tab reads, the poll included.
 */
export default function StoreTabs({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  const [searchParams, setSearchParams] = useSearchParams()
  const tabs = storeTabs(row)
  const open = resolveStoreTab(searchParams.get('tab'), tabs)
  const qc = useQueryClient()
  const tabKey = storeTabKey(row.code, open)
  const reading = useIsFetching({ queryKey: tabKey }) > 0

  const select = (tab: StoreTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card" data-store-tabs={tabs.join(' ')}>
      <div className="flex items-center gap-2 border-b border-border/60 pe-3">
        <div role="tablist" aria-label={t('tabs.label')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-3">
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
        <button
          type="button"
          onClick={() => void qc.invalidateQueries({ queryKey: tabKey })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          data-tab-refresh={open}
        >
          <RefreshCw className={'h-3.5 w-3.5 ' + (reading ? 'animate-spin' : '')} aria-hidden />
          {t('tabs.refresh')}
        </button>
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
        ) : open === 'mirror' ? (
          <MirrorTab row={row} />
        ) : open === 'agreement' ? (
          <AgreementTab row={row} />
        ) : open === 'transactions' ? (
          <TransactionsTab row={row} />
        ) : (
          <CommandsTab code={row.code} />
        )}
      </div>
    </div>
  )
}

/** One panel element, reused by every tab — the strip swaps its contents, not its identity. */
const TAB_PANEL_ID = 'sync-store-tab-panel'
