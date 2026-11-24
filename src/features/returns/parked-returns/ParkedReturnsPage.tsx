import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { formatMoneyOfUnknownCurrency } from '@/core/money'
import type { ParkedReturnRow } from '@/core/models/parked-returns'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { TD, TH } from '@/core/ui/sheet-table'
import StatusBadge from '@/core/ui/StatusBadge'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { useDebounced } from '@/core/util/use-debounced'
import { canViewParkedReturns } from './access'
import { listKey, parkedReturnsApi } from './api'
import {
  changeFilter,
  filtersFromParams,
  filtersToParams,
  LEDGER_STATUSES,
  listQuery,
  NO_FILTERS,
  PAGE_SIZE,
  VIEWS,
  type ParkedFilters,
} from './filter'
import { ageDays, ledgerLabel, needsHqReasonLabel, rowBadges } from './labels'
import ParkedReturnDrawer from './ParkedReturnDrawer'

/** A count for a plural sentence: `count` picks the form, `n` is the figure shown, grouped and isolated. */
const counted = (count: number) => ({ count, n: fsi(formatFigure(count)) })

/**
 * **Parked returns** (BackOffice ticket 4224, spec 4212 stories 1-13, 23; doors BackOffice 4218): every parked return
 * across the stores, opening on "needs HQ". Filters by view, store, partner, ledger status, age and transaction, kept in
 * the URL; paged; the server orders the rows. A row opens its detail drawer, where the settle actions live behind `ParkedReturns:06` (ticket 4225; story
 * 23: none without it).
 */
export default function ParkedReturnsPage() {
  const { t } = useTranslation('parked-returns')
  return (
    <ScreenGate can={canViewParkedReturns} ns="parked-returns" title={t('title')} subtitle={t('subtitle')}>
      <ParkedReturnsBody />
    </ScreenGate>
  )
}

type TextFilter = 'store' | 'partner' | 'transactionId'

/** A typed filter reaches the address once typing stops; Back or a pasted link moves the draft to the address's. */
function DraftInput({
  value,
  onSettled,
  changedFromOutside,
  ...rest
}: {
  value: string
  onSettled: (v: string) => void
  changedFromOutside: () => boolean
  'data-testid': string
}) {
  const [draft, setDraft] = useState(value)
  const typed = useDebounced(draft.trim(), 300)
  useEffect(() => {
    if (typed !== value) onSettled(typed)
    // Only the settled draft drives this.
  }, [typed])
  useEffect(() => {
    if (changedFromOutside()) setDraft(value)
  }, [value, changedFromOutside])
  return <Input value={draft} onChange={(e) => setDraft(e.target.value)} dir="ltr" {...rest} />
}

