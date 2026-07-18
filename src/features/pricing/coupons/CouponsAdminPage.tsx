import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { couponsApi } from './api'
import TemplatesWorkspace from './TemplatesWorkspace'
import InquiryWorkspace from './InquiryWorkspace'
import ImportWorkspace from './ImportWorkspace'

// The web Coupons-Admin screen (map 497 / spec 505; server 517+519). Mirrors
// AuthzAdminPage: an Access-probe gate (spinner → denied card → content), an eyebrow +
// title, and a Templates | Inquiry | Import tablist. Gated by the CouponsAdmin grant —
// Templates + Import are admin-only; Inquiry (support-or-admin) lands with ticket 521,
// so its tab shows a placeholder here. Shares the ['coupons','access'] key with the nav
// probe (issue 429) so it's one call, not two.
type Tab = 'templates' | 'inquiry' | 'import'

const TABS: Tab[] = ['templates', 'inquiry', 'import']

export default function CouponsAdminPage() {
  const { t } = useTranslation('coupons')
  const [tab, setTab] = useState<Tab>('templates')

  const access = useQuery({ queryKey: ['coupons', 'access'], queryFn: () => couponsApi.access() })

  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  // Templates + Import are admin-only; the whole screen opens on CanAdmin (ticket 521
  // widens this to CanAdmin || CanSupport once the support-reachable Inquiry lands).
  if (access.data?.canAdmin !== true) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t('eyebrow')}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
      </div>

      <div
        className="inline-flex gap-1 self-start rounded-lg border border-border/60 bg-muted/40 p-1"
        role="tablist"
        aria-label={t('tabs.ariaLabel')}
      >
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={
              'rounded-md px-4 py-1.5 text-sm font-semibold ' +
              (tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <TemplatesWorkspace />
      ) : tab === 'inquiry' ? (
        <InquiryWorkspace />
      ) : (
        <ImportWorkspace />
      )}
    </section>
  )
}
