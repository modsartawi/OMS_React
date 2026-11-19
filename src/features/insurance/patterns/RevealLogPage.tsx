import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Funnel, Loader2, X } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { PatternReveal } from '@/core/models/insurance-pattern-manager'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field, { FIELD_LABEL } from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import ScreenGate from '@/core/ui/ScreenGate'
import { TD, TH } from '@/core/ui/sheet-table'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { useDebounced } from '@/core/util/use-debounced'
import { canManagePatterns } from './access'
import { managerApi, revealsKey } from './manager-api'
import { casePath } from './paths'
import {
  changeRevealFilter,
  NO_REVEAL_FILTERS,
  REVEALS_PAGE_SIZE,
  revealFiltersFromParams,
  revealFiltersToParams,
  revealPeriodBackwards,
  revealsQuery,
  type RevealFilters,
} from './reveal-log'
import { counted } from './words'

/**
 * **Reveal log** (oms 924; BackOffice spec 4050, door 4055 — STUBBED, the door is not built): who revealed which case's
 * patient, when and why — and each block (4056), which uses the identity and is logged with the reason `block`. Filters
 * by period, user and case, kept in the URL; paged; the server orders it, newest first. Each case links to its screen.
 *
 * 🔒 **It shows no identity.** The log's model has no identity field (`@/core/models/insurance-pattern-manager`), its
 * reader keeps none (`./manager-wire`), and the table has no column for one: the regulator's question is WHO LOOKED,
 * which this answers without showing whom.
 *
 * The manager's grant (`canManagePatterns`). The gate hides; the door refuses.
 */
export default function RevealLogPage() {
  const { t } = useTranslation('insurance-patterns')
  return (
    <ScreenGate can={canManagePatterns} ns="insurance-patterns" keyPrefix="revealLog.access" title={t('revealLog.title')} subtitle={t('revealLog.subtitle')}>
      <RevealsBody />
    </ScreenGate>
  )
}

