import { useEffect, useMemo, useState } from 'react'
import type { RowClassRules } from 'ag-grid-community'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import GridPager from '@/core/ui/GridPager'
import Modal from '@/core/ui/Modal'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import {
  DEAD_LETTER_REASONS,
  DEAD_LETTER_STAGES,
  type DeadLetter,
  type DeadLetterReason,
  type DeadLetterStage,
  type MirrorEntityCounts,
  type StoreDetail,
} from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import { storeMirrorQuery } from './api'
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

const SELECT =
  'h-7 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground outline-none focus:border-primary/60'

/**
 * The Mirror tab (spec 2563, ticket 457), from `Store/Mirror`: the store's mirror inbox
 * by entity type, then its dead letters of both stages, paged by the door at 50, with
 * the door's stage, reason and include-acknowledged filters.
 *
 * Offered to every store; one the mirror rail does not sweep (`onMirror: false`) shows
 * "not on mirror" and asks nothing (`isOnMirror`).
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
  const [filter, setFilter] = useState<MirrorFilter>(DEFAULT_MIRROR_FILTER)
  const [page, setPage] = useState(1)
  const [opened, setOpened] = useState<DeadLetter | null>(null)

  const mirror = useQuery({ ...storeMirrorQuery(code, filter, page), placeholderData: keepPreviousData })
  const countColumns = useMemo(() => buildEntityCountColumns(t), [t])
  const columns = useMemo(() => buildDeadLetterColumns(t, setOpened), [t])
  // As on Passes: a failed read draws none of the previous filter's rows.
  const shown = mirror.isError ? undefined : mirror.data
  const total = shown?.deadLetters.total ?? 0

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
            <select
              value={filter.stage ?? ''}
              onChange={(e) => change({ stage: (e.target.value || null) as DeadLetterStage | null })}
              className={SELECT}
              data-mirror-stage=""
            >
              <option value="">{t('mirrorTab.allStages')}</option>
              {DEAD_LETTER_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(deadLetterStageLabel(s).labelKey as string)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t('mirrorTab.reason')}
            <select
              value={filter.reason ?? ''}
              onChange={(e) => change({ reason: (e.target.value || null) as DeadLetterReason | null })}
              className={SELECT}
              data-mirror-reason=""
            >
              <option value="">{t('mirrorTab.allReasons')}</option>
              {DEAD_LETTER_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(deadLetterReasonLabel(r).labelKey as string)}
                </option>
              ))}
            </select>
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
        <TabGrid
          rows={shown?.deadLetters.items}
          columns={columns}
          rowId={deadLetterId}
          rowClassRules={DEAD_LETTER_ROW_CLASS}
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
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border/60 px-4 py-1.5 text-sm hover:bg-accent"
          data-dead-letter-error-close=""
        >
          {t('mirrorTab.close')}
        </button>
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
