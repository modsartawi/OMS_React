import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { CalendarSearch } from 'lucide-react'
import Button from '@/core/ui/Button'
import ScreenGate from '@/core/ui/ScreenGate'
import { toIsoDate } from '@/core/util/date-format'
import { canOpenSapExport, sapExportAccessQuery } from './access'

/**
 * The SAP export console's entry — `/reports/sap-export` (BackOffice spec 2579, ticket 461).
 *
 * A **placeholder until 463** draws the fleet here. Meanwhile it is the way into a store-day:
 * a store code and a business day open `/reports/sap-export/store/:code/day/:day`. It asks the
 * server nothing beyond the access probe; the store-day page reads (and refuses) the rest.
 */
export default function SapExportPage() {
  const { t } = useTranslation('sap-export-console')
  return (
    <ScreenGate query={sapExportAccessQuery()} can={canOpenSapExport} ns="sap-export-console" title={t('title')} subtitle={t('subtitle')}>
      <OpenDay />
    </ScreenGate>
  )
}

/** Yesterday, local — the most recent day a morning reader asks about. */
function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toIsoDate(d)
}

function OpenDay() {
  const { t } = useTranslation('sap-export-console')
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [day, setDay] = useState(yesterday)
  const store = code.trim()

  const open = (e: FormEvent) => {
    e.preventDefault()
    if (!store || !day) return
    navigate(`/reports/sap-export/store/${encodeURIComponent(store)}/day/${encodeURIComponent(day)}`)
  }

  return (
    <section className="flex max-w-xl flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-sap-export-home="">
      <div>
        <div className="text-base font-semibold tracking-tight">{t('fleet.soonTitle')}</div>
        <p className="mt-1 text-sm text-muted-foreground">{t('fleet.soonHint')}</p>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={open} data-open-day-form="">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('fleet.store')}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-7 w-32 rounded-md border border-border/60 bg-background px-2 font-mono text-sm text-foreground outline-none focus:border-primary/60"
            dir="ltr"
            data-open-day-store=""
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('fleet.day')}
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-7 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60"
            data-open-day-day=""
          />
        </label>
        <Button type="submit" variant="primary" disabled={!store || !day} data-open-day-submit="">
          <CalendarSearch className="h-3.5 w-3.5" aria-hidden />
          {t('fleet.open')}
        </Button>
      </form>
    </section>
  )
}
