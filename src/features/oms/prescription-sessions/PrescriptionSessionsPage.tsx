import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import EndedTab from './EndedTab'
import OpenTab from './OpenTab'
import { HQ_TABS, tabFromParams, tabParams, type HqTab } from './tab'
import ToOpenTab from './ToOpenTab'
import Chip from '@/core/ui/Chip'

const PANEL_ID = 'ps-hq-tab-panel'

/**
 * OMS ▸ Prescription sessions (BackOffice spec 2994 "The HQ list"; tickets 545-548): HQ's read
 * across stores. Three tabs, the tab in the URL (`./tab`): **Open** (545), **To open** (546),
 * **Ended** (547). Each tab is its own file and owns the rest of the address while shown, so the
 * three tickets do not touch one another's code.
 *
 * No access probe exists (BackOffice 3015 built none): the menu leaf shows to everyone and the tab
 * that meets the bare 403 names the missing grant (`./Denied`).
 */
export default function PrescriptionSessionsPage() {
  const { t } = useTranslation('prescription-sessions')
  const [params, setParams] = useSearchParams()
  const tab = tabFromParams(params)
  const select = (next: HqTab) => {
    if (next !== tab) setParams(tabParams(next))
  }

  return (
    <section className="flex h-full w-full flex-col gap-4" data-ps-hq="" data-ps-tab={tab}>
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>

      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1 border-b border-border pb-2">
        {HQ_TABS.map((id) => (
          <Chip
            key={id}
            variant="tab"
            on={tab === id}
            id={`ps-hq-tab-${id}`}
            aria-controls={PANEL_ID}
            onClick={() => select(id)}
            data-ps-tab-button={id}
          >
            {t(`tabs.${id}`)}
          </Chip>
        ))}
      </div>

      <div role="tabpanel" id={PANEL_ID} aria-labelledby={`ps-hq-tab-${tab}`}>
        {tab === 'open' && <OpenTab />}
        {tab === 'toOpen' && <ToOpenTab />}
        {tab === 'ended' && <EndedTab />}
      </div>
    </section>
  )
}
