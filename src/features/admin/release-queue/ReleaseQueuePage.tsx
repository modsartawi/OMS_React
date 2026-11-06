import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { SlotConvergence, SlotQueueEntry } from '@/core/models/release-queue'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import { showsPager } from '@/core/ui/pager'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatCount, formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { useDebounced } from '@/core/util/use-debounced'
import {
  canViewReleaseQueue,
  convergenceQuery,
  historyQuery,
  poolQuery,
  queueQuery,
  releaseQueueAccessQuery,
  slotsQuery,
} from './api'
import { RELEASE_QUEUE_COL_DEF, historyColumns, queueColumns, queueRows, slotColumns } from './columns'
import {
  HISTORY_PAGE_SIZE,
  OUTCOME_FILTERS,
  RELEASE_QUEUE_TABS,
  convergenceShares,
  formatSeconds,
  fourHourFlag,
  releaseQueueFromParams,
  releaseQueueToParams,
  storesInGrantOrder,
  type HistoryFilter,
  type ReleaseQueueTab,
} from './helpers'

/**
 * Admin ▸ Release download queue (ticket 791, BackOffice spec 3396 / 3401) — `/admin/release-queue`.
 *
 * What the till download pool is doing: the pool's size (0 = paused), the live slots with progress, the queue in grant
 * order (urgent marked, waits of four hours flagged), the finished downloads with their outcome, and how far each
 * release has spread. Read-only — resizing, pausing and freeing a slot are ticket 792's. The live panels re-read every
 * 15 s. Gated on `PosRelease.Queue.View` by the same probe the menu leaf reads.
 */
export default function ReleaseQueuePage() {
  const { t } = useTranslation('release-queue')
  return (
    <ScreenGate query={releaseQueueAccessQuery()} can={canViewReleaseQueue} ns="release-queue" title={t('title')} subtitle={t('subtitle')}>
      <ReleaseQueue />
    </ScreenGate>
  )
}

