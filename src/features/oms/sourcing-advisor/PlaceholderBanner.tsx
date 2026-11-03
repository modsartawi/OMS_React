import { Trans, useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'

/**
 * "Placeholder rates" (spec 734 D17, S2): every advisor screen says so while `placeholderRates` is
 * true, until finance supplies the real rates. Shared by the explanation (738) and the summary (739).
 */
export default function PlaceholderBanner({ rateVersion }: { rateVersion: string }) {
  const { t } = useTranslation('sourcing-advisor')
  return (
    <div
      role="note"
      data-sourcing-placeholder=""
      className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <div className="font-semibold">{t('placeholder.title')}</div>
        <p>{t('placeholder.body')}</p>
        {rateVersion !== '' && (
          <p className="text-xs">
            <Trans t={t} i18nKey="placeholder.rateVersion" values={{ version: rateVersion }} components={{ v: <Ltr /> }} />
          </p>
        )}
      </div>
    </div>
  )
}
