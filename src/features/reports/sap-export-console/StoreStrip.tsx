import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import Ltr from '@/core/ui/Ltr'
import { formatRange } from '@/core/util/bidi'
import { LABEL_TOKEN_CLASS, accountingToken, labelToken } from './label-helpers'
import type { StripCell } from './store-helpers'
import { figure, storeDayHref } from './storeday-helpers'
import TokenBadgeView from './TokenBadgeView'

/**
 * The store's 30-day strip (BackOffice spec 2579, ticket 464): one cell per day, oldest first,
 * coloured by the day's worst label through the console's label tokens. A day the rollup never
 * computed is drawn dashed and muted. A day whose export accounting breaks carries a marker.
 * Hovering (or focusing) a cell shows its label counts and its verdict; clicking opens the day.
 */
export default function StoreStrip({ code, cells }: { code: string; cells: StripCell[] }) {
  const { t } = useTranslation('sap-export-console')
  if (cells.length === 0) return <p className="text-sm text-muted-foreground">{t('store.strip.empty')}</p>
  const half = cells.length / 2
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-wrap gap-1" aria-label={t('store.strip.label')} data-strip="">
        {cells.map((cell, i) => (
          <li key={cell.day} className="group relative">
            <Link
              to={storeDayHref(code, cell.day)}
              aria-describedby={`strip-tip-${cell.day}`}
              className={
                'flex h-10 w-8 items-center justify-center rounded-md text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
                (cell.noData ? 'border border-dashed border-border bg-transparent text-muted-foreground' : LABEL_TOKEN_CLASS[cell.token])
              }
              data-strip-day={cell.day}
              data-token={cell.token}
              data-no-data={cell.noData ? '' : undefined}
              data-breaks={cell.breaks ? '' : undefined}
            >
              <Ltr>{cell.day.slice(8, 10)}</Ltr>
              {cell.breaks && (
                <span className="absolute -top-1 -end-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-card" aria-hidden data-breaks-marker="" />
              )}
            </Link>
            <DayCard cell={cell} id={`strip-tip-${cell.day}`} alignEnd={i >= half} />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span data-strip-range="">
          <Ltr>{formatRange(cells[0].day, cells[cells.length - 1].day)}</Ltr>
        </span>
        <span>{t('store.strip.hint')}</span>
      </div>
    </div>
  )
}

/** The hover card: the day, its verdict, its total and its non-zero label counts, worst first. */
function DayCard({ cell, id, alignEnd }: { cell: StripCell; id: string; alignEnd: boolean }) {
  const { t } = useTranslation('sap-export-console')
  return (
    <div
      id={id}
      role="tooltip"
      className={
        'pointer-events-none absolute top-full z-20 mt-1 hidden w-60 flex-col gap-2 rounded-md border border-border bg-card p-3 text-xs text-card-foreground shadow-pop group-hover:flex group-focus-within:flex ' +
        (alignEnd ? 'end-0' : 'start-0')
      }
      data-day-card={cell.day}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          <Ltr>{cell.day}</Ltr>
        </span>
        {cell.noData ? null : cell.accounting ? (
          <span data-day-card-accounting={cell.accounting}>
            <TokenBadgeView badge={accountingToken(cell.accounting)} value={cell.accounting} />
          </span>
        ) : (
          <span className="text-muted-foreground">{t('store.strip.noVerdict')}</span>
        )}
      </div>
      {cell.noData ? (
        <p className="text-muted-foreground" data-day-card-no-data="">
          {t('store.strip.noData')}
        </p>
      ) : (
        <>
          <div className="text-muted-foreground" data-day-card-total={cell.total}>
            <Trans t={t} i18nKey="store.strip.total" count={cell.total} values={{ n: figure(cell.total) }} components={{ n: <Ltr /> }} />
          </div>
          {cell.counts.length + cell.unknown.length > 0 && (
            <ul className="flex flex-col gap-1" data-day-card-counts="">
              {[...cell.counts, ...cell.unknown].map(({ label, count }) => (
                <li key={label} className="flex items-center justify-between gap-2" data-day-card-count={label}>
                  <TokenBadgeView badge={labelToken(label)} value={label} />
                  <span className="font-mono tabular-nums">
                    <Ltr>{figure(count)}</Ltr>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cell.breaks && <p className="font-medium text-danger-800">{t('store.strip.breaks')}</p>}
        </>
      )}
    </div>
  )
}
