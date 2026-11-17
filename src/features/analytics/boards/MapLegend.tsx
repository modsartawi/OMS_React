import { useTranslation } from 'react-i18next'
import { PLAIN_INK, POINT_RADIUS } from '@/core/map/map-drawing'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { MapLegendView } from './map-chart'

/**
 * A map's legend (oms-react 881, BackOffice spec 3630 M17, M18): the size measure with the smallest and the largest
 * point and the figures they stand for, then the colour measure with each step's colour and its words — all from the
 * server's legend, in the screen's language. With one measure there is no colour part: every point is one colour.
 *
 * Plain markup, no map code: it is drawn beside the lazy map panel and prints with it.
 */
export default function MapLegend({ view }: { view: MapLegendView }) {
  const { t } = useTranslation('boards')
  return (
    <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2 text-xs text-muted-foreground" role="group" aria-label={t('view.mapLegend.label')} data-map-legend>
      <div className="flex flex-col gap-1" data-map-legend-size>
        <span className="font-medium text-foreground">{t('view.mapLegend.size', { measure: fsi(view.size.label) })}</span>
        {/* Review W11: with every store hollow the legend has no smallest or largest figure: no scale of blanks. */}
        {(view.size.min !== '' || view.size.max !== '') && (
          <span className="flex items-center gap-2" data-map-legend-scale>
            <Dot radius={POINT_RADIUS.min} ink={PLAIN_INK} />
            <Ltr>{view.size.min}</Ltr>
            <Dot radius={POINT_RADIUS.max} ink={PLAIN_INK} />
            <Ltr>{view.size.max}</Ltr>
          </span>
        )}
        {view.size.hollow && (
          <span className="flex items-center gap-2" data-map-legend-hollow>
            <Dot radius={POINT_RADIUS.min} ink={PLAIN_INK} hollow />
            {t('view.mapLegend.hollow')}
          </span>
        )}
      </div>
      {view.colour && (
        <div className="flex flex-col gap-1" data-map-legend-colour>
          <span className="font-medium text-foreground">{t('view.mapLegend.colour', { measure: fsi(view.colour.label) })}</span>
          <ul className="flex flex-col gap-0.5">
            {view.colour.steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2" data-map-step={s.id}>
                <Dot radius={6} ink={s.ink} />
                <bdi>{s.words}</bdi>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** One point as the map draws it: filled with a ring, or hollow in its own colour. Colours are tokens, never values. */
function Dot({ radius, ink, hollow = false }: { radius: number; ink: string; hollow?: boolean }) {
  const d = radius * 2
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: d,
        height: d,
        background: hollow ? 'transparent' : `var(${ink})`,
        border: hollow ? `2px solid var(${ink})` : '1px solid var(--map-ring)',
      }}
    />
  )
}
