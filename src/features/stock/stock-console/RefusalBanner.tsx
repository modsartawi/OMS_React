import { useTranslation } from 'react-i18next'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { refusalOf } from './refusals'

/**
 * A failed console read, in its own sentence (`./refusals`, pure and tested): busy, timed out, a name too wide, Stock
 * Visibility not reached… When the server's sentence adds something (an unknown code, SAP's reason) it is drawn under
 * ours, isolated as free text by the banner.
 */
export default function RefusalBanner({ error, className = 'p-3' }: { error: unknown; className?: string }) {
  const { t } = useTranslation('stock-console')
  const refusal = refusalOf(error)
  return (
    <div data-refusal={refusal.code ?? refusal.key}>
      {refusal.reason ? (
        <ErrorBanner className={className} title={t(refusal.key)} message={refusal.reason} />
      ) : (
        <ErrorBanner className={className} message={t(refusal.key)} />
      )}
    </div>
  )
}
