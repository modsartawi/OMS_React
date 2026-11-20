import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Loader2, X } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { PatternCaseRow } from '@/core/models/insurance-patterns'
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
import { useDebounced } from '@/core/util/use-debounced'
import { canOpenPatternCases } from './access'
import { casesKey, patternsApi } from './api'
import {
  casesQuery,
  changeFilter,
  filtersFromParams,
  filtersToParams,
  NO_FILTERS,
  PAGE_SIZE,
  periodBackwards,
  SEVERITIES,
  SIGNALS,
  STATUSES,
  type CaseFilters,
} from './filter'
import { casePath } from './paths'
import { counted, severitySev, severityText, signalText, statusSev, statusText, unitWords } from './words'

/**
 * **Pattern cases** (oms 922; BackOffice spec 4050, door 4053, reconciled as built: `InsuranceRules/Patterns/Cases`): the insurance team's
 * list of multi-pharmacy cases, strongest first. Filters by store, period, signal, status and severity, kept in the URL;
 * paged; the server orders by score, then the last dispense. A case shows its number, never a patient: the patient is
 * behind the investigator's logged reveal on the case screen (923).
 *
 * One grant for the list and the case screen (`canOpenPatternCases`, the analyst's). The gate hides; the door refuses.
 */
export default function PatternCasesPage() {
  const { t } = useTranslation('insurance-patterns')
  return (
    <ScreenGate can={canOpenPatternCases} ns="insurance-patterns" title={t('title')} subtitle={t('subtitle')}>
      <CasesBody />
    </ScreenGate>
  )
}

