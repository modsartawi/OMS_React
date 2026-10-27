import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { documentTypeHistoryQuery, type HistoryQuery } from './change-log-api'
import { DOC_TYPE_TABS, docTypeTabFromParams, docTypeTabParams, type DocTypeTab } from './doc-type-tab'
import HistoryTab from './HistoryTab'

const TAB_PANEL_ID = 'doc-type-tab-panel'

/**
 * The document type page's tabs (ticket 3152): Settings (the grouped detail, the default) and History. `?tab=` is the
 * open tab; a switch REPLACES the history entry. Only the open tab is mounted, so History reads its door only when
 * opened (and afresh each time, so a save just made shows). The serving-list `ListTabs` shape. A delivery type (3154)
 * mounts the same tabs with its own `historyQuery`.
 */
export default function DocumentTypeTabs({
  code,
  settings,
  historyQuery,
}: {
  code: string
  settings: ReactNode
  historyQuery?: HistoryQuery
}) {
  const { t } = useTranslation('doc-type-config')
  const [params, setParams] = useSearchParams()
  const open = docTypeTabFromParams(params)
  const select = (tab: DocTypeTab) => {
    if (tab !== open) setParams(docTypeTabParams(tab), { replace: true })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3" data-doc-type-tabs="">
      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1 border-b border-border/60">
        {DOC_TYPE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`doc-type-tab-${tab}`}
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
      <div role="tabpanel" id={TAB_PANEL_ID} aria-labelledby={`doc-type-tab-${open}`} data-tab-panel={open}>
        {open === 'history' ? <HistoryTab query={historyQuery ?? documentTypeHistoryQuery(code)} /> : settings}
      </div>
    </div>
  )
}
