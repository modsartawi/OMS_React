import type { TFunction } from 'i18next'
import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { distanceMeasureCode, searchRadiusLabelKey, searchRadiusView, type RadiusMeasureView, type SearchRadiusInput } from './view'

/**
 * The radius behind a callout's result (spec 3326, oms 715): "Searched 7.5 km", or "No radius search" at 0, and
 * nothing for a callout read before 3326. One component for the board's row and inspector and Delivery details'
 * Callout panel, so it lives in `@/core/` and speaks in the `dispatch-board` namespace (the `ReleaseLockDialog`
 * precedent). `data-search-radius` carries the km (`'0'` for none) for the drives.
 *
 * Spec 3460 (oms 858) adds how it was measured — "by road", "straight-line (fallback: timeout)" or "shadow" — and
 * "widened" when the row says so, each combination one locale sentence (`searchRadiusLabelKey`);
 * `data-distance-measure` carries the wire code. No measure reads as before.
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
  const reason = reasonOf(radius.measure)
  return (
    <span
      className={className}
      data-search-radius={radius.km}
      data-distance-measure={radius.measure ? distanceMeasureCode(callout.distanceMeasure) : undefined}
      data-search-widened={radius.widened ? '' : undefined}
    >
      <Trans
        t={t}
        i18nKey={searchRadiusLabelKey(radius)}
        values={{ km: radius.km, reason: reason ? reasonText(t, reason) : undefined }}
        // A known reason is words (`<bdi>`); an unknown one is a machine code (`Ltr`).
        components={{ n: <Ltr />, r: reason && 'key' in reason ? <bdi /> : <Ltr /> }}
      />
    </span>
  )
}

type Reason = Extract<RadiusMeasureView, { kind: 'fallback' }>['reason']

const reasonOf = (measure?: RadiusMeasureView): Reason => (measure?.kind === 'fallback' ? measure.reason : null)

const reasonText = (t: TFunction, reason: NonNullable<Reason>): string =>
  'key' in reason ? t(`fallbackReason.${reason.key}`) : reason.raw

/**
 * The same label as one plain string, for a grid's value (copy and filter read words, and any change to km, measure,
 * reason or widened changes it, so the cell refreshes) and its tooltip. `isolate` wraps each interpolated value: the
 * identity for a grid value (never `fsi` there, bidi rule), `fsi` for the tooltip. `t` is the `dispatch-board` one.
 */
export function searchRadiusText(t: TFunction, callout: SearchRadiusInput | undefined, isolate: (v: string) => string = (v) => v): string {
  const radius = callout ? searchRadiusView(callout) : null
  if (!radius) return ''
  if (radius.kind === 'none') return t('inspector.noRadiusSearch')
  const reason = reasonOf(radius.measure)
  return t(searchRadiusLabelKey(radius), {
    km: isolate(radius.km),
    reason: reason ? isolate(reasonText(t, reason)) : undefined,
    interpolation: { escapeValue: false },
  }).replace(/<\/?[nr]>/g, '')
}
