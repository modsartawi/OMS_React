import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { searchRadiusView, type RadiusMeasureView, type SearchRadiusInput } from './view'

/**
 * The radius behind a callout's result (spec 3326, oms 715): "Searched 7.5 km", or "No radius search" at 0, and
 * nothing for a callout read before 3326. One component for the board's row and inspector and Delivery details'
 * Callout panel, so it lives in `@/core/` and speaks in the `dispatch-board` namespace (the `ReleaseLockDialog`
 * precedent). `data-search-radius` carries the km (`'0'` for none) for the drives.
 *
 * Spec 3460 (oms 858) adds how it was measured — "by road", "straight-line (fallback: timeout)" or "shadow" — and
 * "widened" when the row says so; `data-distance-measure` carries the wire code. No measure reads as before.
 */
export default function SearchRadius({ callout, className }: { callout: SearchRadiusInput; className?: string }) {
  const { t } = useTranslation('dispatch-board')
  const radius = searchRadiusView(callout)
  if (!radius) return null
  if (radius.kind === 'none') {
    return (
      <span className={className} data-search-radius="0">
        {t('inspector.noRadiusSearch')}
      </span>
    )
  }
  return (
    <span
      className={className}
      data-search-radius={radius.km}
      data-distance-measure={radius.measure ? callout.distanceMeasure : undefined}
      data-search-widened={radius.widened ? '' : undefined}
    >
      <Measured km={radius.km} measure={radius.measure} />
      {radius.widened && <span className="ms-1">{t('inspector.radiusWidened')}</span>}
    </span>
  )
}

function Measured({ km, measure }: { km: string; measure?: RadiusMeasureView }) {
  const { t } = useTranslation('dispatch-board')
  const n = { n: <Ltr /> }
  if (!measure) return <Trans t={t} i18nKey="inspector.searchRadius" values={{ km }} components={n} />
  if (measure.kind === 'road') return <Trans t={t} i18nKey="inspector.radiusByRoad" values={{ km }} components={n} />
  if (measure.kind === 'shadow') return <Trans t={t} i18nKey="inspector.radiusShadow" values={{ km }} components={n} />
  if (!measure.reason) return <Trans t={t} i18nKey="inspector.radiusFallback" values={{ km }} components={n} />
  const reason = measure.reason
  const known = 'key' in reason
  return (
    <Trans
      t={t}
      i18nKey="inspector.radiusFallbackReason"
      values={{ km, reason: 'key' in reason ? t(`fallbackReason.${reason.key}`) : reason.raw }}
      components={{ n: <Ltr />, r: known ? <bdi /> : <Ltr /> }}
    />
  )
}
