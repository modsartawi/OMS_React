import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenSyncConsole, syncConsoleAccessQuery } from './api'

/**
 * One store's sync page — `/admin/sync/store/:code`.
 *
 * ⚠️ A **placeholder** in ticket 445, so the fleet table's links land somewhere
 * real; ticket 446 builds the page (header, health, 24 h strip and the tabs). It
 * stands behind the same gate as the Fleet page.
 */
export default function StorePage() {
  const { t } = useTranslation('sync-console')
  const { code = '' } = useParams()
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <div className="flex flex-col gap-3" data-store-page={code}>
        <Link
          to="/admin/sync"
          className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t('store.back')}
        </Link>
        <p className="font-mono text-2xl font-medium">
          <Ltr>{code}</Ltr>
        </p>
        <p className="text-sm text-muted-foreground">{t('store.placeholder')}</p>
      </div>
    </ScreenGate>
  )
}