function CasesBody() {
  const { t } = useTranslation('insurance-patterns')
  const { query: filters, update, changedFromOutside } = useUrlQuery(filtersFromParams, filtersToParams)

  // The store is typed into a draft beside the address and reaches it once typing stops; Back or a pasted link moves
  // the draft to the address's.
  const [storeDraft, setStoreDraft] = useState(filters.store)
  const storeTyped = useDebounced(storeDraft.trim(), 300)
  useEffect(() => {
    update((f) => (f.store === storeTyped ? f : changeFilter(f, { store: storeTyped })))
    // Only the settled draft drives this; `update` composes against the latest query written.
  }, [storeTyped])
  useEffect(() => {
    if (changedFromOutside()) setStoreDraft(filters.store)
  }, [filters.store, changedFromOutside])

  const set = (change: Partial<Omit<CaseFilters, 'page'>>) => update((f) => changeFilter(f, change))
  const clear = () => {
    setStoreDraft('')
    update(() => NO_FILTERS)
  }
  const filtered = filtersToParams({ ...filters, page: 1 }).toString() !== ''

  const backwards = periodBackwards(filters)
  const query = casesQuery(filters)
  const cases = useQuery({
    queryKey: casesKey(query),
    queryFn: () => patternsApi.cases(query),
    enabled: !backwards,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const page = cases.data

  // An emptied page past the first (the cases shrank under it, or a pasted address asks too far) falls back to the last
  // page, never "no case matches" beside a count with no pager to leave by (review 5). Only on the answer for THIS page,
  // never the previous one kept on screen.
  const rowCount = page?.items.length ?? 0
  const totalMatches = page?.totalMatches ?? 0
  const settled = cases.isSuccess && !cases.isPlaceholderData
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({ page: filters.page, rowCount, totalMatches, pageSize: PAGE_SIZE })
    if (last !== filters.page) update((f) => ({ ...f, page: last }))
    // `update` composes against the latest query written.
  }, [settled, filters.page, rowCount, totalMatches])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="group"
        aria-label={t('filters.label')}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3"
        data-testid="patterns-filters"
      >
        <Field label={t('filters.store')} hint={t('filters.storeHint')} className="w-32">
          <Input value={storeDraft} onChange={(e) => setStoreDraft(e.target.value)} dir="ltr" data-testid="patterns-filter-store" />
        </Field>
        <Field label={t('filters.from')} className="w-40">
          <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} dir="ltr" data-testid="patterns-filter-from" />
        </Field>
        <Field label={t('filters.to')} error={backwards ? t('filters.backwards') : undefined} className="w-40">
          <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} dir="ltr" data-testid="patterns-filter-to" />
        </Field>
        <Field label={t('filters.signal')} className="w-44">
          <Select value={filters.signal} onChange={(e) => set({ signal: e.target.value as CaseFilters['signal'] })} data-testid="patterns-filter-signal">
            <option value="">{t('filters.any')}</option>
            {SIGNALS.map((s) => (
              <option key={s} value={s}>
                {t(`signal.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.status')} className="w-36">
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value as CaseFilters['status'] })} data-testid="patterns-filter-status">
            <option value="">{t('filters.any')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.severity')} className="w-32">
          <Select value={filters.severity} onChange={(e) => set({ severity: e.target.value as CaseFilters['severity'] })} data-testid="patterns-filter-severity">
            <option value="">{t('filters.any')}</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {t(`severity.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        {filtered && (
          <Button variant="text" onClick={clear} data-testid="patterns-filter-clear">
            <X className="h-3.5 w-3.5" aria-hidden />
            {t('filters.clear')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="patterns-caption">
        {page && !backwards && <span data-testid="patterns-count">{t('list.count', counted(page.totalMatches))}</span>}
        <span>{t('list.order')}</span>
        {cases.isFetching && (
          <span className="flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('list.reading')}
          </span>
        )}
      </div>

      {backwards ? null : cases.isError ? (
        <ErrorBanner title={t('list.failed')} message={apiErrorMessage(cases.error, t('list.failed'))} className="p-3" />
      ) : page && page.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="patterns-empty">
          {t('list.empty')}
        </p>
      ) : page ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm" data-testid="patterns-table">
              <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t('col.case')}</th>
                  <th className={TH}>{t('col.stores')}</th>
                  <th className={`${TH} text-end`}>{t('col.dispenses')}</th>
                  <th className={TH}>{t('col.span')}</th>
                  <th className={`${TH} text-end`}>{t('col.longestLeg')}</th>
                  <th className={TH}>{t('col.shortestGap')}</th>
                  <th className={TH}>{t('col.signals')}</th>
                  <th className={TH}>{t('col.score')}</th>
                  <th className={TH}>{t('col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((row) => (
                  <CaseRow key={row.caseNumber} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          {showsPager(page.totalMatches, PAGE_SIZE) && (
            <GridPager
              page={filters.page}
              pageSize={PAGE_SIZE}
              totalMatches={page.totalMatches}
              busy={cases.isFetching}
              onPage={(next) => update((f) => ({ ...f, page: next }))}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

function CaseRow({ row }: { row: PatternCaseRow }) {
  const { t } = useTranslation('insurance-patterns')
  const units = unitWords(t)
  return (
    <tr className="border-t border-border/60" data-testid="patterns-row" data-case={row.caseNumber} data-status={row.status} data-score={row.score}>
      <td className={TD}>
        <Link
          to={casePath(row.caseNumber)}
          title={t('list.openCase', { caseNumber: fsi(row.caseNumber) })}
          className="font-medium text-primary underline-offset-2 hover:underline"
          data-testid="patterns-row-case"
        >
          <Ltr>{row.caseNumber}</Ltr>
        </Link>
      </td>
      <td className={`${TD} text-xs`} data-testid="patterns-row-stores">
        <span className="flex flex-col">
          {row.stores.map((s) => (
            <Ltr key={s.storeCode}>{formatPair(s.storeCode, s.storeName)}</Ltr>
          ))}
        </span>
      </td>
      <td className={`${TD} text-end tabular-nums`}>
        <Ltr>{row.dispenseCount}</Ltr>
      </td>
      <td className={TD}>
        <bdi>{units.duration(row.spanMinutes)}</bdi>
      </td>
      <td className={`${TD} text-end`} data-testid="patterns-row-longest">
        {row.longestLegKm !== null && <bdi>{units.km(row.longestLegKm)}</bdi>}
      </td>
      <td className={TD}>{row.shortestGapMinutes !== null && <bdi>{units.duration(row.shortestGapMinutes)}</bdi>}</td>
      <td className={TD}>
        <span className="flex flex-wrap gap-1">
          {row.signals.map((s) => (
            <StatusBadge key={s} sev="mute">
              {signalText(t, s)}
            </StatusBadge>
          ))}
        </span>
      </td>
      <td className={TD}>
        <span className="inline-flex items-center gap-1.5">
          <Ltr>{row.score}</Ltr>
          <StatusBadge sev={severitySev(row.severity)}>{severityText(t, row.severity)}</StatusBadge>
        </span>
      </td>
      <td className={TD}>
        <StatusBadge sev={statusSev(row.status)}>{statusText(t, row.status)}</StatusBadge>
      </td>
    </tr>
  )
}
