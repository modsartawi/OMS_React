import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { toast } from 'sonner'
import { PackageSearch, RefreshCw, RotateCcw, Search, Undo2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { NphiesAccessResult, NphiesUndispenseRequest } from '@/core/models/nphies'
import { NPHIES_ACCESS_KEY, nphiesAccessApi } from '@/core/nphies/api'
import { formatClock } from '@/core/nphies/format'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import { UNDISPENSE_LIST_KEY, undispenseApi } from './api'
import { UNDISPENSE_DEFAULT_COL_DEF, buildUndispenseColumns } from './list-columns'
import UndispenseDialog from './UndispenseDialog'
import {
  UNDISPENSE_STATES,
  buildUndispenseListParams,
  criteriaFromUrl,
  defaultUndispenseCriteria,
  isRetryable,
  listRefusalKey,
  queuedOutcome,
  retryRefusalKey,
  type UndispenseCriteria,
} from './undispense-rules'

/**
 * **Undispense** (ticket 898, BackOffice spec 3208) — support and the call center find the
 * undispenses that are pending or failed, retry a failed one, and undispense one authorization by
 * hand when its invoice is fully returned.
 *
 * 🚩 Two grants, one probe. The Nphies grant fences the page and the list (the `ScreenGate`, on the
 * area's ONE key); `canUndispense` on the same answer shows Retry and the manual Undispense.
 * Neither is the gate — the two POSTs' own filter is.
 *
 * No `refetchInterval`: the worker sends a request on its own; a manual Refresh with the load time
 * beside it lets the agent judge how old the answer is (the authorizations list's precedent).
 */
const nphiesAccessQuery = {
  queryKey: NPHIES_ACCESS_KEY,
  queryFn: () => nphiesAccessApi.access(),
  staleTime: Infinity,
  retry: false,
} as const

const canOpenNphies = (r: NphiesAccessResult | null | undefined) => r?.canOpenNphies === true

export default function UndispensePage() {
  const { t } = useTranslation('undispense')
  return (
    <ScreenGate query={nphiesAccessQuery} can={canOpenNphies} ns="undispense" title={t('title')} subtitle={t('subtitle')}>
      <UndispenseBody />
    </ScreenGate>
  )
}

function UndispenseBody() {
  const { t } = useTranslation('undispense')
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const linkedAuthId = (params.get('authId') ?? '').trim()

  const access = useQuery(nphiesAccessQuery)
  const canUndispense = access.data?.canUndispense === true

  // A link (751's "undispense it first") opens on that authorization in every state, and prefills
  // the manual box. Back/forward to another link follows it.
  const [criteria, setCriteria] = useState<UndispenseCriteria>(() => criteriaFromUrl(linkedAuthId))
  const [draft, setDraft] = useState<UndispenseCriteria>(criteria)
  const [manualId, setManualId] = useState(linkedAuthId)
  /** Applies criteria at once, with the panel's draft agreeing with what is in force. */
  const applyCriteria = useCallback((next: UndispenseCriteria) => {
    setDraft(next)
    setCriteria(next)
  }, [])
  useEffect(() => {
    applyCriteria(criteriaFromUrl(linkedAuthId))
    setManualId(linkedAuthId)
  }, [linkedAuthId, applyCriteria])

  const query = useMemo(() => buildUndispenseListParams(criteria), [criteria])
  const list = useQuery({
    queryKey: [...UNDISPENSE_LIST_KEY, query],
    queryFn: () => undispenseApi.list(query),
    placeholderData: keepPreviousData,
    // A refusal (a state the door does not know) is an answer, not an outage.
    retry: false,
    // 🚩 No `refetchInterval` — see the note at the top of the file.
  })

  const rereadList = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: UNDISPENSE_LIST_KEY }),
    [queryClient],
  )

  // ---- Retry -----------------------------------------------------------------
  const [retrying, setRetrying] = useState<string | null>(null)
  const retry = useMutation({
    mutationFn: (row: NphiesUndispenseRequest) => undispenseApi.retry(row.id),
    onSuccess: (_answer, row) => toast.success(t('retry.done'), { description: t('retry.doneDetail', { authId: fsi(row.authId) }) }),
    onError: (err) => {
      const key = retryRefusalKey(err)
      toast.error(t('retry.refused'), { description: key ? t(key) : apiErrorMessage(err, t('retry.refused')) })
    },
    onSettled: () => {
      setRetrying(null)
      // The answer is the server's: a refused retry (someone else retried it) is re-read too.
      rereadList()
    },
  })

  // 🚩 Stable for the grid's life — read through a ref, never through the closure (see list-columns).
  const live = useRef({ canUndispense, retrying, retry })
  live.current = { canUndispense, retrying, retry }
  const canRetry = useCallback((row: NphiesUndispenseRequest) => isRetryable(live.current.canUndispense, row), [])
  const onRetry = useCallback((row: NphiesUndispenseRequest) => {
    const { retrying: inFlight, retry: act } = live.current
    if (inFlight) return
    setRetrying(row.id)
    act.mutate(row)
  }, [])
  const columns = useMemo(() => buildUndispenseColumns(t, canRetry, onRetry), [t, canRetry, onRetry])

  // ---- the manual undispense ---------------------------------------------------
  /** The authorization the open dialog is about, snapshotted at open. `null` = closed. */
  const [dialogAuthId, setDialogAuthId] = useState<string | null>(null)
  const undispense = useMutation({
    mutationFn: ({ authId, note }: { authId: string; note: string }) => undispenseApi.undispense(authId, note),
    onSuccess: (answer, { authId }) => {
      setDialogAuthId(null)
      const outcome = queuedOutcome(answer)
      const description = t(`manual.outcome.${outcome}Detail`, { authId: fsi(authId) })
      if (outcome === 'queued') toast.success(t('manual.outcome.queued'), { description })
      else toast.info(t(`manual.outcome.${outcome}`), { description })
      // Show the request it answered: that authorization, in every state.
      applyCriteria(criteriaFromUrl(authId))
      rereadList()
    },
  })

  const onManual = (e: FormEvent) => {
    e.preventDefault()
    const id = manualId.trim()
    if (id === '') return
    undispense.reset()
    setDialogAuthId(id)
  }

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setCriteria(draft)
  }
  const onReset = () => {
    applyCriteria(defaultUndispenseCriteria())
  }
  const toggleState = (state: UndispenseCriteria['states'][number]) =>
    setDraft((d) => ({
      ...d,
      states: d.states.includes(state) ? d.states.filter((s) => s !== state) : [...d.states, state],
    }))

  const rows = list.data?.items ?? []
  const refreshing = list.isFetching && list.data !== undefined
  const loadedAt = formatClock(list.dataUpdatedAt)
  const listRefusal = list.isError ? listRefusalKey(list.error) : null
  const retryingRow = retrying ? rows.find((r) => r.id === retrying) : undefined

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {canUndispense && (
        <form
          onSubmit={onManual}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3"
          data-testid="undispense-manual"
        >
          <Field label={t('manual.label')} hint={t('manual.hint')} className="w-80 max-w-full">
            <Input
              type="search"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder={t('manual.placeholder')}
              dir="ltr"
              className="font-mono"
              data-testid="undispense-auth-id"
            />
          </Field>
          <Button type="submit" variant="danger" disabled={manualId.trim() === ''} data-testid="undispense-open">
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {t('manual.open')}
          </Button>
        </form>
      )}

      <form
        onSubmit={onSearch}
        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        data-testid="undispense-filters"
      >
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('filters.state')}>
          <span className="text-xs font-medium text-muted-foreground">{t('filters.state')}</span>
          {UNDISPENSE_STATES.map((state) => (
            <Chip
              key={state}
              on={draft.states.includes(state)}
              onClick={() => toggleState(state)}
              data-testid={`undispense-state-${state}`}
            >
              {t(`state.${state}`)}
            </Chip>
          ))}
          {draft.states.length === 0 && <span className="text-xs text-muted-foreground">{t('filters.allStates')}</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('filters.store')}>
            <Input
              type="text"
              value={draft.store}
              onChange={(e) => setDraft((d) => ({ ...d, store: e.target.value }))}
              dir="ltr"
              className="w-28"
              data-testid="undispense-filter-store"
            />
          </Field>
          <Field label={t('filters.from')}>
            <Input
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              className="w-40"
              data-testid="undispense-filter-from"
            />
          </Field>
          <Field label={t('filters.to')}>
            <Input
              type="date"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              className="w-40"
              data-testid="undispense-filter-to"
            />
          </Field>
          <Field label={t('filters.authId')}>
            <Input
              type="text"
              value={draft.authId}
              onChange={(e) => setDraft((d) => ({ ...d, authId: e.target.value }))}
              dir="ltr"
              className="w-56 font-mono"
              data-testid="undispense-filter-auth"
            />
          </Field>
          <Button type="submit" variant="primary" data-testid="undispense-search">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button type="button" variant="outlined" onClick={onReset} data-testid="undispense-reset">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.reset')}
          </Button>
        </div>
      </form>

      {list.isError && (
        <ErrorBanner
          message={listRefusal ? t(listRefusal) : apiErrorMessage(list.error, t('list.failed'))}
          className="p-3"
        />
      )}

      {retrying && (
        <div role="status" className="rounded-md border border-border/60 bg-muted/40 p-2 text-xs">
          {t('retry.inFlight', { authId: fsi(retryingRow?.authId ?? '') })}
        </div>
      )}

      {list.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label={t('list.loading')}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : list.isError ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="tabular-nums text-muted-foreground" data-testid="undispense-count">
              {t('list.count', { count: rows.length, formatted: fsi(rows.length.toLocaleString()) })}
            </span>
            <span className="flex items-center gap-2">
              {loadedAt && (
                <span className="tabular-nums text-muted-foreground">{t('list.loadedAt', { at: fsi(loadedAt) })}</span>
              )}
              <Button type="button" variant="outlined" onClick={() => void list.refetch()} disabled={refreshing}>
                <RefreshCw className={'h-3.5 w-3.5 ' + (refreshing ? 'animate-spin' : '')} aria-hidden />
                {t('list.refresh')}
              </Button>
            </span>
          </div>

          {list.data?.truncated && (
            <p className="text-xs text-attention-800" role="status" data-testid="undispense-truncated">
              {t('list.truncated')}
            </p>
          )}

          {rows.length === 0 ? (
            <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center" data-testid="undispense-empty">
              <PackageSearch className="h-8 w-8 text-muted-foreground" aria-hidden />
              <div className="text-base font-semibold tracking-tight">{t('list.empty.title')}</div>
              <p className="text-sm text-muted-foreground">{t('list.empty.hint')}</p>
            </div>
          ) : (
            <div
              className={'min-h-[24rem] flex-1 transition-opacity ' + (refreshing ? 'opacity-50' : '')}
              aria-busy={refreshing}
              data-testid="undispense-grid"
            >
              <AgGridReact<NphiesUndispenseRequest>
                theme={omsGridTheme}
                rowData={rows}
                columnDefs={columns}
                defaultColDef={UNDISPENSE_DEFAULT_COL_DEF}
                getRowId={(p) => p.data.id}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                animateRows={false}
              />
            </div>
          )}
        </>
      )}

      <UndispenseDialog
        authId={dialogAuthId}
        busy={undispense.isPending}
        error={undispense.error}
        onClose={() => {
          // Not while it is in flight: a re-opened dialog could send a second request.
          if (undispense.isPending) return
          setDialogAuthId(null)
          undispense.reset()
        }}
        onConfirm={(note) => dialogAuthId && undispense.mutate({ authId: dialogAuthId, note })}
      />
    </div>
  )
}
