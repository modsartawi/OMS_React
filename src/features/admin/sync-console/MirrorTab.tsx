import { useEffect, useMemo, useRef, useState } from 'react'
import type { MultiRowSelectionOptions, RowClassRules } from 'ag-grid-community'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import Select from '@/core/ui/Select'
import {
  DEAD_LETTER_REASONS,
  DEAD_LETTER_STAGES,
  type DeadLetter,
  type DeadLetterReason,
  type DeadLetterStage,
  type MirrorEntityCounts,
  type StoreDetail,
} from '@/core/models/sync-console'
import { formatPair, fsi } from '@/core/util/bidi'
import { AUDIT_KEY, FLEET_KEY, storeKey, storeMirrorQuery, syncConsoleAccessQuery, syncConsoleApi } from './api'
import {
  SELECTION_CAP,
  controlResultSummary,
  deadLetterActions,
  mirrorRefusalLabel,
  type DeadLetterAction,
} from './control-helpers'
import { notifyOutcome, resultSentence, type ControlOutcome } from './ControlDialog'
import ControlResults from './ControlResults'
import { figure } from './helpers'
import ReasonDialog from './ReasonDialog'
import { CHECKBOX_SELECTION, useCappedSelection } from './useCappedSelection'
import {
  DEFAULT_MIRROR_FILTER,
  MIRROR_PAGE_SIZE,
  deadLetterReasonLabel,
  deadLetterStageLabel,
  isOnMirror,
  type MirrorFilter,
} from './store-helpers'
import { buildDeadLetterColumns, buildEntityCountColumns } from './mirror-columns'
import TabGrid from './TabGrid'

/** A dead letter's row id: the stage and the id together — an inbox id and an outbox id may collide. */
const deadLetterId = (d: DeadLetter) => `${d.stage}-${d.id}`

/** An acknowledged dead letter is drawn muted (the settlement grids' `opacity-60`): the record of what was lost, not a live fault. */
const DEAD_LETTER_ROW_CLASS: RowClassRules<DeadLetter> = { 'opacity-60': (p) => p.data?.acknowledgedAt != null }

const entityTypeId = (c: MirrorEntityCounts) => c.entityType

/**
 * The dead letters' checkboxes (ticket 458), drawn only with `canOperate`. An
 * acknowledged row takes none: nothing more can be done to it.
 */
const DEAD_LETTER_SELECTION: MultiRowSelectionOptions<DeadLetter> = {
  ...(CHECKBOX_SELECTION as MultiRowSelectionOptions<DeadLetter>),
  isRowSelectable: (n) => n.data?.acknowledgedAt == null,
  hideDisabledCheckboxes: true,
}

/** Each action's door, its audit name (the per-row list's title) and its button. */
const DEAD_LETTER_ACTION = {
  retry: { door: 'Retry', audit: 'MirrorRetry', variant: 'primary' },
  acknowledge: { door: 'Acknowledge', audit: 'MirrorAcknowledge', variant: 'danger-outlined' },
} as const

const DEAD_LETTER_ACTIONS: readonly DeadLetterAction[] = ['retry', 'acknowledge']

/**
 * The Mirror tab (spec 2563, ticket 457), from `Store/Mirror`: the store's mirror inbox
 * by entity type, then its dead letters of both stages, paged by the door at 50, with
 * the door's stage, reason and include-acknowledged filters.
 *
 * Offered to every store; one the mirror rail does not sweep (`onMirror: false`) shows
 * "not on mirror" and asks nothing (`isOnMirror`).
 *
 * With `canOperate` (ticket 458) the dead letters take a selection of up to 50 (447's
 * one cap, `useCappedSelection`) and a bar that sends **Retry** or **Acknowledge as
 * lost** for it, with a reason, on the shared dialog — each offered only when every
 * selected row can take it (`deadLetterActions`). The per-row refusals stay listed in
 * the controls' style; then the tab, the store header, the fleet and the audit feed are
 * read again. Without the grant the tab is read only: no checkbox, no bar.
 *
 * 🚩 No payload, ever: the door returns none and the tab asks for none.
 */
export default function MirrorTab({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  if (!isOnMirror(row))
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-mirror-tab="notOnMirror">
        {t('mirrorTab.notOnMirror')}
      </p>
    )
  return <MirrorLists code={row.code} />
}