function RevealsBody() {
  const { t } = useTranslation('insurance-patterns')
  const { query: filters, update, changedFromOutside } = useUrlQuery(revealFiltersFromParams, revealFiltersToParams)

  // The user is typed into a draft beside the address and reaches it once typing stops; Back or a pasted link moves the
  // draft to the address's.
  const [userDraft, setUserDraft] = useState(filters.user)
  const userTyped = useDebounced(userDraft.trim(), 300)
  useEffect(() => {
    update((f) => (f.user === userTyped ? f : changeRevealFilter(f, { user: userTyped })))
    // Only the settled draft drives this; `update` composes against the latest query written.
  }, [userTyped])
  useEffect(() => {
    if (changedFromOutside()) setUserDraft(filters.user)
  }, [filters.user, changedFromOutside])

  const set = (change: Partial<Omit<RevealFilters, 'page'>>) => update((f) => changeRevealFilter(f, change))
  const clear = () => {
    setUserDraft('')
    update(() => NO_REVEAL_FILTERS)
  }
  const filtered = revealFiltersToParams({ ...filters, page: 1 }).toString() !== ''

  const backwards = revealPeriodBackwards(filters)
  const query = revealsQuery(filters)
  const reveals = useQuery({
    queryKey: revealsKey(query),
    queryFn: () => managerApi.reveals(query),
    enabled: !backwards,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const page = reveals.data
  // The case filter names its case by number once a row of it is read; its id until then.
  const caseNumber = filters.caseId ? (page?.items.find((r) => r.caseId === filters.caseId)?.caseNumber ?? filters.caseId) : ''

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="group"
        aria-label={t('revealLog.filters.label')}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3"
        data-testid="reveals-filters"
      >
        <Field label={t('revealLog.filters.from')} className="w-40">
          <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} dir="ltr" data-testid="reveals-filter-from" />
        </Field>
        <Field label={t('revealLog.filters.to')} error={backwards ? t('revealLog.filters.backwards') : undefined} className="w-40">
          <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} dir="ltr" data-testid="reveals-filter-to" />
        </Field>
        <Field label={t('revealLog.filters.user')} hint={t('revealLog.filters.userHint')} className="w-44">
          <Input value={userDraft} onChange={(e) => setUserDraft(e.target.value)} dir="ltr" data-testid="reveals-filter-user" />
        </Field>
        {filters.caseId && (
          <div className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>{t('revealLog.filters.case')}</span>
            <Button variant="outlined" onClick={() => set({ caseId: '' })} title={t('revealLog.filters.caseClear')} data-testid="reveals-filter-case">
              {t('revealLog.filters.caseOn', { caseNumber: fsi(caseNumber) })}
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        )}
        {filtered && (
          <Button variant="text" onClick={clear} data-testid="reveals-filter-clear">
            <X className="h-3.5 w-3.5" aria-hidden />
            {t('revealLog.filters.clear')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="reveals-caption">
        {page && !backwards && <span data-testid="reveals-count">{t('revealLog.count', counted(page.totalMatches))}</span>}
        <span>{t('revealLog.order')}</span>
        {reveals.isFetching && (
          <span className="flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('revealLog.reading')}
          </span>
        )}
      </div>

      {backwards ? null : reveals.isError ? (
        <ErrorBanner title={t('revealLog.failed')} message={apiErrorMessage(reveals.error, t('revealLog.failed'))} className="p-3" />
      ) : page && page.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="reveals-empty">
          {t('revealLog.empty')}
        </p>
      ) : page ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            {/* Four columns, and never a fifth for the patient: the log says who looked, not at whom. */}
            <table className="w-full text-sm" data-testid="reveals-table">
              <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t('revealLog.col.at')}</th>
                  <th className={TH}>{t('revealLog.col.case')}</th>
                  <th className={TH}>{t('revealLog.col.by')}</th>
                  <th className={TH}>{t('revealLog.col.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((row, i) => (
                  <RevealRow key={`${row.caseId}-${row.at}-${i}`} row={row} filteredToIt={filters.caseId === row.caseId} onOnlyCase={() => set({ caseId: row.caseId })} />
                ))}
              </tbody>
            </table>
          </div>
          {showsPager(page.totalMatches, REVEALS_PAGE_SIZE) && (
            <GridPager
              page={filters.page}
              pageSize={REVEALS_PAGE_SIZE}
              totalMatches={page.totalMatches}
              busy={reveals.isFetching}
              onPage={(next) => update((f) => ({ ...f, page: next }))}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

function RevealRow({ row, filteredToIt, onOnlyCase }: { row: PatternReveal; filteredToIt: boolean; onOnlyCase: () => void }) {
  const { t } = useTranslation('insurance-patterns')
  return (
    <tr className="border-t border-border/60" data-testid="reveals-row" data-case={row.caseId}>
      <td className={TD}>
        <Ltr>{formatDateTime(row.at)}</Ltr>
      </td>
      <td className={TD}>
        <span className="inline-flex items-center gap-1">
          <Link
            to={casePath(row.caseId)}
            title={t('revealLog.openCase', { caseNumber: fsi(row.caseNumber) })}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-testid="reveals-row-case"
          >
            <Ltr>{row.caseNumber}</Ltr>
          </Link>
          {!filteredToIt && (
            <IconButton label={t('revealLog.onlyCase', { caseNumber: fsi(row.caseNumber) })} size="compact" onClick={onOnlyCase} data-testid="reveals-row-only-case">
              <Funnel className="size-3.5" aria-hidden />
            </IconButton>
          )}
        </span>
      </td>
      <td className={TD}>
        <Ltr>{row.by}</Ltr>
      </td>
      <td className="px-2 py-1.5 align-top min-w-64 whitespace-pre-line" data-testid="reveals-row-reason">
        <bdi>{row.reason}</bdi>
      </td>
    </tr>
  )
}
