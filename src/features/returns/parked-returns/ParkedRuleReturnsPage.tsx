import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, RotateCcw, X } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { ParkedRuleReturnRow } from '@/core/models/parked-returns'
import { usePermissions } from '@/core/permissions'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
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
import { parkedReturnsApi, RULE_RETURNS_KEY, ruleListKey } from './api'
import {
  canUnpark,
  NO_RULE_FILTERS,
  RULE_PAGE_SIZE,
  ruleFiltersFromParams,
  ruleFiltersToParams,
  ruleListQuery,
  ruleReturnLabel,
  unparkPending,
  unparkRefusalKey,
  type RuleFilters,
} from './rule-returns'

/**
 * **Parked rule returns** (BackOffice ticket 4226, spec 4212 stories 31-33; doors BackOffice 4221 / 4222): the returns
 * whose rule-driven partner leg a till gave up on and parked, oldest first. Filters by store and "include sent", kept in
 * the URL; paged. Each row says its last state — parked, un-park requested, un-park applied, sent, parked again — and,
 * with the settle right (`ParkedReturns:06`), offers **Un-park**: HQ records the request, the till applies it at its
 * next drain and mirrors the outcome back. Every answer, a success or a refusal, reads the list again.
 */
export default function ParkedRuleReturnsPage() {
  const { t } = useTranslation('parked-returns')
  return (
    <ScreenGate can={canViewParkedReturns} ns="parked-returns" title={t('rule.title')} subtitle={t('rule.subtitle')}>
      <RuleReturnsBody />
    </ScreenGate>
  )
}

/** The store filter reaches the address once typing stops; Back or a pasted link moves the draft to the address's. */
function StoreInput({ value, onSettled, changedFromOutside }: { value: string; onSettled: (v: string) => void; changedFromOutside: () => boolean }) {
  const [draft, setDraft] = useState(value)
  const typed = useDebounced(draft.trim(), 300)
  useEffect(() => {
    if (typed !== value) onSettled(typed)
    // Only the settled draft drives this.
  }, [typed])
  useEffect(() => {
    if (changedFromOutside()) setDraft(value)
  }, [value, changedFromOutside])
  return <Input value={draft} onChange={(e) => setDraft(e.target.value)} dir="ltr" data-testid="rule-filter-store" />
}

