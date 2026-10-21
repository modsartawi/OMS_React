import { useTranslation } from 'react-i18next'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'

/**
 * The promotion list read refused: a bare 403 (no grant, and no probe to know it before) reads "You
 * do not have access to this action", never an empty list; any other failure HQ's message.
 */
export default function PromotionsRefusal({ error, at }: { error: unknown; at: 'data-promotions-failed' | 'data-promotion-failed' }) {
  const { t } = useTranslation('campaign-promotions')
  const denied = isBareDenial(error)
  return (
    <div {...{ [at]: '' }} data-denied={denied ? '' : undefined}>
      <ErrorBanner className="p-2.5" title={denied ? undefined : t('list.failedTitle')} message={denied ? t('denied') : apiErrorMessage(error, t('list.failed'))} />
    </div>
  )
}
