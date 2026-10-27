import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { documentTypeHistoryQuery, type HistoryQuery } from './change-log-api'
import { DOC_TYPE_TABS, docTypeTabFromParams, docTypeTabParams, type DocTypeTab } from './doc-type-tab'
import HistoryTab from './HistoryTab'
import TabStrip from './TabStrip'

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
  const select = (tab: DocTypeTab) => setParams(docTypeTabParams(tab), { replace: true })

  return (
    <div className="flex min-w-0 flex-col gap-3" data-doc-type-tabs="">
      <TabStrip tabs={DOC_TYPE_TABS} open={open} onSelect={select} idPrefix="doc-type" label={t('tabs.label')} tabLabel={(tab) => t(`tabs.${tab}`)}>
        {open === 'history' ? <HistoryTab query={historyQuery ?? documentTypeHistoryQuery(code)} /> : settings}
      </TabStrip>
    </div>
  )
}
