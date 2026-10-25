import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import type { ServingListRow } from '@/core/models/serving-list'
import HistoryTab from './HistoryTab'
import MembersTab from './MembersTab'
import { LIST_TABS, tabFromParams, tabParams, type ListTab } from './tab'

/**
 * The detail's tabs (oms ticket 568): Members (568, the default) and History (571). `?tab=` is the open
 * tab; a switch REPLACES the history entry and starts the new tab from `tabParams` alone, so one tab's
 * filters never leak into the other. Only the open tab's panel is mounted, so a tab reads its door only
 * when opened.
 */
export default function ListTabs({ servingListId, list, canEdit }: { servingListId: string; list: ServingListRow | undefined; canEdit: boolean }) {
  const { t } = useTranslation('serving-lists')
  const [params, setParams] = useSearchParams()
  const open = tabFromParams(params)
  const select = (tab: ListTab) => {
    if (tab !== open) setParams(tabParams(tab), { replace: true })
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card" data-list-tabs="">
      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1 border-b border-border/60 px-3">
        {LIST_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`serving-list-tab-${tab}`}
            aria-selected={open === tab}
            aria-controls={TAB_PANEL_ID}
            onClick={() => select(tab)}
            data-tab={tab}
            className={
              'border-b-2 px-3 py-2 text-sm transition-colors ' +
              (open === tab ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={TAB_PANEL_ID} aria-labelledby={`serving-list-tab-${open}`} className="p-3" data-tab-panel={open}>
        {open === 'history' ? (
          <HistoryTab servingListId={servingListId} list={list} />
        ) : (
          <MembersTab servingListId={servingListId} list={list} canEdit={canEdit} />
        )}
      </div>
    </div>
  )
}

const TAB_PANEL_ID = 'serving-list-tab-panel'
