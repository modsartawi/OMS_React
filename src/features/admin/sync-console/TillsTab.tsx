import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import Ltr from '@/core/ui/Ltr'
import type { LinkVerdict, Till } from '@/core/models/sync-console'
import { formatDateTime } from '@/core/util/date-format'
import { storeTillsQuery } from './api'
import { MONO } from './console-columns'
import { figure } from './helpers'
import TabGrid from './TabGrid'
import { LINK_DOT, tillLinkCell, tillSilent } from './tills-helpers'

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
  const columns = useMemo(() => buildTillColumns(t, asOf), [t, asOf])
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
    </div>
  )
}

function buildTillColumns(t: TFunction, asOf: string): ColDef<Till>[] {
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
  ]
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
            values={{ state: t(`tills.states.${cell.state}`), at: formatDateTime(till.reportedAt) }}
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
            values={{
              fail: figure(cell.figures.failPct ?? 0),
              slow: figure(cell.figures.slowPct ?? 0),
              p95: figure(cell.figures.p95Ms ?? 0),
            }}
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