function ParkedReturnsBody() {
  const { t } = useTranslation('parked-returns')
  const { query: filters, update, changedFromOutside } = useUrlQuery(filtersFromParams, filtersToParams)
  const [open, setOpen] = useState<ParkedReturnRow | null>(null)

  const set = (change: Partial<Omit<ParkedFilters, 'page'>>) => update((f) => changeFilter(f, change))
  const setText = (key: TextFilter) => (v: string) => update((f) => (f[key] === v ? f : changeFilter(f, { [key]: v })))
  const filtered = filtersToParams({ ...filters, page: 1 }).toString() !== ''

  const query = listQuery(filters)
  const list = useQuery({
    queryKey: listKey(query),
    queryFn: () => parkedReturnsApi.list(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const page = list.data

  // An emptied page past the first falls back to the last page — only on the answer for THIS page.
  const rowCount = page?.rows.length ?? 0
  const total = page?.total ?? 0
  const settled = list.isSuccess && !list.isPlaceholderData
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({ page: filters.page, rowCount, totalMatches: total, pageSize: PAGE_SIZE })
    if (last !== filters.page) update((f) => ({ ...f, page: last }))
  }, [settled, filters.page, rowCount, total])

  const now = new Date()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="group"
        aria-label={t('filters.label')}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3"
        data-testid="parked-filters"
      >
        <Field label={t('filters.view')} className="w-44">
          <Select value={filters.view} onChange={(e) => set({ view: e.target.value as ParkedFilters['view'] })} data-testid="parked-filter-view">
            {VIEWS.map((v) => (
              <option key={v} value={v}>
                {t(`filters.views.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.store')} className="w-28">
          <DraftInput value={filters.store} onSettled={setText('store')} changedFromOutside={changedFromOutside} data-testid="parked-filter-store" />
        </Field>
        <Field label={t('filters.partner')} className="w-32">
          <DraftInput value={filters.partner} onSettled={setText('partner')} changedFromOutside={changedFromOutside} data-testid="parked-filter-partner" />
        </Field>
        <Field label={t('filters.status')} className="w-36">
          <Select
            value={filters.ledgerStatus}
            onChange={(e) => set({ ledgerStatus: e.target.value as ParkedFilters['ledgerStatus'] })}
            data-testid="parked-filter-status"
          >
            <option value="">{t('filters.any')}</option>
            {LEDGER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(ledgerLabel(s).key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.age')} className="w-32">
          <Select
            value={filters.minAgeDays === null ? '' : String(filters.minAgeDays)}
            onChange={(e) => set({ minAgeDays: e.target.value === '' ? null : Number(e.target.value) })}
            data-testid="parked-filter-age"
          >
            <option value="">{t('filters.any')}</option>
            {[1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {t('age.atLeast', { count: d, n: fsi(d) })}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.transaction')} className="w-48">
          <DraftInput
            value={filters.transactionId}
            onSettled={setText('transactionId')}
            changedFromOutside={changedFromOutside}
            data-testid="parked-filter-transaction"
          />
        </Field>
        {filtered && (
          <Button variant="text" onClick={() => update(() => NO_FILTERS)} data-testid="parked-filter-clear">
            <X className="h-3.5 w-3.5" aria-hidden />
            {t('filters.clear')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="parked-caption">
        {page && (
          <>
            <span data-testid="parked-count">{t('list.count', counted(page.total))}</span>
            {filters.view !== 'needsHq' && <span data-testid="parked-needs-hq-count">{t('list.needsHqCount', counted(page.needsHqTotal))}</span>}
          </>
        )}
        <span>{t('list.order')}</span>
        {list.isFetching && (
          <span className="flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('list.reading')}
          </span>
        )}
      </div>

      {list.isError ? (
        <ErrorBanner title={t('list.failed')} message={apiErrorMessage(list.error, t('list.failed'))} className="p-3" />
      ) : page && page.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="parked-empty">
          {filters.view === 'needsHq' && !filtered ? t('list.emptyNeedsHq') : t('list.empty')}
        </p>
      ) : page ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm" data-testid="parked-table">
              <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t('col.transaction')}</th>
                  <th className={TH}>{t('col.storeTill')}</th>
                  <th className={TH}>{t('col.parkedAt')}</th>
                  <th className={`${TH} text-end`}>{t('col.age')}</th>
                  <th className={TH}>{t('col.state')}</th>
                  <th className={TH}>{t('col.partners')}</th>
                  <th className={TH}>{t('col.ledger')}</th>
                  <th className={`${TH} text-end`}>{t('col.amount')}</th>
                  <th className={TH}>{t('col.deadline')}</th>
                  <th className={TH}>{t('col.settled')}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <ParkedRow key={row.transactionId} row={row} now={now} onOpen={() => setOpen(row)} />
                ))}
              </tbody>
            </table>
          </div>
          {showsPager(page.total, PAGE_SIZE) && (
            <GridPager
              page={filters.page}
              pageSize={PAGE_SIZE}
              totalMatches={page.total}
              busy={list.isFetching}
              onPage={(next) => update((f) => ({ ...f, page: next }))}
            />
          )}
        </div>
      ) : null}

      {open && <ParkedReturnDrawer row={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ParkedRow({ row, now, onOpen }: { row: ParkedReturnRow; now: Date; onOpen: () => void }) {
  const { t } = useTranslation('parked-returns')
  const age = ageDays(row.parkedAt, now)
  return (
    <tr className="border-t border-border/60" data-testid="parked-row" data-transaction={row.transactionId} data-state={row.state}>
      <td className={TD}>
        <Button
          variant="text"
          onClick={onOpen}
          title={t('list.open', { transactionId: fsi(row.transactionId) })}
          data-testid="parked-row-open"
        >
          <Ltr>{row.transactionId}</Ltr>
        </Button>
      </td>
      <td className={TD}>
        <span className="flex flex-col">
          <Ltr>{formatPair(row.storeCode, row.registerId)}</Ltr>
          {row.operatorId && (
            <span className="text-xs text-muted-foreground">
              {t('list.cashier')} <Ltr>{row.operatorId}</Ltr>
            </span>
          )}
        </span>
      </td>
      <td className={TD}>
        <Ltr>{formatDateTime(row.parkedAt)}</Ltr>
      </td>
      <td className={`${TD} text-end`}>{age !== null && <bdi>{t('age.days', { count: age, n: fsi(age) })}</bdi>}</td>
      <td className={TD}>
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap gap-1" data-testid="parked-row-badges">
            {rowBadges(row).map((b) => (
              <StatusBadge key={b.key} sev={b.sev}>
                {t(b.key)}
              </StatusBadge>
            ))}
            {row.cashRuled && <StatusBadge sev="ok">{t('badge.cashRuled')}</StatusBadge>}
          </span>
          {row.needsHqReasons.length > 0 && (
            <span className="text-xs text-muted-foreground whitespace-normal" data-testid="parked-row-reasons">
              {row.needsHqReasons.map((r) => t(needsHqReasonLabel(r))).join(t('list.reasonJoin'))}
            </span>
          )}
        </span>
      </td>
      <td className={TD}>
        <span className="flex flex-col">
          {row.partners.map((p) => (
            <Ltr key={p}>{p}</Ltr>
          ))}
        </span>
      </td>
      <td className={TD}>
        <span className="flex flex-wrap gap-1">
          {row.ledgerStatuses.map((s) => (
            <StatusBadge key={s} sev={ledgerLabel(s).sev}>
              {t(ledgerLabel(s).key)}
            </StatusBadge>
          ))}
          <span className="text-xs text-muted-foreground">{t('list.grains', counted(row.grainCount))}</span>
        </span>
      </td>
      <td className={`${TD} text-end tabular-nums`}>
        <Ltr>{formatMoneyOfUnknownCurrency(row.refundAmount)}</Ltr>
      </td>
      <td className={TD}>
        <span className="flex flex-col">
          <Ltr>{formatDateTime(row.parkDeadline)}</Ltr>
          {row.escalated && <StatusBadge sev="bad">{t('badge.escalated')}</StatusBadge>}
        </span>
      </td>
      <td className={TD}>
        {row.lastSettledBy && (
          <span className="flex flex-col">
            <Ltr>{row.lastSettledBy}</Ltr>
            <span className="text-xs text-muted-foreground">
              <Ltr>{formatDateTime(row.lastSettledTime)}</Ltr>
            </span>
          </span>
        )}
      </td>
    </tr>
  )
}