function RuleReturnsBody() {
  const { t } = useTranslation('parked-returns')
  const permissions = usePermissions()
  const qc = useQueryClient()
  const { query: filters, update, changedFromOutside } = useUrlQuery(ruleFiltersFromParams, ruleFiltersToParams)

  const set = (change: Partial<Omit<RuleFilters, 'page'>>) => update((f) => ({ ...f, ...change, page: 1 }))
  const filtered = ruleFiltersToParams({ ...filters, page: 1 }).toString() !== ''

  const query = ruleListQuery(filters)
  const list = useQuery({
    queryKey: ruleListKey(query),
    queryFn: () => parkedReturnsApi.ruleList(query),
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
    const last = clampToLastPageWhenCurrentPageEmpties({ page: filters.page, rowCount, totalMatches: total, pageSize: RULE_PAGE_SIZE })
    if (last !== filters.page) update((f) => ({ ...f, page: last }))
  }, [settled, filters.page, rowCount, total])

  const unpark = useMutation({
    mutationFn: (row: ParkedRuleReturnRow) => parkedReturnsApi.unpark(row.id),
    onSuccess: (_answer, row) => notify.success(t('rule.unpark.done'), formatPair(row.storeCode, row.transactionId)),
    // A success shows "un-park requested"; a refusal shows what the server holds now (a colleague's request, a sent row).
    onSettled: () => void qc.invalidateQueries({ queryKey: RULE_RETURNS_KEY }),
  })

  async function press(row: ParkedRuleReturnRow) {
    if (unpark.isPending) return
    const ok = await confirmAction(
      t('rule.unpark.confirmBody', { store: fsi(row.storeCode), transactionId: fsi(row.transactionId) }),
      t('rule.unpark.confirmTitle'),
    )
    if (ok) unpark.mutate(row)
  }

  const refusalKey = unpark.isError ? unparkRefusalKey(unpark.error) : null
  const refusal = unpark.isError ? (refusalKey ? t(refusalKey) : apiErrorMessage(unpark.error, t('rule.refusal.failed'))) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="group"
        aria-label={t('rule.filters.label')}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3"
        data-testid="rule-filters"
      >
        <Field label={t('rule.filters.store')} className="w-28">
          <StoreInput value={filters.store} onSettled={(v) => v !== filters.store && set({ store: v })} changedFromOutside={changedFromOutside} />
        </Field>
        <Field label={t('rule.filters.show')} className="w-40">
          <Select
            value={filters.includeSent ? 'sent' : ''}
            onChange={(e) => set({ includeSent: e.target.value === 'sent' })}
            data-testid="rule-filter-sent"
          >
            <option value="">{t('rule.filters.parkedOnly')}</option>
            <option value="sent">{t('rule.filters.includeSent')}</option>
          </Select>
        </Field>
        {filtered && (
          <Button variant="text" onClick={() => update(() => NO_RULE_FILTERS)} data-testid="rule-filter-clear">
            <X className="h-3.5 w-3.5" aria-hidden />
            {t('rule.filters.clear')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="rule-caption">
        {page && <span data-testid="rule-count">{t('rule.list.count', { count: page.total, n: fsi(formatFigure(page.total)) })}</span>}
        <span>{t('rule.list.order')}</span>
        {list.isFetching && (
          <span className="flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('rule.list.reading')}
          </span>
        )}
      </div>

      {refusal && <ErrorBanner className="p-2.5" title={t('rule.refusal.title')} message={refusal} />}

      {list.isError ? (
        <ErrorBanner title={t('rule.list.failed')} message={apiErrorMessage(list.error, t('rule.list.failed'))} className="p-3" />
      ) : page && page.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="rule-empty">
          {t('rule.list.empty')}
        </p>
      ) : page ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm" data-testid="rule-table">
              <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t('rule.col.storeTill')}</th>
                  <th className={TH}>{t('rule.col.transaction')}</th>
                  <th className={TH}>{t('rule.col.refusal')}</th>
                  <th className={`${TH} text-end`}>{t('rule.col.attempts')}</th>
                  <th className={TH}>{t('rule.col.parkedAt')}</th>
                  <th className={TH}>{t('rule.col.state')}</th>
                  <th className={TH}>{t('rule.col.action')}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <RuleRow
                    key={row.id}
                    row={row}
                    offerUnpark={canUnpark(row, permissions)}
                    busy={unpark.isPending}
                    pressing={unpark.isPending && unpark.variables?.id === row.id}
                    onUnpark={() => void press(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {showsPager(page.total, RULE_PAGE_SIZE) && (
            <GridPager
              page={filters.page}
              pageSize={RULE_PAGE_SIZE}
              totalMatches={page.total}
              busy={list.isFetching}
              onPage={(next) => update((f) => ({ ...f, page: next }))}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

function RuleRow({
  row,
  offerUnpark,
  busy,
  pressing,
  onUnpark,
}: {
  row: ParkedRuleReturnRow
  offerUnpark: boolean
  busy: boolean
  pressing: boolean
  onUnpark: () => void
}) {
  const { t } = useTranslation('parked-returns')
  const label = ruleReturnLabel(row)
  return (
    <tr className="border-t border-border/60" data-testid="rule-row" data-rule-return={row.id} data-state={row.state}>
      <td className={TD}>
        <Ltr>{formatPair(row.storeCode, row.registerId)}</Ltr>
      </td>
      <td className={TD}>
        <Ltr>{row.transactionId}</Ltr>
      </td>
      <td className={TD}>
        <span className="flex flex-col">
          <Ltr>{row.errorCode}</Ltr>
          {row.errorMessage && (
            <span className="max-w-md truncate text-xs text-muted-foreground" title={row.errorMessage}>
              <Ltr>{row.errorMessage}</Ltr>
            </span>
          )}
        </span>
      </td>
      <td className={`${TD} text-end tabular-nums`}>{formatFigure(row.attemptsCount)}</td>
      <td className={TD}>
        <Ltr>{formatDateTime(row.parkedAt)}</Ltr>
      </td>
      <td className={TD}>
        <span className="flex flex-col gap-1">
          <StatusBadge sev={label.sev}>{t(label.key)}</StatusBadge>
          {unparkPending(row) && row.unparkRequestedBy && (
            <span className="text-xs text-muted-foreground" data-testid="rule-row-requested">
              {t('rule.unpark.requestedBy', { user: fsi(row.unparkRequestedBy), time: fsi(formatDateTime(row.unparkRequestedTime)) })}
            </span>
          )}
        </span>
      </td>
      <td className={TD}>
        {offerUnpark && (
          <Button variant="outlined" disabled={busy} onClick={onUnpark} data-testid="rule-row-unpark">
            {pressing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
            {pressing ? t('rule.unpark.committing') : t('rule.unpark.action')}
          </Button>
        )}
      </td>
    </tr>
  )
}
