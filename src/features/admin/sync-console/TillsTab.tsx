import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import type { LinkVerdict, Till, TillHour } from '@/core/models/sync-console'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime, formatTimeOfDay } from '@/core/util/date-format'
import { storeTillHoursQuery, storeTillsQuery } from './api'
import { MONO } from './console-columns'
import { figure } from './helpers'
import Loading from './Loading'
import TabGrid from './TabGrid'
import {
  LINK_DOT,
  TILL_HOUR_LEGEND,
  tillHistorySummary,
  tillHourCell,
  tillHourFigures,
  tillFigureTexts,
  tillLinkCell,
  tillSilent,
} from './tills-helpers'

const tillId = (t: Till) => t.device

/**
 * The Tills tab (spec 4288, BackOffice 4290/4291): each till of the store, when it was last seen, and its WAN
 * and store links' verdicts as the till itself judged them — so L1 can answer "is it the network?" without asking the
 * store to run ping. The store link (BackOffice 4291) is a secondary till's path to the main till; the main till's own
 * store link reads "Local" with a note saying why. A till on a build before 4291 reads "No data" in the store column.
 *
 * A till on an older build reports nothing and reads "No data", never "Online"; a till that stopped reporting shows
 * "Not reporting" with its last verdict greyed beneath (`tillLinkCell`). Times are judged against the door's `asOf`.
 */
