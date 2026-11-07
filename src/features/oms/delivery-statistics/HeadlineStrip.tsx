import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import KpiTile from '@/core/charts/KpiTile'
import type { AnalyticsNumberFormat, MeasureUnit } from '@/core/models/analytics'
import type { StatisticsPrevious } from '@/core/models/delivery-statistics'
import Ltr from '@/core/ui/Ltr'
import { comparedWindow, type HeadlineKind, type HeadlineTile } from './headline'
import { TileFrame } from './Tile'

/** How each kind of figure is written by the KPI tile: counts whole, shares as %, a ratio to two places. */
const WRITTEN_AS: Record<HeadlineKind, { unit: MeasureUnit; format: AnalyticsNumberFormat }> = {
  count: { unit: 'count', format: 'integer' },
  share: { unit: 'share', format: 'percent' },
  ratio: { unit: 'count', format: 'decimal' },
  minutes: { unit: 'minutes', format: 'auto' },
}

/**
 * The headline strip (ticket 812, spec 811): six `core/charts` KPI tiles, each with its caption, the
 * server's figure, its server change against the compared window (in ink, an arrow and words), and a
 * line under it where the figure has one. A share's change (In slot, Out of slot) reads in percentage
 * points (`headline.points`), never as a percent of a percent. Each tile wears `Tile`'s frame. The compared window is named once, beside the heading.
 * `children` (the Unspecified tile) follow the six in the same grid.
 */
export default function HeadlineStrip({
  tiles,
  previous,
  children,
}: {
  tiles: HeadlineTile[]
  previous: StatisticsPrevious | undefined
  children?: ReactNode
}) {
  const { t, i18n } = useTranslation('delivery-statistics')
  const compared = comparedWindow(previous)
  return (
    <section className="flex flex-col gap-2" data-statistics-band="storeWide" aria-labelledby="statistics-headline">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="statistics-headline" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('band.storeWide')}
        </h2>
        {compared && (
          <span className="text-xs text-muted-foreground" data-statistics-compared={compared.kind}>
            {compared.kind === 'until' ? (
              <Trans t={t} i18nKey="headline.compared.until" values={{ day: compared.day, time: compared.time }} components={{ v: <Ltr /> }} />
            ) : (
              <Trans t={t} i18nKey="headline.compared.range" values={{ range: compared.range }} components={{ v: <Ltr /> }} />
            )}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-statistics-headline="">
        {tiles.map((tile) => {
          const caption = t(`headline.caption.${tile.id}`)
          return (
            <TileFrame key={tile.id} id={tile.id} caption={caption} accent="border-t-primary">
              <KpiTile
                measureLabel={caption}
                value={tile.value}
                previous={tile.previous}
                delta={tile.delta}
                spark={[]}
                unit={WRITTEN_AS[tile.kind].unit}
                format={WRITTEN_AS[tile.kind].format}
                locale={i18n.language}
                {...(tile.points !== undefined ? { changeText: tile.points, changeUnit: t('headline.points') } : {})}
              />
              {tile.sub && (
                <span className="text-xs text-muted-foreground" data-figure={`${tile.id}.sub`}>
                  {tile.sub.kind === 'split' ? (
                    <Trans t={t} i18nKey="headline.split" values={{ delivered: tile.sub.delivered, pickedUp: tile.sub.pickedUp }} components={{ v: <Ltr /> }} />
                  ) : (
                    <Trans t={t} i18nKey="headline.ofDelivered" values={{ n: tile.sub.n, total: tile.sub.total }} components={{ v: <Ltr /> }} />
                  )}
                </span>
              )}
            </TileFrame>
          )
        })}
        {children}
      </div>
    </section>
  )
}
