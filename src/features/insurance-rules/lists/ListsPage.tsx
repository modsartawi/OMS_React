import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import ItemLists from './ItemLists'
import KeyedLists from './KeyedLists'

const TABS = ['items', 'patients', 'policies'] as const
type Tab = (typeof TABS)[number]
const PANEL_ID = 'insurance-lists-panel'

/**
 * Insurance rules ▸ Lists — `/insurance-rules/lists` (BackOffice spec 3126, doors 3132 + 3133; oms ticket 610).
 * Three tabs (`?tab=`): **Items** — the ruleset's item lists, built from registry fields (any of / none of),
 * other lists included or taken out (three deep, no cycle), previewed before the save; **Patients** and
 * **Policies** — the keyed lists a rule excludes (VIP), with who added each entry, why, until when, and the log.
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on a read is "You do not have access".
 */
export default function ListsPage() {
  const { t } = useTranslation('insurance-lists')
  const [params, setParams] = useSearchParams()
  const open: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'items'
  const select = (tab: Tab) => {
    const next = new URLSearchParams()
    if (tab !== 'items') next.set('tab', tab)
    setParams(next, { replace: true })
  }
  return (
    <section className="flex w-full flex-col gap-4" data-lists-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('page.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page.lede')}</p>
      </header>
      <div role="tablist" aria-label={t('page.tabs')} className="flex gap-1 border-b border-border/60">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={open === tab}
            aria-controls={PANEL_ID}
            onClick={() => select(tab)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${open === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            data-lists-tab={tab}
          >
            {t(`tab.${tab}`)}
          </button>
        ))}
      </div>
      <div id={PANEL_ID} role="tabpanel">
        {open === 'items' && <ItemLists />}
        {open === 'patients' && <KeyedLists key="patient" kind="patient" />}
        {open === 'policies' && <KeyedLists key="policy" kind="policy" />}
      </div>
    </section>
  )
}