export default function TillsTab({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  const tills = useQuery(storeTillsQuery(code))
  const asOf = tills.data?.asOf ?? ''
  // BackOffice 4292: the till whose 7-day history is open under the list, if any.
  const [open, setOpen] = useState<string | null>(null)
  const columns = useMemo(() => buildTillColumns(t, asOf, setOpen), [t, asOf])
  return (
    <div className="flex flex-col gap-2">
      <TabGrid
        rows={tills.data?.items}
        columns={columns}
        rowId={tillId}
        pending={tills.isPending}
        error={tills.error}
        failed={t('tills.failed')}
        empty={t('tills.empty')}
        loading={t('tills.loading')}
        data="tills"
      />
      <p className="text-xs text-muted-foreground">{t('tills.note')}</p>
      {open && <TillHistory key={open} code={code} device={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function buildTillColumns(t: TFunction, asOf: string, openHistory: (device: string) => void): ColDef<Till>[] {
  const link = (pick: (till: Till) => LinkVerdict | null, id: string) => (p: ICellRendererParams<Till>) =>
    p.data ? <LinkCell link={pick(p.data)} till={p.data} asOf={asOf} id={id} /> : null
  return [
    { headerName: t('tills.columns.device'), field: 'device', width: 120, cellClass: MONO },
    {
      headerName: t('tills.columns.lastSeen'),
      colId: 'lastSeen',
      width: 160,
      cellRenderer: (p: ICellRendererParams<Till>) =>
        p.data ? (
          <span className={tillSilent(p.data, asOf) ? 'text-muted-foreground' : ''} data-till-silent={tillSilent(p.data, asOf)}>
            {p.data.lastSeenAt ? <Ltr>{formatDateTime(p.data.lastSeenAt)}</Ltr> : t('tills.never')}
          </span>
        ) : null,
    },
    { headerName: t('tills.columns.wan'), colId: 'wan', flex: 1, minWidth: 320, cellRenderer: link((x) => x.wan, 'wan') },
    { headerName: t('tills.columns.store'), colId: 'store', flex: 1, minWidth: 260, cellRenderer: link((x) => x.store, 'store') },
    {
      // BackOffice 4292: the way into the till's 7-day hourly history, opened under the list.
      headerName: '',
      colId: 'history',
      width: 110,
      cellRenderer: (p: ICellRendererParams<Till>) => {
        const device = p.data?.device
        if (!device) return null
        return (
          <Button
            variant="secondary"
            onClick={() => openHistory(device)}
            aria-label={t('tills.history.openLabel', { device: fsi(device) })}
            data-till-history-open={device}
          >
            {t('tills.history.open')}
          </Button>
        )
      },
    },
  ]
}

/** Every sixth hour of the week carries its clock label under the strip (168 cells would crowd every third). */
const HISTORY_LABEL_EVERY = 6

/**
 * One till's last 7 days (BackOffice 4292), from `Store/Till/Hours`: the console's hour-strip idiom, one row of cells
 * per link, oldest first, coloured by `tillHourCell`; hovering a cell gives the hour's counts, p95 and minutes unstable /
 * offline - the numbers L1 hands the network team. An hour with no row is no data, never healthy.
 */
function TillHistory({ code, device, onClose }: { code: string; device: string; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  const hours = useQuery(storeTillHoursQuery(code, device))
  const items = hours.data?.items
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-till-history={device}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('tills.history.title', { device: fsi(device) })}
        </h3>
        <Button variant="secondary" onClick={onClose} data-till-history-close="">
          {t('tills.history.close')}
        </Button>
      </div>
      {hours.isPending && <Loading label={t('tills.history.loading')} />}
      {hours.isError && <ErrorBanner className="p-3" message={apiErrorMessage(hours.error, t('tills.history.failed'))} />}
      {items && items.length > 0 && (
        <div className="grid items-center gap-px" style={{ gridTemplateColumns: `auto repeat(${items.length}, minmax(0, 1fr))` }}>
          <HistoryLine items={items} link="wan" label={t('tills.columns.wan')} />
          <HistoryLine items={items} link="store" label={t('tills.columns.store')} />
          <span aria-hidden />
          {items.map((h, i) => (
            <div key={`label-${h.hour}`} className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">
              {i % HISTORY_LABEL_EVERY === 0 && <Ltr>{formatTimeOfDay(h.hour)}</Ltr>}
            </div>
          ))}
        </div>
      )}
      <ul
        className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
        aria-label={t('tills.history.legend')}
        data-till-history-legend=""
      >
        {TILL_HOUR_LEGEND.map((entry) => (
          <li key={entry.cell} className="flex items-center gap-1" data-legend={entry.cell}>
            <span className={'inline-block h-2.5 w-2.5 rounded-[2px] ' + entry.swatch} aria-hidden />
            {t(entry.labelKey)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('tills.history.note')}</p>
    </section>
  )
}

/** One link's row of hour cells, with its name and its "N of M hours" at the start. */
function HistoryLine({ items, link, label }: { items: TillHour[]; link: 'wan' | 'store'; label: string }) {
  const { t } = useTranslation('sync-console')
  const summary = tillHistorySummary(items, link)
  return (
    <>
      <LineLabel>
        <span className="block">{label}</span>
        <span className="block text-[11px]" data-till-history-summary={link}>
          {summary.reported === 0
            ? t('tills.history.noHours')
            : t('tills.history.summary', { troubled: fsi(figure(summary.troubled)), reported: fsi(figure(summary.reported)) })}
        </span>
      </LineLabel>
      {items.map((h) => {
        const entry = tillHourCell(h[link])
        const f = tillHourFigures(h[link])
        // The hour and its reading as ONE pair, isolated once; each count a value in a sentence, isolated on its own.
        const reading = fsi(formatPair(formatDateTime(h.hour), t(entry.labelKey)))
        const title = f
          ? t('tills.history.cellTitle', {
              reading,
              checks: fsi(figure(f.checks)),
              failed: fsi(figure(f.failed)),
              slow: fsi(figure(f.slow)),
              p95: fsi(figure(f.p95Ms)),
              unstable: fsi(figure(f.unstableMinutes)),
              offline: fsi(figure(f.offlineMinutes)),
            })
          : reading
        return (
          <div
            key={`${link}-${h.hour}`}
            className={'h-8 rounded-[1px] ' + entry.swatch}
            role="img"
            aria-label={title}
            title={title}
            data-till-hour={h.hour}
            data-till-hour-link={link}
            data-till-hour-cell={entry.cell}
          />
        )
      })}
    </>
  )
}

/** A line's name, at the start of its row of cells. */
function LineLabel({ children }: { children: ReactNode }) {
  return <span className="pe-2 text-xs whitespace-nowrap text-muted-foreground">{children}</span>
}

/** One link: a dot, the state's word, then the till's own figures and since — all on one grid line. */
function LinkCell({ link, till, asOf, id }: { link: LinkVerdict | null; till: Till; asOf: string; id: string }) {
  const { t } = useTranslation('sync-console')
  const cell = tillLinkCell(link, till, asOf)
  const word = cell.labelKey ? t(cell.labelKey) : <Ltr>{cell.state ?? ''}</Ltr>
  const quiet = cell.kind !== 'verdict'
  return (
    <span className="flex min-w-0 items-center gap-2" data-link={id} data-link-kind={cell.kind} data-link-state={cell.state ?? ''}>
      <span className={'h-2.5 w-2.5 shrink-0 rounded-full ' + LINK_DOT[cell.sev]} aria-hidden />
      <span className="shrink-0 font-medium">{word}</span>
      {cell.kind === 'silent' && cell.state && (
        <span className="truncate text-xs text-muted-foreground">
          <Trans
            t={t}
            i18nKey="tills.lastReport"
            values={{ state: cell.stateLabelKey ? t(cell.stateLabelKey) : cell.state, at: formatDateTime(till.reportedAt) }}
            components={{ at: <Ltr /> }}
          />
        </span>
      )}
      {cell.noteKey && <span className="truncate text-xs text-muted-foreground">{t(cell.noteKey)}</span>}
      {cell.figures && (
        <span className={'truncate text-xs ' + (quiet ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
          <Trans
            t={t}
            i18nKey="tills.figures"
            values={tillFigureTexts(cell.figures)}
            components={{ fail: <Ltr />, slow: <Ltr />, p95: <Ltr /> }}
          />
          {cell.since && (
            <>
              {' · '}
              <Trans t={t} i18nKey="tills.since" values={{ at: formatDateTime(cell.since) }} components={{ at: <Ltr /> }} />
            </>
          )}
        </span>
      )}
    </span>
  )
}