function MirrorLists({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const access = useQuery(syncConsoleAccessQuery())
  const canOperate = access.data?.canOperate === true
  const [filter, setFilter] = useState<MirrorFilter>(DEFAULT_MIRROR_FILTER)
  const [page, setPage] = useState(1)
  const [opened, setOpened] = useState<DeadLetter | null>(null)

  const mirror = useQuery({ ...storeMirrorQuery(code, filter, page), placeholderData: keepPreviousData })
  const countColumns = useMemo(() => buildEntityCountColumns(t), [t])
  const columns = useMemo(() => buildDeadLetterColumns(t, setOpened), [t])
  // As on Passes: a failed read draws none of the previous filter's rows.
  const shown = mirror.isError ? undefined : mirror.data
  const total = shown?.deadLetters.total ?? 0

  // ── The selection (458): ids, so it outlives a page and a filter, as the Fleet's does.
  // The row behind an off-page pick is the last one read (kept for the picks alone), so
  // it still knows its stage and `canRetry`; the door judges each row again on the send.
  const { selected, setSelected, gridProps } = useCappedSelection(deadLetterId, 'mirrorTab.selection.capped')
  const known = useRef(new Map<string, DeadLetter>())
  useEffect(() => {
    const keep = new Set(selected)
    for (const id of known.current.keys()) if (!keep.has(id)) known.current.delete(id)
    for (const d of shown?.deadLetters.items ?? []) if (keep.has(deadLetterId(d))) known.current.set(deadLetterId(d), d)
  }, [shown, selected])
  const onPage = new Map((shown?.deadLetters.items ?? []).map((d) => [deadLetterId(d), d]))
  const selectedRows = selected.flatMap((id) => {
    const row = onPage.get(id) ?? known.current.get(id)
    return row ? [row] : []
  })
  const offered = deadLetterActions(selectedRows, canOperate)
  const [acting, setActing] = useState<{ action: DeadLetterAction; rows: DeadLetter[] } | null>(null)
  const [outcome, setOutcome] = useState<ControlOutcome | null>(null)
  const stageWord = (stage: string) => {
    const { labelKey } = deadLetterStageLabel(stage)
    return labelKey ? t(labelKey) : stage
  }

  const send = useMutation({
    mutationFn: ({ action, rows, reason }: { action: DeadLetterAction; rows: DeadLetter[]; reason: string }) =>
      syncConsoleApi.deadLetters(DEAD_LETTER_ACTION[action].door, {
        code,
        items: rows.map(({ stage, id }) => ({ stage, id })),
        reason,
      }),
    onSuccess: (data, { action }) => {
      // A row is named by its id and its stage: an inbox id and an outbox id may collide.
      const summary = controlResultSummary(data.results, (r) => formatPair(r.id, stageWord(r.stage)), mirrorRefusalLabel)
      notifyOutcome(summary, resultSentence(t, t(`mirrorTab.actions.${action}`), summary, 'deadLetterResults'))
      setOutcome({ action: DEAD_LETTER_ACTION[action].audit, summary })
      // The answered selection is spent; its refusals stay listed with their codes.
      setSelected([])
      // The store's reads (this tab and the header's lane among them), the fleet and the audit feed.
      void qc.invalidateQueries({ queryKey: storeKey(code) })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      close()
    },
  })

  const close = () => {
    send.reset()
    setActing(null)
  }

  // As on Passes: an emptied inner page (rows acknowledged meanwhile) falls back to the new last page.
  const settled = shown && !mirror.isPlaceholderData ? shown.deadLetters : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: MIRROR_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  // Any filter change goes back to page 1.
  const change = (next: Partial<MirrorFilter>) => {
    setFilter((f) => ({ ...f, ...next }))
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4" data-mirror-tab="onMirror">
      {shown && (
        <section className="flex flex-col gap-2" data-mirror-by-entity="">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('mirrorTab.byEntityType.title')}</h3>
          <TabGrid
            rows={shown.byEntityType}
            columns={countColumns}
            rowId={entityTypeId}
            // Drawn only on an answer: the read's loading and its failure are the dead-letter list's below.
            pending={false}
            error={null}
            failed={t('mirrorTab.failed')}
            empty={t('mirrorTab.byEntityType.empty')}
            loading={t('mirrorTab.loading')}
            data="mirror-entities"
          />
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('mirrorTab.deadLetters')}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t('mirrorTab.stage')}
            <Select
              value={filter.stage ?? ''}
              onChange={(e) => change({ stage: (e.target.value || null) as DeadLetterStage | null })}
             
              data-mirror-stage=""
            >
              <option value="">{t('mirrorTab.allStages')}</option>
              {DEAD_LETTER_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(deadLetterStageLabel(s).labelKey as string)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t('mirrorTab.reason')}
            <Select
              value={filter.reason ?? ''}
              onChange={(e) => change({ reason: (e.target.value || null) as DeadLetterReason | null })}
             
              data-mirror-reason=""
            >
              <option value="">{t('mirrorTab.allReasons')}</option>
              {DEAD_LETTER_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(deadLetterReasonLabel(r).labelKey as string)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={filter.includeAcknowledged}
              onChange={(e) => change({ includeAcknowledged: e.target.checked })}
              data-mirror-include-acknowledged=""
            />
            {t('mirrorTab.includeAcknowledged')}
          </label>
          {/* The previous filter's rows stay drawn while the new ones load: say so. */}
          {mirror.isPlaceholderData && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" data-mirror-loading="">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('mirrorTab.loading')}
            </span>
          )}
        </div>
        <ControlResults outcome={outcome} onDismiss={() => setOutcome(null)} />
        {canOperate && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('mirrorTab.actions.label')} data-dead-letter-bar="">
            <span className="text-xs text-muted-foreground" data-selection-count={selected.length}>
              {selected.length === 0 ? (
                t('mirrorTab.selection.hint', { cap: fsi(figure(SELECTION_CAP)) })
              ) : (
                <Trans
                  t={t}
                  i18nKey="mirrorTab.selection.count"
                  count={selected.length}
                  values={{ n: figure(selected.length) }}
                  components={{ n: <Ltr /> }}
                />
              )}
            </span>
            {DEAD_LETTER_ACTIONS.map((action) => (
              <Button
                key={action}
                variant={DEAD_LETTER_ACTION[action].variant}
                disabled={!offered.includes(action)}
                onClick={() => setActing({ action, rows: selectedRows })}
                data-dead-letter-action={action}
              >
                {t(`mirrorTab.actions.${action}`)}
              </Button>
            ))}
            {selected.length > 0 && (
              <Button variant="text" onClick={() => setSelected([])} data-selection-clear="">
                {t('selection.clear')}
              </Button>
            )}
            {/* Why Retry is not offered: the door's canRetry, never a guess from the stage. */}
            {selected.length > 0 && !offered.includes('retry') && (
              <span className="text-xs text-muted-foreground" data-dead-letter-no-retry="">
                {t('mirrorTab.actions.noRetry')}
              </span>
            )}
          </div>
        )}
        <TabGrid
          rows={shown?.deadLetters.items}
          columns={columns}
          rowId={deadLetterId}
          rowClassRules={DEAD_LETTER_ROW_CLASS}
          rowSelection={canOperate ? DEAD_LETTER_SELECTION : undefined}
          // Always wired, so a grant that answers after the grid mounted still finds its api.
          selectionProps={gridProps}
          pending={mirror.isPending}
          error={mirror.error}
          failed={t('mirrorTab.failed')}
          empty={t(page > 1 ? 'mirrorTab.emptyPage' : 'mirrorTab.empty')}
          loading={t('mirrorTab.loading')}
          data="mirror-dead-letters"
        />
        {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
        {((shown && showsPager(total, MIRROR_PAGE_SIZE)) || page > 1) && (
          <div className="overflow-hidden rounded-md border border-border/60">
            <GridPager page={page} pageSize={MIRROR_PAGE_SIZE} totalMatches={total} busy={mirror.isPlaceholderData} onPage={setPage} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t('mirrorTab.noPayload')}</p>
      </section>
      <DeadLetterErrorModal row={opened} onClose={() => setOpened(null)} />
      {acting && (
        <ReasonDialog
          open
          title={t('mirrorTab.dialog.title', {
            action: t(`mirrorTab.actions.${acting.action}`),
            count: acting.rows.length,
            n: fsi(figure(acting.rows.length)),
            code: fsi(code),
          })}
          codes={[code]}
          note={t(`mirrorTab.dialog.notes.${acting.action}`)}
          busy={send.isPending}
          error={send.error}
          confirmLabel={t(`mirrorTab.actions.${acting.action}`)}
          onConfirm={(reason) => send.mutate({ action: acting.action, rows: acting.rows, reason })}
          onClose={close}
        />
      )}
    </div>
  )
}

/** One dead letter's whole error, free text, on the app modal. */
function DeadLetterErrorModal({ row, onClose }: { row: DeadLetter | null; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  return (
    <Modal
      open={row !== null}
      onClose={onClose}
      // A modal title is a string-only sink: the id is isolated as one value.
      title={row ? t('mirrorTab.errorTitle', { id: fsi(row.id) }) : ''}
      width="48rem"
      footer={
        <Button variant="outlined" onClick={onClose} data-dead-letter-error-close="">
          {t('mirrorTab.close')}
        </Button>
      }
    >
      {row && (
        <bdi className="block text-sm break-words whitespace-pre-wrap" data-dead-letter-error-full={`${row.stage}-${row.id}`}>
          {row.error}
        </bdi>
      )}
    </Modal>
  )
}
