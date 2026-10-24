import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * The named denial (ticket 545): every HQ door answers a session without
 * `BackOfficeScreen[PrescriptionSessionHq, 03]` with a BARE 403, and no probe route exists, so the
 * tab that met it says which grant is missing in place of its content. 546 and 547 reuse it.
 */
export default function Denied() {
  const { t } = useTranslation('prescription-sessions')
  return (
    <div className="flex max-w-2xl items-start gap-3 rounded-lg border border-border bg-card p-6" role="alert" data-ps-denied="">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t('denied.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('denied.body')}</p>
      </div>
    </div>
  )
}
