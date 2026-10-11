import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenSapExport, sapExportAccessQuery } from './access'
import { DOUBLE_SEND_FLAGS } from './fleet-helpers'

/**
 * The double-send list — `/reports/sap-export/double-sends?flag=X1|X1p` (BackOffice spec 2579).
 * A **placeholder until 465** draws the list; the fleet's double-send tiles (463) already link
 * here with their flag. It asks the server nothing beyond the access probe.
 */
export default function DoubleSendsPage() {
  const { t } = useTranslation('sap-export-console')
  return (
    <ScreenGate query={sapExportAccessQuery()} can={canOpenSapExport} ns="sap-export-console" title={t('title')} subtitle={t('subtitle')}>
      <Soon />
    </ScreenGate>
  )
}

function Soon() {
  const { t } = useTranslation('sap-export-console')
  const [params] = useSearchParams()
  // Only the two double-send flags are named; any other value is not shown.
  const asked = params.getAll('flag')
  const flags = DOUBLE_SEND_FLAGS.filter((f) => asked.includes(f))
  return (
    <div className="flex min-w-0 flex-col gap-4" data-double-sends-page={flags.join(' ')}>
      <Link to="/reports/sap-export" className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('doubleSends.back')}
      </Link>
      <h2 className="text-lg font-semibold tracking-tight">{t('doubleSends.heading')}</h2>
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {flags.map((f) => (
            <span key={f} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground" data-double-sends-flag={f}>
              {t(`flags.${f}`)}
            </span>
          ))}
        </div>
      )}
      <section className="flex max-w-xl flex-col gap-1 rounded-lg border border-border/60 bg-card p-4">
        <div className="text-base font-semibold tracking-tight">{t('doubleSends.soonTitle')}</div>
        <p className="text-sm text-muted-foreground">{t('doubleSends.soonHint')}</p>
      </section>
    </div>
  )
}
