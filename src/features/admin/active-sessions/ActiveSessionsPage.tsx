import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { sessionMonitorApi } from './api'

// Ticket 007 — the access SPINE, before any data. The screen probes its own
// grant (BackOfficeScreen[UaSessions,03]) via ['active-sessions','access'], the
// same key the shell's nav probe uses, so it's one network call. Three states:
// checking → spinner; no grant → denied card; grant → the empty screen shell
// (title + inert search box + empty-grid placeholder). The search box and grid
// are wired in ticket 008; here they only prove the shell renders end-to-end.
export default function ActiveSessionsPage() {
  const { t } = useTranslation('active-sessions')

  const access = useQuery({
    queryKey: ['active-sessions', 'access'],
    queryFn: () => sessionMonitorApi.access(),
  })

  // ----- access states ------------------------------------------------------
  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (access.data?.canOpen !== true) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  // ----- empty screen shell (inert until ticket 008) ------------------------
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>

      {/* search box — inert for now (wired in 008), disabled so it can't mislead */}
      <div className="flex overflow-hidden rounded-full border border-input bg-background">
        <span className="flex items-center ps-4 text-muted-foreground">
          <Search className="h-4 w-4" />
        </span>
        <input
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          placeholder={t('search.placeholder')}
          disabled
        />
        <button className="bg-primary px-4 text-sm font-medium text-primary-foreground opacity-60" disabled>
          {t('search.button')}
        </button>
      </div>

      {/* empty-grid placeholder */}
      <div className="flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-10 text-center">
          <b className="text-sm">{t('grid.emptyTitle')}</b>
          <span className="max-w-sm text-sm text-muted-foreground">{t('grid.emptyHint')}</span>
        </div>
      </div>
    </section>
  )
}
