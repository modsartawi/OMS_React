import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime, formatTimeOfDay } from '@/core/util/date-format'
import { storeHoursQuery } from './api'
import { figure } from './helpers'
import { HOUR_LEGEND, hourCellLegend } from './store-helpers'
import Loading from './Loading'

/** Every third hour carries its clock label under the strip, as the prototype draws it. */
const LABEL_EVERY = 3

/**
 * A store's last 24 hours (ticket 446), from `Store/Hours`: one cell per hour,
 * oldest first, coloured by the door's `cell` through `hourCellLegend`, with the
 * legend under it. A cell's colour is the door's reading of that hour — nothing here
 * decides whether an hour went well.
 *
 * Spec 2563 (ticket 457) adds the **Mirror** line under the store worker's, from each
 * hour's `mirror.cell`, on the same legend; hovering a mirror cell gives its counts. A
 * store the mirror rail does not sweep draws "not on mirror" in its place: its hours
 * would all be "no data", which would read as a mirror that stopped.
 *
 * A WPF store has no store worker line (`storeLine: false`): WPF writes no health, so
 * its hours would all be "no data". It is drawn at all only for its Mirror line.
 */
export default function HourStrip({ code, storeLine, onMirror }: { code: string; storeLine: boolean; onMirror: boolean }) {
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
          className="grid items-center gap-[3px]"
          style={{ gridTemplateColumns: `auto repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {storeLine && <LineLabel>{t('strip.lines.store')}</LineLabel>}
          {storeLine && items.map((h) => {
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
          <LineLabel>{t('strip.lines.mirror')}</LineLabel>
          {onMirror ? (
            items.map((h) => {
              const entry = hourCellLegend(h.mirror.cell)
              const m = h.mirror
              // The same pair, isolated once, then the hour's mirror counts — each a value
              // interpolated into a sentence, so each takes its own isolate. Each count
              // follows its own label, so no noun has to agree with a number.
              const title = t('strip.mirrorTitle', {
                reading: fsi(formatPair(formatDateTime(h.hour), t(entry.labelKey))),
                pulled: fsi(figure(m.rowsPulled)),
                applied: fsi(figure(m.applied)),
                deferred: fsi(figure(m.deferred)),
                errored: fsi(figure(m.errored)),
                deadLettered: fsi(figure(m.deadLettered)),
                sweeps: fsi(figure(m.sweeps)),
                connectFailures: fsi(figure(m.connectFailures)),
              })
              return (
                <div
                  key={`mirror-${h.hour}`}
                  className={'h-8 rounded-sm ' + entry.swatch}
                  role="img"
                  aria-label={title}
                  title={title}
                  data-mirror-hour={h.hour}
                  data-mirror-hour-cell={entry.cell}
                />
              )
            })
          ) : (
            <p
              className="flex h-8 items-center rounded-sm bg-muted/40 px-2 text-xs text-muted-foreground"
              style={{ gridColumn: `span ${items.length}` }}
              data-mirror-line="notOnMirror"
            >
              {t('mirror.notOnMirror')}
            </p>
          )}
          <span aria-hidden />
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

/** A line's name, at the start of its row of cells. */
function LineLabel({ children }: { children: ReactNode }) {
  return <span className="pe-2 text-xs whitespace-nowrap text-muted-foreground">{children}</span>
}
