import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, SearchX } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenSyncConsole, storeQuery, syncConsoleAccessQuery } from './api'
import { isWpfStore } from './store-helpers'
import HourStrip from './HourStrip'
import StoreControls from './StoreControls'
import StoreHeader from './StoreHeader'
import StoreHealth from './StoreHealth'
import StoreTabs from './StoreTabs'
import Loading from './Loading'

/**
 * One store's sync page (spec 444, ticket 446) — `/admin/sync/store/:code`.
 *
 * Top to bottom as the owner-accepted prototype lays it out: the header (host,
 * states, pending), the health summary, the 24 h strip, then the tabs. Read-only in
 * 446; 447 adds the controls the store's host allows (`StoreControls`, under the
 * health), and 448 its commands.
 *
 * 🚩 **A WPF store** has no health row, so it shows only its Counters and Passes,
 * with a note that WPF still syncs it — no health summary, no strip (whose hours
 * would all be "no data") and no tab the worker alone writes.
 */
export default function StorePage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <Store />
    </ScreenGate>
  )
}

function Store() {
  const { t } = useTranslation('sync-console')
  const { code = '' } = useParams()
  const store = useQuery(storeQuery(code))
  const noStore = store.isError && apiErrorCode(store.error) === 'NO_STORE'
  // 🚩 As on the Fleet page, a failed refresh shows no kept HEALTH: an old healthy
  // header beside the error would read as a healthy store. The strip and the tabs
  // read their own doors, so they stay on their last good answer — one failed 30 s
  // refresh must not throw away the page a reader is half-way through.
  const row = store.isError ? undefined : store.data
  const known = noStore ? undefined : store.data

  return (
    <div className="flex min-w-0 flex-col gap-4" data-store-page={code}>
      <Link
        to="/admin/sync"
        className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('store.back')}
      </Link>

      {store.isPending && <Loading label={t('store.loading')} />}

      {noStore && (
        <div
          className="mx-auto mt-8 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
          role="alert"
          data-no-store=""
        >
          <SearchX className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
          <div className="text-base font-semibold tracking-tight">{t('store.noStoreTitle')}</div>
          <p className="mt-2 text-sm text-muted-foreground">{t('store.noStoreHint')}</p>
        </div>
      )}

      {store.isError && !noStore && (
        <ErrorBanner className="p-3" message={apiErrorMessage(store.error, t('store.failed'))} />
      )}

      {row && (
        <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-store-header="">
          <StoreHeader row={row} />
          {isWpfStore(row) ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" data-wpf-note="">
              {t('store.wpfNote')}
            </p>
          ) : (
            <StoreHealth row={row} />
          )}
          {/* Keyed on the store, so one store's refused list never shows under another's controls. */}
          <StoreControls key={row.code} row={row} />
        </section>
      )}
      {known && (
        <>
          {!isWpfStore(known) && <HourStrip code={known.code} />}
          {/* Keyed on the store, so a link to another store resets every tab's own page state. */}
          <StoreTabs key={known.code} row={known} />
        </>
      )}
    </div>
  )
}
