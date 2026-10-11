import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, CalendarSearch } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { toIsoDate } from '@/core/util/date-format'
import { canOpenSapExport, sapExportAccessQuery } from './access'

/**
 * One store — `/reports/sap-export/store/:code` (BackOffice spec 2579). A **placeholder until 464**
 * draws the store's facts and its 30-day strip here; the fleet list (463) already links to it.
 *
 * Meanwhile it keeps the way into a store-day that 461's entry page carried: a business day opens
 * `/reports/sap-export/store/:code/day/:day`. It asks the server nothing beyond the access probe.
 */
export default function StorePage() {
  const { t } = useTranslation('sap-export-console')
  const { code = '' } = useParams()
  return (
    <ScreenGate query={sapExportAccessQuery()} can={canOpenSapExport} ns="sap-export-console" title={t('title')} subtitle={t('subtitle')}>
      <OpenDay key={code} code={code} />
    </ScreenGate>
  )
}

/** Yesterday, local — the most recent day a morning reader asks about. */
function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toIsoDate(d)
}

function OpenDay({ code }: { code: string }) {
  const { t } = useTranslation('sap-export-console')
  const navigate = useNavigate()
  const [day, setDay] = useState(yesterday)

  const open = (e: FormEvent) => {
    e.preventDefault()
    if (!day) return
    navigate(`/reports/sap-export/store/${encodeURIComponent(code)}/day/${encodeURIComponent(day)}`)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4" data-store-page={code}>
      <Link to="/reports/sap-export" className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('store.back')}
      </Link>
      <h2 className="text-lg font-semibold tracking-tight">
        <Trans t={t} i18nKey="store.heading" values={{ code }} components={{ v: <Ltr /> }} />
      </h2>
      <section className="flex max-w-xl flex-col gap-3 rounded-lg border border-border/60 bg-card p-4">
        <div>
          <div className="text-base font-semibold tracking-tight">{t('store.soonTitle')}</div>
          <p className="mt-1 text-sm text-muted-foreground">{t('store.soonHint')}</p>
        </div>
        <form className="flex flex-wrap items-end gap-3" onSubmit={open} data-open-day-form="">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('store.day')}
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="h-7 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60"
              data-open-day-day=""
            />
          </label>
          <Button type="submit" variant="primary" disabled={!day} data-open-day-submit="">
            <CalendarSearch className="h-3.5 w-3.5" aria-hidden />
            {t('store.open')}
          </Button>
        </form>
      </section>
    </div>
  )
}
