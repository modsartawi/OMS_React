import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { ArrowRightLeft, Loader2, Lock, RotateCcw, Unlock } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { StoreCountRow, StoreStage } from '@/core/models/store-stage'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { canCloseStoreCount, canMoveStoreStage, canOpenStoreStages, storeStageAccessQuery } from './access'
import { storeStageApi } from './api'
import { STAGE_SEVERITY, moverLabel, stageColumns, stageLabel } from './columns'
import {
  STAGES,
  STAGES_DEFAULTS,
  WHY_MAX,
  canAskCountClosed,
  countOf,
  countState,
  moveCommit,
  personMovesFrom,
  releaseCommit,
  stageRow,
  stagesFiltersFromParams,
  stagesFiltersToParams,
  stagesShown,
  type StageRow,
  type StagesFilters,
} from './stages'

const LIST_KEY = ['oms', 'store-stages', 'list'] as const
const movesKey = (store: string) => ['oms', 'store-stages', 'moves', store] as const
const COUNTS_KEY = ['oms', 'store-stages', 'counts'] as const
const releasesKey = (store: string) => ['oms', 'store-stages', 'releases', store] as const

/**
 * Store stages (BackOffice ticket 3899, spec 3849 user stories 49 and 54): each store's stage at Stock Visibility and its
 * last move; a store opens its log (who moved it, why, when) and, for a holder of the move grant, the move form. SIS.Stock
 * 064 decides which moves are allowed and logs each one; the person is the signed-in user.
 *
 * Behind `canOpenStoreStages` on `StoreStage/Access` (`BackOfficeScreen[StoreStage, 03]`), failing closed; the move form on
 * `canMove` (`BackOfficeScreen[StoreStage, 02]`), which the server checks again.
 */
export default function StoreStagesPage() {
  const { t } = useTranslation('store-stages')
  return (
    <ScreenGate
      query={storeStageAccessQuery()}
      can={canOpenStoreStages}
      ns="store-stages"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <Stages />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  resizable: true,
  sortable: true,
  suppressHeaderMenuButton: true,
}

function Stages() {
  const { t } = useTranslation('store-stages')
  const { query: filters, update, changedFromOutside } = useUrlQuery(stagesFiltersFromParams, stagesFiltersToParams)
  const [storeDraft, setStoreDraft] = useState(filters.store)
  useEffect(() => {
    if (changedFromOutside()) setStoreDraft(filters.store)
  }, [filters, changedFromOutside])
  const patch = (p: Partial<StagesFilters>) => update((prev) => ({ ...prev, ...p }))

  const access = useQuery(storeStageAccessQuery())
  const read = useQuery({ queryKey: LIST_KEY, queryFn: () => storeStageApi.list(), retry: false })
  const rows = useMemo(() => stagesShown(read.data ?? [], filters).map(stageRow), [read.data, filters])
  const columns = useMemo(() => stageColumns(t) as ColDef[], [t])
  const open = filters.open ? ((read.data ?? []).find((s) => s.store === filters.open) ?? null) : null
  // Ticket 3898: the stores under count (StoreLastInventory) and the count's closing mark.
  const counts = useQuery({ queryKey: COUNTS_KEY, queryFn: () => storeStageApi.counts(), retry: false })

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          patch({ store: storeDraft.trim().toUpperCase() })
        }}
        data-stage-filters=""
      >
        <Field label={t('filters.store')}>
          <Input
            type="text"
            value={storeDraft}
            onChange={(e) => setStoreDraft(e.target.value)}
            placeholder={t('filters.storePlaceholder')}
            className="w-40"
            data-stage-filter="store"
          />
        </Field>
        <Field label={t('filters.stage')}>
          <Select
            value={filters.stage}
            onChange={(e) => patch({ stage: e.target.value as StagesFilters['stage'] })}
            className="w-40"
            data-stage-filter="stage"
          >
            <option value="">{t('filters.anyStage')}</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {stageLabel(t, s)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" data-stage-apply="">
          {t('filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setStoreDraft('')
            update(() => ({ ...STAGES_DEFAULTS }))
          }}
          data-stage-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.reset')}
        </Button>
      </form>

      {read.isError && (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(read.error, t('list.failed'))} />
      )}

      <div className="relative h-[calc(100vh-18rem)] min-h-96" data-stage-grid="">
        <AgGridReact<StageRow>
          theme={omsGridTheme}
          rowData={read.isError ? [] : rows}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          tooltipShowDelay={400}
          animateRows={false}
          loading={read.isFetching && !read.data}
          noRowsOverlayComponent={NoRows}
          suppressNoRowsOverlay={read.isError}
          onRowClicked={({ data }) => {
            if (data) patch({ open: data.store })
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-stage-note="">
        {t('note')}
      </p>

      {open && (
        <StoreSheet
          stage={open}
          canMove={canMoveStoreStage(access.data)}
          canCloseCount={canCloseStoreCount(access.data)}
          count={countOf(counts.data ?? [], open.store)}
          countFailed={counts.isError}
          onClose={() => patch({ open: '' })}
        />
      )}
    </div>
  )
}

