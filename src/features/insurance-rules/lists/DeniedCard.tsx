import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'

/** A bare 403 on a Lists read — "You do not have access", never an empty list (no probe until 618). */
export default function DeniedCard({ hook }: { hook: string }) {
  const { t } = useTranslation('insurance-lists')
  return (
    <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" {...{ [`data-${hook}`]: '' }}>
      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
    </div>
  )
}
