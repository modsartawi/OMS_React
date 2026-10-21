import { useTranslation } from 'react-i18next'
import { apiErrorCode, apiErrorDetails, apiErrorMessage, isBareDenial } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { promotionRefusalView, refusalKey } from './promotion-write'

/**
 * A promotion write HQ refused, inside the dialog that made the call (ticket 536): our words for the
 * code, HQ's own message under them, one line per detail (a campaign an upload owns, say), the code,
 * and that nothing changed — every promotion door is all or none. A bare 403 reads "You do not have
 * access to this action".
 */
export default function WriteRefusal({ title, error }: { title: string; error: unknown }) {
  const { t } = useTranslation('campaign-promotions')
  const code = apiErrorCode(error)
  const bareDenial = isBareDenial(error)
  const view = promotionRefusalView({ code, bareDenial, details: apiErrorDetails(error) })
  const fallback = t('refusal.fallback')
  const said = view.reason ? t(refusalKey(view.reason)) : apiErrorMessage(error, fallback)
  return (
    <div data-write-refusal={view.reason ?? ''} data-denied={bareDenial ? '' : undefined}>
      <ErrorBanner className="p-2.5" title={title} message={said}>
        {view.reason && view.reason !== 'denied' && (
          <p className="mt-1 text-xs" data-write-refusal-message="">
            <bdi>{apiErrorMessage(error, fallback)}</bdi>
          </p>
        )}
        {view.details.length > 0 && (
          <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-4 text-xs" data-write-refusal-details={view.details.length}>
            {view.details.map((line, i) => (
              <li key={i}>
                <bdi>{line}</bdi>
              </li>
            ))}
          </ul>
        )}
        {code && (
          <p className="mt-1 text-xs" data-write-refusal-code={code}>
            {t('refusal.code')}{' '}
            <span className="font-mono">
              <Ltr>{code}</Ltr>
            </span>
          </p>
        )}
        <p className="mt-1 text-xs" data-write-refusal-unchanged="">
          {t('refusal.unchanged')}
        </p>
      </ErrorBanner>
    </div>
  )
}