function ReleaseQueue() {
  const { t } = useTranslation('release-queue')
  const { query, update } = useUrlQuery(releaseQueueFromParams, releaseQueueToParams)
  const panelId = useId()

  return (
    <div className="flex min-w-0 flex-col gap-4" data-release-queue="">
      <PoolStrip />
      <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-1">
        {RELEASE_QUEUE_TABS.map((tab) => (
          <Chip
            key={tab}
            variant="tab"
            on={query.tab === tab}
            id={`${panelId}-${tab}`}
            aria-controls={panelId}
            onClick={() => update((q) => ({ ...q, tab }))}
            data-tab={tab}
          >
            {t(`tabs.${tab}`)}
          </Chip>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${query.tab}`} data-tab-panel={query.tab} className="flex min-w-0 flex-col gap-2">
        <Panel tab={query.tab} history={query.history} onHistory={(history) => update((q) => ({ ...q, history }))} />
      </div>
    </div>
  )
}

function Panel({ tab, history, onHistory }: { tab: ReleaseQueueTab; history: HistoryFilter; onHistory: (h: HistoryFilter) => void }) {
  switch (tab) {
    case 'slots':
      return <SlotsPanel />
    case 'queue':
      return <QueuePanel />
    case 'history':
      return <HistoryPanel filter={history} onChange={onHistory} />
    case 'convergence':
      return <ConvergencePanel />
  }
}

/** A read's failure, in the panel's words; a bare 403 is the missing grant, not an outage. */
function ReadError({ error, what }: { error: unknown; what: string }) {
  const { t } = useTranslation('release-queue')
  return (
    <ErrorBanner
      className="p-2.5"
      title={t('read.failedTitle', { what })}
      message={isBareDenial(error) ? t('read.denied') : apiErrorMessage(error, t('read.failed'))}
    />
  )
}

function Refreshing({ on }: { on: boolean }) {
  const { t } = useTranslation('release-queue')
  return on ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      {t('refreshing')}
    </span>
  ) : null
}

/** The pool: size, slots in use, paused, who last changed it. */
function PoolStrip() {
  const { t } = useTranslation('release-queue')
  const pool = useQuery(poolQuery())
  if (pool.isPending) return <p className="text-xs text-muted-foreground">{t('pool.loading')}</p>
  if (pool.isError) return <ReadError error={pool.error} what={t('pool.heading')} />
  const p = pool.data
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm" data-pool={p.poolSize} data-pool-paused={p.paused}>
      <span className="font-semibold">{t('pool.heading')}</span>
      <span data-pool-in-use="">
        <Trans t={t} i18nKey="pool.inUse" values={{ v: formatCount(formatFigure(p.activeSlots), formatFigure(p.poolSize)) }} components={{ v: <Ltr /> }} />
      </span>
      {p.paused && (
        <span data-pool-paused-badge="">
          <StatusBadge sev="bad">{t('pool.paused')}</StatusBadge>
        </span>
      )}
      <span className="text-xs text-muted-foreground" data-pool-changed="">
        {p.isDefault ? (
          t('pool.default')
        ) : (
          <Trans t={t} i18nKey="pool.changed" values={{ v: formatPair(formatDateTime(p.updatedAt), p.updatedBy) }} components={{ v: <Ltr /> }} />
        )}
      </span>
      <Refreshing on={pool.isFetching} />
    </div>
  )
}

function Grid<T>({ rows, columns, rowId, loading, empty, testId }: { rows: T[]; columns: ColDef<T>[]; rowId: (r: T) => string; loading: boolean; empty: string; testId: string }) {
  const NoRows = useMemo(() => () => <span className="text-sm text-muted-foreground">{empty}</span>, [empty])
  return (
    <div className="relative h-[calc(100vh-24rem)] min-h-80" data-grid={testId}>
      <AgGridReact<T>
        theme={omsGridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={RELEASE_QUEUE_COL_DEF as ColDef<T>}
        getRowId={({ data }) => rowId(data)}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        animateRows={false}
        suppressColumnVirtualisation
        loading={loading}
        noRowsOverlayComponent={NoRows}
      />
    </div>
  )
}

function PanelHeader({ heading, children }: { heading: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <h2 className="text-sm font-semibold">{heading}</h2>
      {children}
    </div>
  )
}

function SlotsPanel() {
  const { t } = useTranslation('release-queue')
  const slots = useQuery(slotsQuery())
  const columns = useMemo(() => slotColumns(t), [t])
  return (
    <>
      <PanelHeader heading={t('slots.heading')}>
        {slots.data && (
          <span className="text-xs text-muted-foreground" data-slots-count={slots.data.length}>
            <Trans t={t} i18nKey="slots.count" count={slots.data.length} values={{ n: formatFigure(slots.data.length) }} components={{ n: <Ltr /> }} />
          </span>
        )}
        <Refreshing on={slots.isFetching && !slots.isPending} />
      </PanelHeader>
      {slots.isError && <ReadError error={slots.error} what={t('slots.heading')} />}
      <Grid rows={slots.isError ? [] : (slots.data ?? [])} columns={columns} rowId={(r) => r.leaseId} loading={slots.isPending} empty={t('slots.empty')} testId="slots" />
    </>
  )
}

function QueuePanel() {
  const { t } = useTranslation('release-queue')
  const queue = useQuery(queueQuery())
  const length = queue.data?.queueLength ?? 0
  const columns = useMemo(() => queueColumns(t), [t])
  const entries = queue.isError ? NO_ENTRIES : (queue.data?.entries ?? NO_ENTRIES)
  const rows = useMemo(() => queueRows(entries, length), [entries, length])
  const stores = useMemo(() => storesInGrantOrder(entries), [entries])
  return (
    <>
      <PanelHeader heading={t('queue.heading')}>
        {queue.data && (
          <>
            <span className="text-xs text-muted-foreground" data-queue-length={queue.data.queueLength}>
              <Trans t={t} i18nKey="queue.length" count={queue.data.queueLength} values={{ n: formatFigure(queue.data.queueLength) }} components={{ n: <Ltr /> }} />
            </span>
            {queue.data.queueLength > 0 && (
              <span className="text-xs text-muted-foreground" data-queue-oldest={queue.data.oldestWaitSeconds}>
                <Trans t={t} i18nKey="queue.oldest" values={{ v: formatSeconds(queue.data.oldestWaitSeconds) }} components={{ v: <Ltr /> }} />
              </span>
            )}
          </>
        )}
        <Refreshing on={queue.isFetching && !queue.isPending} />
      </PanelHeader>
      {queue.isError && <ReadError error={queue.error} what={t('queue.heading')} />}
      {stores.length > 0 && (
        <section aria-label={t('queue.storesHeading')} className="flex flex-col gap-1" data-queue-stores="">
          <h3 className="text-xs font-medium text-muted-foreground">{t('queue.storesHeading')}</h3>
          <ol className="flex flex-wrap gap-2">
            {stores.map((s, i) => (
              <li key={s.storeCode} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs" data-queue-store={s.storeCode} data-queue-store-order={i + 1}>
                <span className="font-mono font-semibold">
                  <Ltr>{s.storeCode}</Ltr>
                </span>
                {s.tills.map((till) => (
                  <TillChip key={`${till.machineCode}-${till.package}`} till={till} />
                ))}
              </li>
            ))}
          </ol>
        </section>
      )}
      <Grid rows={rows} columns={columns} rowId={(r) => `${r.storeCode}|${r.machineCode}|${r.package}`} loading={queue.isPending} empty={t('queue.empty')} testId="queue" />
    </>
  )
}

/** A till in its store's line: its code, marked when urgent or when its wait is flagged. */
function TillChip({ till }: { till: SlotQueueEntry }) {
  const { t } = useTranslation('release-queue')
  const flagged = fourHourFlag(till)
  const tone = flagged ? 'bg-danger-050 text-danger-800' : till.urgent ? 'bg-attention-050 text-attention-800' : 'bg-muted text-muted-foreground'
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono ${tone}`} data-queue-till={till.machineCode} data-queue-till-urgent={till.urgent} data-queue-till-flagged={flagged}>
      <Ltr>{till.machineCode}</Ltr>
      {till.urgent && <span className="sr-only"> {t('queue.urgent')}</span>}
      {flagged && <span className="sr-only"> {t('queue.overFourHours')}</span>}
    </span>
  )
}

const NO_ENTRIES: SlotQueueEntry[] = []

function HistoryPanel({ filter, onChange }: { filter: HistoryFilter; onChange: (f: HistoryFilter) => void }) {
  const { t } = useTranslation('release-queue')
  // The text boxes are drafts beside the address, so typing never waits on a navigation.
  const [store, setStore] = useState(filter.store)
  const [version, setVersion] = useState(filter.version)
  const storeQ = useDebounced(store.trim(), 300)
  const versionQ = useDebounced(version.trim(), 300)
  useEffect(() => {
    if (storeQ !== filter.store || versionQ !== filter.version) onChange({ ...filter, store: storeQ, version: versionQ, page: 1 })
    // Only the debounced drafts drive this; the filter it writes is read fresh.
  }, [storeQ, versionQ])

  const history = useQuery(historyQuery(filter))
  const columns = useMemo(() => historyColumns(t), [t])
  const ids = { outcome: useId(), store: useId(), version: useId() }
  const total = history.data?.total ?? 0

  return (
    <>
      <PanelHeader heading={t('history.heading')}>
        {history.data && !history.isError && (
          <span className="text-xs text-muted-foreground" data-history-total={total}>
            <Trans t={t} i18nKey="history.total" count={total} values={{ n: formatFigure(total) }} components={{ n: <Ltr /> }} />
          </span>
        )}
        <Refreshing on={history.isFetching && !history.isPending} />
      </PanelHeader>
      <div className="flex flex-wrap items-end gap-3" data-history-filter="">
        <Field id={ids.outcome} label={t('history.filter.outcome')}>
          <Select value={filter.outcome} onChange={(e) => onChange({ ...filter, outcome: e.target.value as HistoryFilter['outcome'], page: 1 })} data-history-field="outcome">
            <option value="">{t('history.filter.anyOutcome')}</option>
            {OUTCOME_FILTERS.map((o) => (
              <option key={o} value={o}>
                {t(`history.filterOutcome.${o}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={ids.store} label={t('history.filter.store')}>
          <Input wrapperClassName="w-36" value={store} onChange={(e) => setStore(e.target.value)} data-history-field="store" />
        </Field>
        <Field id={ids.version} label={t('history.filter.version')}>
          <Input wrapperClassName="w-36" value={version} onChange={(e) => setVersion(e.target.value)} data-history-field="version" />
        </Field>
      </div>
      {history.isError && <ReadError error={history.error} what={t('history.heading')} />}
      <Grid
        rows={history.isError ? [] : (history.data?.rows ?? [])}
        columns={columns}
        rowId={(r) => r.leaseId}
        loading={history.isPending}
        empty={t('history.empty')}
        testId="history"
      />
      {!history.isError && showsPager(total, HISTORY_PAGE_SIZE) && (
        <GridPager page={filter.page} pageSize={HISTORY_PAGE_SIZE} totalMatches={total} busy={history.isFetching} onPage={(page) => onChange({ ...filter, page })} />
      )}
    </>
  )
}

function ConvergencePanel() {
  const { t } = useTranslation('release-queue')
  const convergence = useQuery(convergenceQuery())
  const rows = convergence.isError ? [] : (convergence.data ?? [])
  return (
    <>
      <PanelHeader heading={t('convergence.heading')}>
        <span className="text-xs text-muted-foreground">{t('convergence.note')}</span>
        <Refreshing on={convergence.isFetching && !convergence.isPending} />
      </PanelHeader>
      {convergence.isError && <ReadError error={convergence.error} what={t('convergence.heading')} />}
      {convergence.isPending ? (
        <p className="text-xs text-muted-foreground">{t('convergence.loading')}</p>
      ) : rows.length === 0 && !convergence.isError ? (
        <p className="text-sm text-muted-foreground" data-convergence-empty="">
          {t('convergence.empty')}
        </p>
      ) : (
        <>
          <Legend />
          <ul className="flex flex-col gap-3" data-convergence="">
            {rows.map((r) => (
              <ConvergenceRow key={`${r.package}|${r.toVersion}`} row={r} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

const STATE_FILL = { downloaded: 'bg-success', downloading: 'bg-primary', waiting: 'bg-attention' } as const
const STATES = ['downloaded', 'downloading', 'waiting'] as const

function Legend() {
  const { t } = useTranslation('release-queue')
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
      {STATES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`inline-block size-2.5 rounded-sm ${STATE_FILL[s]}`} />
          {t(`convergence.${s}`)}
        </span>
      ))}
    </div>
  )
}

/** One release: a bar of its three shares (they add up to 100), and each state's till count. */
function ConvergenceRow({ row }: { row: SlotConvergence }) {
  const { t } = useTranslation('release-queue')
  const shares = convergenceShares(row)
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3" data-convergence-row={row.toVersion} data-convergence-package={row.package}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-mono font-semibold">
          <Ltr>{row.toVersion}</Ltr>
        </span>
        <span className="text-xs text-muted-foreground">{t(`package.${row.package}`, { defaultValue: row.package })}</span>
        <span className="text-xs text-muted-foreground" data-convergence-total={shares.total}>
          <Trans t={t} i18nKey="convergence.total" count={shares.total} values={{ n: formatFigure(shares.total) }} components={{ n: <Ltr /> }} />
        </span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={t('convergence.barLabel', { downloaded: fsi(`${shares.downloaded}%`), downloading: fsi(`${shares.downloading}%`), waiting: fsi(`${shares.waiting}%`) })}>
        {STATES.map((s) => (shares[s] > 0 ? <span key={s} className={`block h-full ${STATE_FILL[s]}`} style={{ width: `${shares[s]}%` }} data-share={s} data-share-pct={shares[s]} /> : null))}
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {STATES.map((s) => (
          <div key={s} className="flex gap-1.5" data-convergence-state={s} data-convergence-count={row[s]}>
            <dt className="text-muted-foreground">{t(`convergence.${s}`)}</dt>
            <dd className="font-mono tabular-nums">
              <Ltr>{formatPair(formatFigure(row[s]), `${shares[s]}%`)}</Ltr>
            </dd>
          </div>
        ))}
      </dl>
    </li>
  )
}
