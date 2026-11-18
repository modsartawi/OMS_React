import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'

import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { canViewStoreDb } from '../access'
import ConsoleNav from '../ConsoleNav'

/**
 * One store's database page (BackOffice spec 4016) — `/admin/sync/database/:code`.
 *
 * Oms 915 lays the route and this shell (the header and the way back); 916 fills it with the store's reading and the
 * panel strip, 917–919 add their panels.
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
      {/* 916 grows this into the store's header (name, state, days to cap) and the panel strip. */}
      <h2 className="font-mono text-base font-semibold" data-store-db-code="">
        <Ltr>{code}</Ltr>
      </h2>
    </div>
  )
}