function StoreSheet({
  stage,
  canMove,
  canCloseCount,
  count,
  countFailed,
  onClose,
}: {
  stage: StoreStage
  canMove: boolean
  canCloseCount: boolean
  count: StoreCountRow | null
  countFailed: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('store-stages')
  const log = useQuery({ queryKey: movesKey(stage.store), queryFn: () => storeStageApi.moves(stage.store), retry: false })
  const moves = log.data ?? []
  return (
    <SideSheet onClose={onClose} width="w-[44rem]" aria-labelledby="store-stage-title" data-stage-sheet={stage.store}>
      <SideSheetHeader
        titleId="store-stage-title"
        eyebrow={t('sheet.eyebrow')}
        title={<Ltr>{stage.store}</Ltr>}
        hint={<StatusBadge sev={STAGE_SEVERITY[stage.stage] ?? 'mute'}>{stageLabel(t, stage.stage)}</StatusBadge>}
        closeLabel={t('sheet.close')}
        onClose={onClose}
      />
      <div className={SHEET_BODY}>
        <CountSection store={stage.store} count={count} failed={countFailed} canClose={canCloseCount} canRelease={canMove} />
        {canMove && <MoveForm stage={stage} />}
        <section className="flex flex-col gap-2" data-stage-log="">
          <h3 className="text-sm font-semibold">{t('log.title')}</h3>
          {log.isError && (
            <ErrorBanner className="p-2.5" title={t('log.failedTitle')} message={apiErrorMessage(log.error, t('log.failed'))} />
          )}
          {log.isPending ? (
            <p className="text-sm text-muted-foreground">{t('log.loading')}</p>
          ) : moves.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('log.empty')}</p>
          ) : (
            <table className="w-full text-[0.8125rem]">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t('log.movedAt')}</th>
                  <th className={TH}>{t('log.move')}</th>
                  <th className={TH}>{t('log.mover')}</th>
                  <th className={TH}>{t('log.who')}</th>
                  <th className={TH}>{t('log.why')}</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m, i) => (
                  <tr key={`${m.movedAt}-${i}`} className="border-t border-border/40" data-stage-log-row="">
                    <td className={`${TD} tabular-nums`}>
                      <Ltr>{formatDateTime(m.movedAt)}</Ltr>
                    </td>
                    <td className={TD}>
                      {t('log.fromTo', { from: fsi(stageLabel(t, m.from)), to: fsi(stageLabel(t, m.to)) })}
                    </td>
                    <td className={TD}>{moverLabel(t, m.mover)}</td>
                    <td className={`${TD} font-mono text-[12px]`}>
                      <Ltr>{m.who}</Ltr>
                    </td>
                    <td className={`${TD} whitespace-normal`}>{m.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </SideSheet>
  )
}

function MoveForm({ stage }: { stage: StoreStage }) {
  const { t } = useTranslation('store-stages')
  const queryClient = useQueryClient()
  const [to, setTo] = useState('')
  const [why, setWhy] = useState('')
  const inFlight = useRef(false)
  const targets = personMovesFrom(stage.stage)

  const move = useMutation({
    mutationFn: () => storeStageApi.move(stage.store, { stage: to, why: why.trim() }),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: (moved) => {
      notify.success(
        t('move.done.title'),
        t('move.done.detail', { store: fsi(stage.store), stage: fsi(stageLabel(t, moved?.stage ?? to)) }),
      )
      setTo('')
      setWhy('')
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: movesKey(stage.store) })
    },
  })
  const commit = moveCommit({ from: stage.stage, to, why, pending: move.isPending })

  if (targets.length === 0)
    return (
      <p
        className="rounded-md border border-border/60 bg-card/40 p-2.5 text-[0.8125rem] text-muted-foreground"
        data-stage-no-move=""
      >
        {t('move.noneFromShadow')}
      </p>
    )

  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (inFlight.current || !commit.canCommit) return
        inFlight.current = true
        move.mutate()
      }}
      data-stage-move=""
    >
      <h3 className="text-sm font-semibold">{t('move.title')}</h3>
      <Field id="store-stage-to" label={t('move.to')}>
        <Select value={to} onChange={(e) => setTo(e.target.value)} disabled={move.isPending} className="w-full" required>
          <option value="">{t('move.toPlaceholder')}</option>
          {targets.map((s) => (
            <option key={s} value={s}>
              {stageLabel(t, s)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="store-stage-why" label={t('move.why')}>
        <Textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          disabled={move.isPending}
          rows={3}
          placeholder={t('move.whyPlaceholder')}
          className="w-full"
          required
        />
      </Field>
      {commit.tooLong && (
        <p className="text-xs text-attention-800" data-stage-why-too-long="">
          {t('move.tooLong', { max: fsi(String(WHY_MAX)) })}
        </p>
      )}
      {move.isError && (
        <ErrorBanner className="p-2.5" title={t('move.refusedTitle')} message={apiErrorMessage(move.error, t('move.failed'))} />
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!commit.canCommit} data-stage-move-commit="">
          {move.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
          )}
          {move.isPending ? t('move.committing') : t('move.commit')}
        </Button>
      </div>
    </form>
  )
}

/**
 * Ticket 3898 - the store's count: its StoreLastInventory row and the count's closing mark. "Count closed" (behind
 * `BackOfficeScreen[StoreCountClose, 02]`) holds every sale and DRS post of the store, moves it to Seeding and asks its seed;
 * the row is deleted when the seed writes Seeded. A refused seed shows in SIS.Stock's words and the store stays held; then
 * a holder of the stage's move grant may release it by hand, with a reason, and the release is logged.
 */
function CountSection({
  store,
  count,
  failed,
  canClose,
  canRelease,
}: {
  store: string
  count: StoreCountRow | null
  failed: boolean
  canClose: boolean
  canRelease: boolean
}) {
  const { t } = useTranslation('store-stages')
  const queryClient = useQueryClient()
  const [refusal, setRefusal] = useState<string | null>(null)
  const [why, setWhy] = useState('')
  const inFlight = useRef(false)
  const state = countState(count)
  const releases = useQuery({ queryKey: releasesKey(store), queryFn: () => storeStageApi.releases(store), retry: false })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    void queryClient.invalidateQueries({ queryKey: COUNTS_KEY })
    void queryClient.invalidateQueries({ queryKey: movesKey(store) })
    void queryClient.invalidateQueries({ queryKey: releasesKey(store) })
  }

  const close = useMutation({
    mutationFn: () => storeStageApi.countClosed(store),
    onSettled: () => {
      inFlight.current = false
      refresh()
    },
    onSuccess: (result) => {
      setRefusal(result?.seedRefusal ?? null)
      if (result?.released) notify.success(t('count.released.title'), t('count.released.detail', { store: fsi(store) }))
    },
  })

  const release = useMutation({
    mutationFn: () => storeStageApi.release(store, { why: why.trim() }),
    onSettled: () => {
      inFlight.current = false
      refresh()
    },
    onSuccess: () => {
      notify.success(t('count.release.done.title'), t('count.release.done.detail', { store: fsi(store) }))
      setWhy('')
      setRefusal(null)
    },
  })
  const releasable = releaseCommit({ row: count, why, pending: release.isPending })
  const releaseRows = releases.data ?? []

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-card/40 p-3" data-stage-count={state}>
      <h3 className="text-sm font-semibold">{t('count.title')}</h3>
      {failed && <ErrorBanner className="p-2.5" title={t('count.readFailed')} message="" />}
      {state === 'none' ? (
        <p className="text-[0.8125rem] text-muted-foreground">{t('count.none')}</p>
      ) : (
        <>
          <p className="text-[0.8125rem]">
            {t('count.day')}:{' '}
            <Ltr>{formatDay(count!.inventoryDate)}</Ltr>
          </p>
          <p className="text-[0.8125rem] text-muted-foreground" data-stage-count-state="">
            {state === 'open'
              ? t('count.open')
              : t('count.closed', { who: fsi(count!.countClosedBy), at: fsi(formatDateTime(count!.countClosedAt)) })}
          </p>
        </>
      )}

      {canAskCountClosed(count, canClose, close.isPending) && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{t('count.closeHint')}</p>
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={close.isPending}
              onClick={() => {
                if (inFlight.current) return
                inFlight.current = true
                close.mutate()
              }}
              data-stage-count-close=""
            >
              {close.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
              {close.isPending ? t('count.closing') : state === 'closed' ? t('count.closeAgain') : t('count.close')}
            </Button>
          </div>
        </div>
      )}
      {close.isError && (
        <ErrorBanner className="p-2.5" title={t('count.failedTitle')} message={apiErrorMessage(close.error, t('count.failed'))} />
      )}
      {refusal && <ErrorBanner className="p-2.5" title={t('count.seedRefusedTitle')} message={refusal} />}

      {state === 'closed' && canRelease && (
        <form
          className="flex flex-col gap-2 border-t border-border/40 pt-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (inFlight.current || !releasable.canCommit) return
            inFlight.current = true
            release.mutate()
          }}
          data-stage-count-release=""
        >
          <h4 className="text-[0.8125rem] font-semibold">{t('count.release.title')}</h4>
          <p className="text-xs text-muted-foreground">{t('count.release.hint')}</p>
          <Field id="store-count-why" label={t('count.release.why')}>
            <Textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              disabled={release.isPending}
              rows={2}
              placeholder={t('count.release.whyPlaceholder')}
              className="w-full"
              required
            />
          </Field>
          {releasable.tooLong && (
            <p className="text-xs text-attention-800">{t('move.tooLong', { max: fsi(String(WHY_MAX)) })}</p>
          )}
          {release.isError && (
            <ErrorBanner
              className="p-2.5"
              title={t('count.release.refusedTitle')}
              message={apiErrorMessage(release.error, t('count.release.failed'))}
            />
          )}
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={!releasable.canCommit} data-stage-count-release-commit="">
              {release.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Unlock className="h-3.5 w-3.5" aria-hidden />}
              {release.isPending ? t('count.release.committing') : t('count.release.commit')}
            </Button>
          </div>
        </form>
      )}

      {releases.isError && <ErrorBanner className="p-2.5" title={t('count.releases.failed')} message="" />}
      {releaseRows.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border/40 pt-2.5" data-stage-count-releases="">
          <h4 className="text-[0.8125rem] font-semibold">{t('count.releases.title')}</h4>
          <table className="w-full text-[0.8125rem]">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className={TH}>{t('count.releases.releasedAt')}</th>
                <th className={TH}>{t('count.releases.kind')}</th>
                <th className={TH}>{t('count.releases.who')}</th>
                <th className={TH}>{t('count.releases.why')}</th>
              </tr>
            </thead>
            <tbody>
              {releaseRows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className={`${TD} tabular-nums`}>
                    <Ltr>{formatDateTime(r.releasedAt)}</Ltr>
                  </td>
                  <td className={TD}>{t(`count.kind.${r.kind}`, { defaultValue: r.kind })}</td>
                  <td className={`${TD} font-mono text-[12px]`}>
                    <Ltr>{r.releasedBy}</Ltr>
                  </td>
                  <td className={`${TD} whitespace-normal`}>{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function NoRows() {
  const { t } = useTranslation('store-stages')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
