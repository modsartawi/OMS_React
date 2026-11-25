import { useEffect, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import {
  LINK_HEALTH_PERIODS,
  LINK_HEALTH_VIEWS,
  type FleetLinkHealth,
  type LinkHealthStore,
} from '@/core/models/sync-console'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { fleetLinkHealthQuery } from './api'
import ConsoleNav from './ConsoleNav'
import { figure } from './helpers'
import Loading from './Loading'
import {
  DEFAULT_LINK_HEALTH_FILTER,
  LINK_HEALTH_LEGEND,
  attentionReasons,
  chronicBadge,
  hourRows,
  linkHealthCell,
  linkHealthFigures,
  setLinkHealth,
  tillsReach,
  toggleView,
  type HourSlot,
  type LinkHealthFilter,
} from './link-health-helpers'

/** The page's two links, read apart: the telecom line to HQ and the store's own network. */
const PAGE_LINKS = ['WAN', 'STORE'] as const

/** The search box waits this long after the last keystroke before it asks the door (the Fleet page's). */
const SEARCH_DEBOUNCE_MS = 300

/** Every third hour carries its clock label over the grid. */
const LABEL_EVERY = 3

/**
 * The fleet "Link health" page (spec 4288, BackOffice 4295): which stores' links were unstable, when in the day, and on
 * which link — without opening each store. One read of `ActionSync/Fleet/LinkHealth`, polled on the console's cadence.
 *
 * - The WAN / Store toggle reads the telecom line and the store network apart; today / 7 days switches the period
 *   (7 days draws a day-by-hour strip per store, so a time-of-day pattern lines up).
 * - Each cell is a store-hour, coloured by the till drill-in's own rule; a number in it is how many tills were hit.
 * - The summary tiles (all, needs attention, …) and the search are the door's parameters: it filters and pages.
 * - A store's code opens its Tills tab, and from there a till's 7-day history (4290 / 4292).
 *
 * Read only: it notifies nobody.
 */
export default function LinkHealthPage() {
  const { t } = useTranslation('sync-console')
  const [filter, setFilter] = useState<LinkHealthFilter>(DEFAULT_LINK_HEALTH_FILTER)
  const [search, setSearch] = useState('')

  // The typed search reaches the filter once typing pauses, and starts again at page 1 (as the Fleet page's).
  useEffect(() => {
    const id = setTimeout(() => {
      const q = search.trim()
      setFilter((f) => (f.q === q ? f : setLinkHealth(f, { q })))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])

  const query = useQuery({ ...fleetLinkHealthQuery(filter), placeholderData: keepPreviousData })
  const d = query.isError ? undefined : query.data

  return (
    <div className="flex min-w-0 flex-col gap-4" data-link-health="">
      <ConsoleNav />
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold">{t('links.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('links.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-as-of="">
          {query.isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {d && <Trans t={t} i18nKey="links.readAt" values={{ at: formatDateTime(d.asOf) }} components={{ at: <Ltr /> }} />}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2" role="group" aria-label={t('links.linkLabel')} data-link-toggle={filter.link}>
          {PAGE_LINKS.map((link) => (
            <Button
              key={link}
              variant={link === filter.link ? 'secondary' : 'outlined'}
              aria-pressed={link === filter.link}
              onClick={() => setFilter((f) => setLinkHealth(f, { link }))}
              data-link-choice={link}
            >
              <bdi>{t(`links.links.${link}`)}</bdi>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={t('links.periodLabel')} data-period={filter.period}>
          {LINK_HEALTH_PERIODS.map((period) => (
            <Button
              key={period}
              variant={period === filter.period ? 'secondary' : 'outlined'}
              aria-pressed={period === filter.period}
              onClick={() => setFilter((f) => setLinkHealth(f, { period }))}
              data-period-choice={period}
            >
              <bdi>{t(`links.periods.${period}`)}</bdi>
            </Button>
          ))}
        </div>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('links.search')}
          aria-label={t('links.searchLabel')}
          wrapperClassName="w-64"
          data-link-search=""
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('links.viewsLabel')} data-link-views={filter.show}>
        {LINK_HEALTH_VIEWS.map((view) => (
          <Button
            key={view}
            variant={view === filter.show ? 'secondary' : 'outlined'}
            aria-pressed={view === filter.show}
            onClick={() => setFilter((f) => toggleView(f, view))}
            data-link-view={view}
          >
            <bdi>{t(`links.views.${view}`)}</bdi>
            <span className="ms-1 font-mono tabular-nums" data-link-view-count={view}>
              {d ? figure(d.counts[view]) : ''}
            </span>
          </Button>
        ))}
      </div>

      {query.isError && <ErrorBanner className="p-3" message={apiErrorMessage(query.error, t('links.failed'))} />}
      {query.isPending && <Loading label={t('links.loading')} />}
      {d && <Grid d={d} />}
      {d && <Pager d={d} onPage={(page) => setFilter((f) => setLinkHealth(f, { page }))} />}

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label={t('links.legend')} data-link-legend="">
        {LINK_HEALTH_LEGEND.map((entry) => (
          <li key={entry.cell} className="flex items-center gap-1" data-legend={entry.cell}>
            <span className={'inline-block h-2.5 w-2.5 rounded-[2px] ' + entry.swatch} aria-hidden />
            {t(entry.labelKey)}
          </li>
        ))}
        <li className="flex items-center gap-1" data-legend="future">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-border" aria-hidden />
          {t('links.future')}
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">{t('links.note')}</p>
    </div>
  )
}

/** The grid: an hour header, then one block per store — its label, then its day row(s) of 24 hour cells. */
function Grid({ d }: { d: FleetLinkHealth }) {
  const { t } = useTranslation('sync-console')
  if (d.items.length === 0) return <p className="text-sm text-muted-foreground">{t('links.empty')}</p>
  const week = d.period === '7d'
  return (
    <div
      className="grid items-center gap-x-px gap-y-1"
      style={{ gridTemplateColumns: `minmax(14rem, 18rem) ${week ? '5.5rem ' : ''}repeat(24, minmax(0, 1fr))` }}
      data-link-grid={d.period}
    >
      <span className="text-xs font-semibold text-muted-foreground">{t('links.store')}</span>
      {week && <span aria-hidden />}
      {Array.from({ length: 24 }, (_, h) => (
        <span key={`h-${h}`} className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">
          {h % LABEL_EVERY === 0 && <Ltr>{String(h).padStart(2, '0')}:00</Ltr>}
        </span>
      ))}
      {d.items.map((store) => (
        <StoreRows key={store.code} store={store} hours={d.hours} week={week} />
      ))}
    </div>
  )
}

/** One store: its label beside its first row, then its other day rows under it (7 days). */
function StoreRows({ store, hours, week }: { store: LinkHealthStore; hours: string[]; week: boolean }) {
  const rows = hourRows(hours, store.cells)
  return (
    <>
      {rows.map((row, i) => (
        <DayRow key={row.day} code={store.code} day={row.day} slots={row.slots} week={week} first={i === 0} span={rows.length}>
          {i === 0 && <StoreLabel store={store} />}
        </DayRow>
      ))}
    </>
  )
}

function DayRow({
  code,
  day,
  slots,
  week,
  first,
  span,
  children,
}: {
  code: string
  day: string
  slots: HourSlot[]
  week: boolean
  first: boolean
  span: number
  children: ReactNode
}) {
  return (
    <>
      {first && (
        <div className="self-start pe-3 pt-0.5" style={{ gridRow: `span ${span}` }}>
          {children}
        </div>
      )}
      {week && <span className="pe-2 font-mono text-[10px] whitespace-nowrap text-muted-foreground"><Ltr>{formatDay(day)}</Ltr></span>}
      {slots.map((slot) => (
        <HourCell key={slot.hour} code={code} slot={slot} week={week} />
      ))}
    </>
  )
}

/** The store's name (a link into its Tills tab), its badges and its totals over the period. */
function StoreLabel({ store }: { store: LinkHealthStore }) {
  const { t } = useTranslation('sync-console')
  const chronic = chronicBadge(store.cells)
  const reasons = attentionReasons(store).filter((r) => r.key !== 'links.reasons.chronic')
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-link-store={store.code} data-link-attention={store.needsAttention}>
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to={`/admin/sync/store/${encodeURIComponent(store.code)}?tab=tills`}
          className="font-mono text-sm font-semibold text-primary hover:underline"
          aria-label={t('links.openStore', { code: fsi(store.code) })}
          data-link-store-open={store.code}
        >
          <Ltr>{store.code}</Ltr>
        </Link>
        <span className="truncate text-xs text-muted-foreground" title={store.description}>
          <bdi>{store.description}</bdi>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {chronic && (
          <span data-link-chronic={store.code}>
            <StatusBadge sev="bad">
              {t('links.chronic', { troubled: fsi(figure(chronic.troubled)), of: fsi(figure(chronic.of)) })}
            </StatusBadge>
          </span>
        )}
        {reasons.map((r) => (
          <span key={r.key} data-link-reason={r.key}>
            <StatusBadge sev="warn">{t(r.key, { n: fsi(figure(r.n)) })}</StatusBadge>
          </span>
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground" data-link-totals={store.code}>
        {store.noData
          ? t('links.noData')
          : store.troubledHours === 0
            ? t('links.healthy', { reporting: fsi(figure(store.tillsReporting)) })
            : t('links.totals', {
                troubled: fsi(figure(store.troubledHours)),
                affected: fsi(figure(store.tillsAffected)),
                reporting: fsi(figure(store.tillsReporting)),
              })}
      </span>
    </div>
  )
}

/** One store-hour: its colour, the number of tills hit (today only: the 7-day cells are too small), the figures on hover. */
function HourCell({ code, slot, week }: { code: string; slot: HourSlot; week: boolean }) {
  const { t } = useTranslation('sync-console')
  const height = week ? 'h-3' : 'h-8'
  if (slot.future)
    return <div className={`${height} rounded-[1px] border border-border/60`} data-link-hour={slot.hour} data-link-cell="future" title={t('links.future')} />
  const entry = linkHealthCell(slot.cell)
  const f = linkHealthFigures(slot.cell)
  const reach = tillsReach(slot.cell)
  const reading = fsi(formatPair(formatDateTime(slot.hour), t(entry.labelKey)))
  const title = f
    ? t('links.cellTitle', {
        reading,
        fail: fsi(figure(f.failPct)),
        slow: fsi(figure(f.slowPct)),
        p95: fsi(figure(f.p95Ms)),
        unstable: fsi(figure(f.unstableMinutes)),
        offline: fsi(figure(f.offlineMinutes)),
        affected: fsi(figure(f.tillsAffected)),
        reporting: fsi(figure(f.tillsReporting)),
      })
    : reading
  return (
    <div
      className={`${height} flex items-center justify-center rounded-[1px] font-mono text-[10px] font-semibold tabular-nums text-foreground ${entry.swatch}`}
      role="img"
      aria-label={reach ? `${title} (${t(reach.labelKey, { affected: reach.affected, reporting: reach.reporting })})` : title}
      title={title}
      data-link-hour={slot.hour}
      data-link-cell={entry.cell}
      data-link-cell-store={code}
      data-link-affected={reach?.affected ?? 0}
    >
      {!week && reach ? <Ltr>{reach.labelKey === 'links.reach.whole' ? `${reach.affected}/${reach.reporting}` : reach.affected}</Ltr> : null}
    </div>
  )
}

/** The door's paging: previous / next and where we are. */
function Pager({ d, onPage }: { d: FleetLinkHealth; onPage: (page: number) => void }) {
  const { t } = useTranslation('sync-console')
  const pages = Math.max(1, Math.ceil(d.total / d.pageSize))
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" data-link-pager={`${d.page}/${pages}`}>
      <Button variant="outlined" disabled={d.page <= 1} onClick={() => onPage(d.page - 1)} data-link-page="prev">
        {t('links.prev')}
      </Button>
      <span>
        {t('links.pageOf', { page: fsi(figure(d.page)), pages: fsi(figure(pages)), total: fsi(figure(d.total)) })}
      </span>
      <Button variant="outlined" disabled={d.page >= pages} onClick={() => onPage(d.page + 1)} data-link-page="next">
        {t('links.next')}
      </Button>
    </div>
  )
}
