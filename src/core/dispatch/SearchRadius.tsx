import { Trans, useTranslation } from 'react-i18next'
import type { DispatchCallout } from '@/core/models/dispatch-board'
import Ltr from '@/core/ui/Ltr'
import { searchRadiusView } from './view'

/**
 * The radius behind a callout's result (spec 3326, oms 715): "Searched 7.5 km", or "No radius search" at 0, and
 * nothing for a callout read before 3326. One component for the board's row and inspector and Delivery details'
 * Callout panel, so it lives in `@/core/` and speaks in the `dispatch-board` namespace (the `ReleaseLockDialog`
 * precedent). `data-search-radius` carries the km (`'0'` for none) for the drives.
 */
export default function SearchRadius({
  callout,
  className,
}: {
  callout: Partial<Pick<DispatchCallout, 'searchRadiusKm'>>
  className?: string
}) {
  const { t } = useTranslation('dispatch-board')
  const radius = searchRadiusView(callout)
  if (!radius) return null
  return (
    <span className={className} data-search-radius={radius.kind === 'searched' ? radius.km : '0'}>
      {radius.kind === 'searched' ? (
        <Trans t={t} i18nKey="inspector.searchRadius" values={{ km: radius.km }} components={{ n: <Ltr /> }} />
      ) : (
        t('inspector.noRadiusSearch')
      )}
    </span>
  )
}
