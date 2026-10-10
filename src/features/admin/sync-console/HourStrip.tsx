import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime, formatTimeOfDay } from '@/core/util/date-format'
import { storeHoursQuery } from './api'
import { HOUR_LEGEND, hourCellLegend } from './store-helpers'
import Loading from './Loading'

/** Every third hour carries its clock label under the strip, as the prototype draws it. */
const LABEL_EVERY = 3

/**
 * A store's last 24 hours (ticket 446), from `Store/Hours`: one cell per hour,
 * oldest first, coloured by the door's `cell` through `hourCellLegend`, with the
 * legend under it. A cell's colour is the door's reading of that hour — nothing here
 * decides whether an hour went well.
 */
export default function HourStrip({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  const hours = useQuery(storeHoursQuery(code))
  // A failed 30 s refresh keeps the last good strip under its error: the hours are
  // stamped, so they cannot pass for fresh, and the reader keeps what they were reading.
  const items = hours.data?.items

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-hour-strip="">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('strip.title')}</h2>
      {hours.isPending && <Loading label={t('strip.loading')} />}
      {hours.isError && <ErrorBanner className="p-3" message={apiErrorMessage(hours.error, t('strip.failed'))} />}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">{t('strip.empty')}</p>}
      {items && items.length > 0 && (
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((h) => {
            const entry = hourCellLegend(h.cell)
            // A string-only sink: the hour and its reading built as ONE pair, isolated once.
            const title = fsi(formatPair(formatDateTime(h.hour), t(entry.labelKey)))
            return (
              <div
                key={`cell-${h.hour}`}
                className={'h-8 rounded-sm ' + entry.swatch}
                role="img"
                aria-label={title}
                title={title}
                data-hour={h.hour}
                data-hour-cell={entry.cell}
              />
            )
          })}
          {items.map((h, i) => (
            <div key={`label-${h.hour}`} className="text-center font-mono text-[10.5px] text-muted-foreground">
              {i % LABEL_EVERY === 0 && <Ltr>{formatTimeOfDay(h.hour)}</Ltr>}
            </div>
          ))}
        </div>
      )}
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label={t('strip.legend')} data-strip-legend="">
        {HOUR_LEGEND.map((entry) => (
          <li key={entry.cell} className="flex items-center gap-1" data-legend={entry.cell}>
            <span className={'inline-block h-2.5 w-2.5 rounded-[2px] ' + entry.swatch} aria-hidden />
            {t(entry.labelKey)}
          </li>
        ))}
      </ul>
    </section>
  )
}
