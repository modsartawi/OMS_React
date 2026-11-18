import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, SearchX, ServerCrash } from 'lucide-react'

import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { StoreDbStore } from '@/core/models/store-database'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatDateTime } from '@/core/util/date-format'
import { canViewStoreDb } from '../access'
import CodeBadgeView from '../CodeBadgeView'
import ConsoleNav from '../ConsoleNav'
import Loading from '../Loading'
import { storeDbStoreQuery } from './api'
import { storeDbStateBadge } from './fleet-helpers'
import { notCheckedBanner } from './reading-helpers'
import StoreDbPanels from './StoreDbPanels'

/**
 * One store's database page (BackOffice spec 4016, door 4031) — `/admin/sync/database/:code`.
 *
 * Oms 915 laid the route and shell; 916 reads `GET StoreDatabase/Store` once here and hands the answer to the header,
 * the Not checked banner and the panel strip (`StoreDbPanels`; the panels themselves mount in `panel-views.tsx`).
 * Store-wide actions (917's Check now) mount in the header's `data-store-db-actions` slot, one line each.
 */
export default function StoreDbStorePage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate can={canViewStoreDb} ns="sync-console" keyPrefix="storeDb.access" title={t('storeDb.title')} subtitle={t('storeDb.subtitle')}>
      <Store />
    </ScreenGate>
  )
}

function Store() {
  const { t } = useTranslation('sync-console')
  const { code = '' } = useParams()
  const store = useQuery(storeDbStoreQuery(code))
  const noStore = store.isError && apiErrorCode(store.error) === 'NO_STORE'
  // As on the console's store page: a failed refresh shows no kept header — an old OK beside an error reads healthy.
  const data = store.isError ? undefined : store.data

  return (
    <div className="flex min-w-0 flex-col gap-4" data-store-db-page={code}>
      <ConsoleNav />
      <Link
        to="/admin/sync/database"
        className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
        data-store-db-back=""
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('storeDb.store.back')}
      </Link>

      {store.isPending && <Loading label={t('storeDb.readings.loading')} />}

      {noStore && (
        <div
          className="mx-auto mt-8 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
          role="alert"
          data-no-store=""
        >
          <SearchX className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
          <div className="text-base font-semibold tracking-tight">{t('storeDb.readings.noStoreTitle')}</div>
          <p className="mt-2 text-sm text-muted-foreground">{t('storeDb.readings.noStoreHint')}</p>
        </div>
      )}

      {store.isError && !noStore && (
        <ErrorBanner className="p-3" message={apiErrorMessage(store.error, t('storeDb.readings.failed'))} />
      )}

      {data && (
        <>
          <Header store={data} />
          <NotChecked store={data} />
          <StoreDbPanels store={data} />
        </>
      )}
    </div>
  )
}

/** Name, code, state and the reading's time; store-wide actions at its end. */
function Header({ store }: { store: StoreDbStore }) {
  const { t } = useTranslation('sync-console')
  const at = store.reading?.takenAt ?? null
  return (
    <section
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-card p-4"
      data-store-db-header=""
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="flex flex-wrap items-baseline gap-2 text-base font-semibold" data-store-db-code="">
          <span className="font-mono">
            <Ltr>{store.code}</Ltr>
          </span>
          <bdi className="font-normal text-muted-foreground">{store.name}</bdi>
        </h2>
        <p className="text-xs text-muted-foreground" data-store-db-taken-at={at ?? ''}>
          {at ? (
            <Trans t={t} i18nKey="storeDb.readings.takenAt" values={{ at: formatDateTime(at) }} components={{ at: <Ltr /> }} />
          ) : (
            t('storeDb.readings.neverRead')
          )}
        </p>
      </div>
      <span data-store-db-state={store.state}>
        <CodeBadgeView badge={storeDbStateBadge(store.state)} code={store.state} />
      </span>
      <div className="ms-auto flex flex-wrap items-center gap-2" data-store-db-actions="">
        {/* Store-wide actions, one line each. 917: <CheckNowButton store={store} /> */}
      </div>
    </section>
  )
}

/** The worker could not read this store: say so above everything, with the server's last error. */
function NotChecked({ store }: { store: StoreDbStore }) {
  const { t } = useTranslation('sync-console')
  const banner = notCheckedBanner(store)
  if (!banner) return null
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-attention-border bg-attention-050 p-4 text-sm text-attention-800"
      data-not-checked=""
    >
      <ServerCrash className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="font-semibold">{t('storeDb.readings.notChecked.title')}</div>
        <p>
          {banner.at ? (
            <Trans
              t={t}
              i18nKey="storeDb.readings.notChecked.body"
              values={{ at: formatDateTime(banner.at) }}
              components={{ at: <Ltr /> }}
            />
          ) : (
            t('storeDb.readings.notChecked.neverTried')
          )}
        </p>
        {banner.error && (
          <div className="flex flex-col gap-0.5" data-not-checked-error="">
            <span className="text-xs font-medium">{t('storeDb.readings.notChecked.error')}</span>
            <bdi className="font-mono text-xs break-words">{banner.error}</bdi>
          </div>
        )}
      </div>
    </div>
  )
}
