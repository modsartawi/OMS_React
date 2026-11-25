import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { ArrowRightLeft, Ban, ClipboardList, Loader2, Lock, RefreshCw, RotateCcw, Unlock } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { STAGES, type StoreCountRow, type StoreGate, type StoreGates, type StoreStage } from '@/core/models/store-stage'
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
import { usePermissions } from '@/core/permissions'
import { canBlockStoreEarly, canCloseStoreCount, canMoveStoreStage, canOpenStoreStages, canStartStoreCount } from './access'
import { storeStageApi } from './api'
import { STAGE_SEVERITY, confirmationLabel, gateLabel, moverLabel, stageColumns, stageLabel } from './columns'
import {
  STAGES_DEFAULTS,
  WHY_MAX,
  blockingCheck,
  figureLines,
  gatesApart,
  moveRequest,
  canAskCountClosed,
  cancelCommit,
  countOf,
  countState,
  localDay,
  moveCommit,
  personMovesFrom,
  releaseCommit,
  seedView,
  stageRow,
  startCommit,
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
const seedKey = (store: string) => ['oms', 'store-stages', 'seed', store] as const
const gatesKey = (store: string) => ['oms', 'store-stages', 'gates', store] as const
/** How often the Count section reads a running seed. */
const SEED_POLL_MS = 4000

/**
 * Store stages (BackOffice ticket 3899, spec 3849 user stories 49 and 54): each store's stage at Stock Visibility and its
 * last move; a store opens its log (who moved it, why, when) and, for a holder of the move grant, the move form. SIS.Stock
 * 064 decides which moves are allowed and logs each one; the person is the signed-in user.
 *
 * Behind `canOpenStoreStages` on `BackOfficeScreen[StoreStage, 03]` off the one permissions answer (oms 914), failing closed; the move form on
 * `canMove` (`BackOfficeScreen[StoreStage, 02]`), which the server checks again.
 */
export default function StoreStagesPage() {
  const { t } = useTranslation('store-stages')
  return (
    <ScreenGate
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

  const permissions = usePermissions()
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
          canMove={canMoveStoreStage(permissions)}
          canBlockEarly={canBlockStoreEarly(permissions)}
          canCloseCount={canCloseStoreCount(permissions)}
          canStartCount={canStartStoreCount(permissions)}
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
  canBlockEarly,
  canCloseCount,
  canStartCount,
  count,
  countFailed,
  onClose,
}: {
  stage: StoreStage
  canMove: boolean
  canBlockEarly: boolean
  canCloseCount: boolean
  canStartCount: boolean
  count: StoreCountRow | null
  countFailed: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('store-stages')
  const log = useQuery({ queryKey: movesKey(stage.store), queryFn: () => storeStageApi.moves(stage.store), retry: false })
  const moves = log.data ?? []
  // Ticket 4261: the gates toward Blocking, measured afresh by Stock Visibility, for a store that is or may become Blocking.
  const gatesShown = stage.stage === 'Seeded' || stage.stage === 'Blocking'
  const gates = useQuery({
    queryKey: gatesKey(stage.store),
    queryFn: () => storeStageApi.gates(stage.store),
    enabled: gatesShown,
    retry: false,
    staleTime: 60_000,
  })
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
        <CountSection
          store={stage.store}
          count={count}
          failed={countFailed}
          canStart={canStartCount}
          canClose={canCloseCount}
          canRelease={canMove}
        />
        {gatesShown && (
          <GatesSection
            gates={gates.data ?? null}
            pending={gates.isPending}
            fetching={gates.isFetching}
            error={gates.isError ? gates.error : null}
            onRefresh={() => void gates.refetch()}
          />
        )}
        {canMove && (
          <MoveForm
            stage={stage}
            gates={gates.data ?? null}
            gatesPending={gatesShown && gates.isPending}
            canBlockEarly={canBlockEarly}
          />
        )}
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

function MoveForm({
  stage,
  gates,
  gatesPending,
  canBlockEarly,
}: {
  stage: StoreStage
  gates: StoreGates | null
  gatesPending: boolean
  canBlockEarly: boolean
}) {
  const { t } = useTranslation('store-stages')
  const queryClient = useQueryClient()
  const [to, setTo] = useState('')
  const [why, setWhy] = useState('')
  // Ticket 4261: the confirmations given and the failing fleet gates waived, by name, on a move to Blocking.
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [waived, setWaived] = useState<string[]>([])
  const inFlight = useRef(false)
  const targets = personMovesFrom(stage.stage)
  const blocking = blockingCheck({ gates, confirmed, waived, canWaive: canBlockEarly })

  const move = useMutation({
    mutationFn: () =>
      storeStageApi.move(stage.store, moveRequest({ to, why, gates, confirmed, waived, canWaive: canBlockEarly })),
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
      setConfirmed([])
      setWaived([])
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: movesKey(stage.store) })
      void queryClient.invalidateQueries({ queryKey: gatesKey(stage.store) })
    },
  })
  const commit = moveCommit({ from: stage.stage, to, why, pending: move.isPending, blocking })

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
      {to === 'Blocking' && (
        <BlockingChecks
          gates={gates}
          gatesPending={gatesPending}
          check={blocking}
          confirmed={confirmed}
          waived={waived}
          canWaive={canBlockEarly}
          disabled={move.isPending}
          onConfirm={(name, on) => setConfirmed((c) => toggled(c, name, on))}
          onWaive={(gate, on) => setWaived((w) => toggled(w, gate, on))}
        />
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

const toggled = (names: string[], name: string, on: boolean): string[] =>
  on ? (names.includes(name) ? names : [...names, name]) : names.filter((n) => n !== name)

/**
 * Ticket 4261 (ADR 0145, SIS.Stock 081): the store's gates toward Blocking as Stock Visibility measures them now — the
 * store's own proof (always enforced) and the fleet's gates (a failing one may be waived on the move), shown apart. Each
 * figure is the server's text, one failing day or feed per line; the would-be refusals name each day split GS1 scan /
 * entered batch / determined.
 */
function GatesSection({
  gates,
  pending,
  fetching,
  error,
  onRefresh,
}: {
  gates: StoreGates | null
  pending: boolean
  fetching: boolean
  error: unknown
  onRefresh: () => void
}) {
  const { t } = useTranslation('store-stages')
  const apart = gatesApart(gates)
  return (
    <section
      className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-card/40 p-3"
      data-stage-gates={gates ? (gates.hold ? 'hold' : 'notYet') : pending ? 'reading' : 'none'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('gates.title')}</h3>
        <Button variant="outlined" onClick={onRefresh} disabled={fetching} data-stage-gates-refresh="">
          {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          {t('gates.refresh')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('gates.hint')}</p>
      {error != null && (
        <ErrorBanner className="p-2.5" title={t('gates.failedTitle')} message={apiErrorMessage(error, t('gates.failed'))} />
      )}
      {pending && error == null ? (
        <p className="text-sm text-muted-foreground">{t('gates.loading')}</p>
      ) : (
        gates && (
          <>
            <span className="inline-flex flex-wrap items-center gap-2 text-[0.8125rem]">
              <span className="text-muted-foreground">
                {t('gates.over', { from: fsi(formatDay(gates.from)), to: fsi(formatDay(gates.to)) })}
              </span>
              <StatusBadge sev={gates.hold ? 'ok' : 'warn'}>{t(gates.hold ? 'gates.allHold' : 'gates.notAllHold')}</StatusBadge>
            </span>
            <GateList title={t('gates.store')} gates={apart.store} scope="store" />
            <GateList title={t('gates.fleet')} gates={apart.fleet} scope="fleet" />
          </>
        )
      )}
    </section>
  )
}

function GateList({ title, gates, scope }: { title: string; gates: StoreGate[]; scope: 'store' | 'fleet' }) {
  const { t } = useTranslation('store-stages')
  if (gates.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5" data-stage-gates-scope={scope}>
      <h4 className="text-[0.8125rem] font-semibold">{title}</h4>
      <ul className="flex flex-col gap-1.5">
        {gates.map((g) => (
          <li key={g.gate} className="flex flex-col gap-0.5 text-[0.8125rem]" data-gate={g.gate} data-gate-holds={g.holds}>
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusBadge sev={g.holds ? 'ok' : 'bad'}>{t(g.holds ? 'gates.holds' : 'gates.doesNotHold')}</StatusBadge>
              <span className="font-medium">{gateLabel(t, g.gate)}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                <Ltr>{g.gate}</Ltr>
              </span>
            </span>
            {figureLines(g.figure).map((line, i) => (
              <bdi key={i} dir="ltr" className="whitespace-normal break-words text-xs text-muted-foreground" data-gate-figure-line="">
                {line}
              </bdi>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Ticket 4261: what a move to Blocking names — each confirmation the gates answer asks for, ticked by name, and a waive tick
 * beside each failing fleet gate for a holder of `StoreBlockEarly:02` only. The store's own proof is never waived: when it
 * fails the move is not offered, and says why.
 */
function BlockingChecks({
  gates,
  gatesPending,
  check,
  confirmed,
  waived,
  canWaive,
  disabled,
  onConfirm,
  onWaive,
}: {
  gates: StoreGates | null
  gatesPending: boolean
  check: ReturnType<typeof blockingCheck>
  confirmed: string[]
  waived: string[]
  canWaive: boolean
  disabled: boolean
  onConfirm: (name: string, on: boolean) => void
  onWaive: (gate: string, on: boolean) => void
}) {
  const { t } = useTranslation('store-stages')
  const failingFleet = gatesApart(gates).fleet.filter((g) => !g.holds)
  return (
    <div className="flex flex-col gap-2.5 border-t border-border/40 pt-2.5" data-stage-blocking="">
      <h4 className="text-[0.8125rem] font-semibold">{t('move.blocking.title')}</h4>
      {!gates ? (
        <p className="text-xs text-muted-foreground">{gatesPending ? t('gates.loading') : t('move.blocking.needsGates')}</p>
      ) : (
        <>
          {check.storeFailing.length > 0 && (
            <p className="text-xs text-attention-800" data-stage-blocking-store-failing="">
              {t('move.blocking.storeFailing', { gates: fsi(check.storeFailing.map((g) => gateLabel(t, g)).join(', ')) })}
            </p>
          )}
          {check.toConfirm.length > 0 && (
            <fieldset className="flex flex-col gap-1.5" data-stage-blocking-confirm="">
              <legend className="mb-1 text-xs text-muted-foreground">{t('move.blocking.confirmHint')}</legend>
              {check.toConfirm.map((name) => (
                <label key={name} className="inline-flex items-start gap-2 text-[0.8125rem]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={confirmed.includes(name)}
                    disabled={disabled}
                    onChange={(e) => onConfirm(name, e.target.checked)}
                    data-stage-confirm={name}
                  />
                  <span className="flex flex-col">
                    <span>{confirmationLabel(t, name)}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      <Ltr>{name}</Ltr>
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {failingFleet.length > 0 && (
            <fieldset className="flex flex-col gap-1.5" data-stage-blocking-waive="">
              <legend className="mb-1 text-xs text-muted-foreground">{t('move.blocking.waiveHint')}</legend>
              {failingFleet.map((g) => (
                <div key={g.gate} className="flex flex-col gap-0.5 text-[0.8125rem]" data-stage-waive-gate={g.gate}>
                  {canWaive ? (
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={waived.includes(g.gate)}
                        disabled={disabled}
                        onChange={(e) => onWaive(g.gate, e.target.checked)}
                        data-stage-waive={g.gate}
                      />
                      <span className="font-medium">{t('move.blocking.waive')}</span>
                      <span>{gateLabel(t, g.gate)}</span>
                    </label>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <StatusBadge sev="bad">{gateLabel(t, g.gate)}</StatusBadge>
                      <span className="text-xs text-muted-foreground">{t('move.blocking.noWaiveGrant')}</span>
                    </span>
                  )}
                  {figureLines(g.figure).map((line, i) => (
                    <bdi key={i} dir="ltr" className="whitespace-normal break-words text-xs text-muted-foreground" data-gate-figure-line="">
                      {line}
                    </bdi>
                  ))}
                </div>
              ))}
            </fieldset>
          )}
        </>
      )}
    </div>
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
  canStart,
  canClose,
  canRelease,
}: {
  store: string
  count: StoreCountRow | null
  failed: boolean
  canStart: boolean
  canClose: boolean
  canRelease: boolean
}) {
  const { t } = useTranslation('store-stages')
  const queryClient = useQueryClient()
  const [refusal, setRefusal] = useState<string | null>(null)
  // The count was opened again because its seed found sales still on their way to SAP: the seed's own words.
  const [reopened, setReopened] = useState<string | null>(null)
  const [why, setWhy] = useState('')
  const inFlight = useRef(false)
  const state = countState(count)
  // The seed runs on its own at Stock Visibility and may outlast "count closed": while the count is closed its run is
  // read, every few seconds while it runs. The read that finds it ended settles the count on the server.
  const seed = useQuery({
    queryKey: seedKey(store),
    queryFn: () => storeStageApi.seedStatus(store),
    enabled: state === 'closed',
    refetchInterval: (query) => (query.state.data?.ofThisClosing && query.state.data.state === 'Running' ? SEED_POLL_MS : false),
    retry: false,
  })
  const seedShown = seedView(state === 'closed' ? seed.data : null)
  const releases = useQuery({ queryKey: releasesKey(store), queryFn: () => storeStageApi.releases(store), retry: false })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    void queryClient.invalidateQueries({ queryKey: COUNTS_KEY })
    void queryClient.invalidateQueries({ queryKey: movesKey(store) })
    void queryClient.invalidateQueries({ queryKey: releasesKey(store) })
  }

  // What a read of the seed's run settled: released (Seeded) or opened again (sales still on their way to SAP).
  const settledAt = seed.data && (seed.data.released || seed.data.reopened) ? seed.dataUpdatedAt : 0
  useEffect(() => {
    if (!settledAt || !seed.data) return
    if (seed.data.released) notify.success(t('count.released.title'), t('count.released.detail', { store: fsi(store) }))
    if (seed.data.reopened) {
      setReopened(seed.data.reason)
      setRefusal(null)
    }
    refresh()
    // Only when a read settles the count: `refresh` and `t` are stable enough for this one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledAt])

  const close = useMutation({
    mutationFn: () => storeStageApi.countClosed(store),
    onMutate: () => {
      setRefusal(null)
      setReopened(null)
    },
    onSettled: () => {
      inFlight.current = false
      refresh()
      void queryClient.invalidateQueries({ queryKey: seedKey(store) })
    },
    onSuccess: (result) => {
      if (result?.reopened) setReopened(result.seedRefusal ?? '')
      else setRefusal(result?.seedRefusal ?? null)
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

  // BackOffice 2026-11-23: "Start count" and "Cancel count" (the desktop Block / Unblock), behind StoreCountStart:02.
  const today = localDay(new Date())
  const [day, setDay] = useState(today)
  const [cancelWhy, setCancelWhy] = useState('')
  const start = useMutation({
    mutationFn: () => storeStageApi.countStarted(store, { countDay: day }),
    onSettled: () => {
      inFlight.current = false
      refresh()
    },
    onSuccess: () => {
      notify.success(t('count.start.done.title'), t('count.start.done.detail', { store: fsi(store), day: fsi(formatDay(day)) }))
      setReopened(null)
      setRefusal(null)
    },
  })
  const startable = startCommit({ row: count, day, today, pending: start.isPending })
  const cancel = useMutation({
    mutationFn: () => storeStageApi.countCancelled(store, { why: cancelWhy.trim() }),
    onSettled: () => {
      inFlight.current = false
      refresh()
    },
    onSuccess: () => {
      notify.success(t('count.cancel.done.title'), t('count.cancel.done.detail', { store: fsi(store) }))
      setCancelWhy('')
      setReopened(null)
    },
  })
  const cancellable = cancelCommit({ row: count, why: cancelWhy, pending: cancel.isPending })
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

      {state === 'none' && canStart && (
        <form
          className="flex flex-col gap-2 border-t border-border/40 pt-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (inFlight.current || !startable.canCommit) return
            inFlight.current = true
            start.mutate()
          }}
          data-stage-count-start=""
        >
          <p className="text-xs text-muted-foreground">{t('count.start.hint')}</p>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <Field id="store-count-day" label={t('count.start.day')}>
              <Input
                type="date"
                dir="ltr"
                value={day}
                max={today}
                onChange={(e) => setDay(e.target.value)}
                disabled={start.isPending}
                className="w-44"
                required
                data-stage-count-day=""
              />
            </Field>
            <Button type="submit" variant="primary" disabled={!startable.canCommit} data-stage-count-start-commit="">
              {start.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
              )}
              {start.isPending ? t('count.start.committing') : t('count.start.commit')}
            </Button>
          </div>
          {startable.inFuture && <p className="text-xs text-attention-800">{t('count.start.inFuture')}</p>}
          {start.isError && (
            <ErrorBanner
              className="p-2.5"
              title={t('count.start.refusedTitle')}
              message={apiErrorMessage(start.error, t('count.start.failed'))}
            />
          )}
        </form>
      )}

      {canAskCountClosed(count, canClose, close.isPending) && !seedShown.running && (
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
      {seedShown.running && (
        <div
          role="status"
          className="flex gap-2 rounded-lg border border-border/60 bg-card/40 p-2.5 text-[0.8125rem]"
          data-stage-count-seed="running"
        >
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{t('count.seedRunningTitle')}</span>
            <span className="text-muted-foreground">{t('count.seedRunning')}</span>
          </div>
        </div>
      )}
      {(refusal ?? seedShown.refusal) && (
        <ErrorBanner className="p-2.5" title={t('count.seedRefusedTitle')} message={(refusal ?? seedShown.refusal)!} />
      )}
      {seedShown.failure && <ErrorBanner className="p-2.5" title={t('count.seedFailedTitle')} message={seedShown.failure} />}
      {reopened !== null && state !== 'closed' && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card/40 p-2.5 text-[0.8125rem]"
          data-stage-count-seed="reopened"
        >
          <span className="font-semibold">{t('count.reopenedTitle')}</span>
          <span className="text-muted-foreground">{t('count.reopened')}</span>
          {reopened && (
            <bdi dir="auto" className="whitespace-normal break-words">
              {reopened}
            </bdi>
          )}
        </div>
      )}

      {state === 'open' && canStart && (
        <form
          className="flex flex-col gap-2 border-t border-border/40 pt-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (inFlight.current || !cancellable.canCommit) return
            inFlight.current = true
            cancel.mutate()
          }}
          data-stage-count-cancel=""
        >
          <h4 className="text-[0.8125rem] font-semibold">{t('count.cancel.title')}</h4>
          <p className="text-xs text-muted-foreground">{t('count.cancel.hint')}</p>
          <Field id="store-count-cancel-why" label={t('count.cancel.why')}>
            <Textarea
              value={cancelWhy}
              onChange={(e) => setCancelWhy(e.target.value)}
              disabled={cancel.isPending}
              rows={2}
              placeholder={t('count.cancel.whyPlaceholder')}
              className="w-full"
              required
            />
          </Field>
          {cancellable.tooLong && (
            <p className="text-xs text-attention-800">{t('move.tooLong', { max: fsi(String(WHY_MAX)) })}</p>
          )}
          {cancel.isError && (
            <ErrorBanner
              className="p-2.5"
              title={t('count.cancel.refusedTitle')}
              message={apiErrorMessage(cancel.error, t('count.cancel.failed'))}
            />
          )}
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={!cancellable.canCommit} data-stage-count-cancel-commit="">
              {cancel.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Ban className="h-3.5 w-3.5" aria-hidden />}
              {cancel.isPending ? t('count.cancel.committing') : t('count.cancel.commit')}
            </Button>
          </div>
        </form>
      )}

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
