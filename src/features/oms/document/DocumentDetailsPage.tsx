import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import Button from '@/core/ui/Button'
import StatusBadge from '@/core/ui/StatusBadge'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorMessage } from '@/core/api'
import { OMS_ACCESS_KEY, omsAccessApi } from '@/core/oms/api'
import { notify } from '@/core/services/notify'
import type {
  SdDocumentHeaderModel,
  SdDocumentLogModel,
  SdDocumentOutboxModel,
} from '@/core/models/sd-document'
import type { RescheduleDocumentModel } from '@/core/models/slots'
import { documentApi } from './api'
import {
  buildUpdateHeader,
  isDeliveryCategory,
  resolveActionType,
  type CommandKind,
  type UpdateActionKind,
  type UpdateHeaderExtras,
} from './actions'
import {
  documentColumns,
  deletedLineRowStyle,
  failedJobRowStyle,
  isFailedJob,
  ITEM_ROW_SELECTION,
} from './columns'
import { totalsFooterRow } from './items'
import { documentProvenanceRows } from './fields'
import IdentityBand from './IdentityBand'
import StatusRail from './StatusRail'
import CommandPanel from './CommandPanel'
import SummaryRail from './SummaryRail'
import DetailGrid from './DetailGrid'
import RescheduleDialog from './RescheduleDialog'
import ChangeStoreDialog, { type ChangeStoreResult } from './ChangeStoreDialog'
import RequestCloseDialog from './RequestCloseDialog'
import NoteDialog, { type NoteCommandKind } from './NoteDialog'
import ReturnDialog from './ReturnDialog'

/** Whether this record was opened as a document or a delivery. */
export type OpenedAs = 'document' | 'delivery'

// No `status` tab: the document's state is the pill rail under the header, and
// its full thirteen-row breakdown is that rail's All-statuses disclosure (083 D-3).
type TabId = 'items' | 'conditions' | 'log' | 'jobs'
const TAB_IDS: TabId[] = ['items', 'conditions', 'log', 'jobs']

/** Ascending comparator treating numeric strings (`logNo`, `outboxId`) as numbers. */
function numericAsc(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return (a ?? '').localeCompare(b ?? '')
}

/** One deferred collection (Log / Jobs) — `rows: null` until it resolves. */
interface Deferred<T> {
  rows: T[] | null
  loading: boolean
  error: string | null
}
const PENDING = { rows: null, loading: true, error: null } as const

/**
 * Screen 2 — Document Details.
 *
 * Loads the full document (as an order or a delivery), renders the identity
 * band, the status pill rail, the command panel, the shipping address and the
 * four tabs. Log and Jobs are fetched after the document renders — never
 * blocking the page.
 *
 * Two different fields choose two different endpoints, and mixing them up breaks
 * real documents (D-17/D-19):
 *
 * - **`openedAs`** (the route) picks the LOAD/refresh endpoint.
 * - **`documentCategory`** (the payload) picks the MUTATION endpoint and the
 *   4-letter actionType.
 *
 * Delivery `9000000003` is the live proof they diverge: opened as a delivery,
 * category `T`, so it loads from `Delivery/{no}` and mutates via
 * `UpdateDocument`.
 *
 * Self-guards on `canOpenDetail` (ticket 125) — the grant that matters, since this is a
 * deep-linkable route carrying the update/reschedule write doors and `router.tsx` has no
 * per-route permission metadata. Spinner → denied card → content, sharing the ONE
 * `OMS_ACCESS_KEY` cache entry with the menu probe and the list guard; the document load
 * itself waits on the probe, so a denied session fires no document request at all.
 */
export default function DocumentDetailsPage({ openedAs }: { openedAs: OpenedAs }) {
  const { t } = useTranslation('document')
  const params = useParams()
  const routeId = (params.documentNo ?? params.deliveryNo ?? '').trim()

  // Both options MATCH the menu probe's own on this shared key (see useVisibleMenu), and
  // matching is the point: `staleTime: Infinity` keeps this observer from marking the
  // shared entry stale and refetching on mount — a second answer that failed would empty
  // the OMS group from the nav while this screen is happily open. `retry: false` lands a
  // fail-closed grant on the card at once instead of holding "Checking access…" through a
  // retry backoff.
  const access = useQuery({
    queryKey: OMS_ACCESS_KEY,
    queryFn: () => omsAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  })
  const canOpenDetail = access.data?.canOpenDetail === true

  const [document, setDocument] = useState<SdDocumentHeaderModel | null>(null)
  const [documentLoading, setDocumentLoading] = useState(true)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [actionRunning, setActionRunning] = useState(false)

  const [logs, setLogs] = useState<Deferred<SdDocumentLogModel>>(PENDING)
  const [jobs, setJobs] = useState<Deferred<SdDocumentOutboxModel>>(PENDING)

  const [activeTab, setActiveTab] = useState<TabId>('items')
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [changeStoreOpen, setChangeStoreOpen] = useState(false)
  const [requestCloseOpen, setRequestCloseOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)

  /**
   * The note-carrying command awaiting its dialog, or `null`. Since 094 there is
   * no standing textarea and no `pendingNote` to snapshot: every command that
   * posts a note captures it inside its own confirm dialog, so the note typed
   * there is unambiguously the note that posts (083 D-11).
   */
  const [noteCommand, setNoteCommand] = useState<NoteCommandKind | null>(null)

  const actionBusy = actionRunning || refreshing
  const commandBusy =
    actionBusy ||
    rescheduleOpen ||
    changeStoreOpen ||
    requestCloseOpen ||
    returnOpen ||
    noteCommand !== null

  const loadLogs = useCallback(
    async (documentNo: string) => {
      setLogs(PENDING)
      try {
        const rows = await documentApi.getLogs(documentNo)
        setLogs({ rows: [...rows].sort((a, b) => numericAsc(a.logNo, b.logNo)), loading: false, error: null })
      } catch (err) {
        setLogs({ rows: null, loading: false, error: apiErrorMessage(err, t('log.failed')) })
      }
    },
    [t],
  )

  const loadJobs = useCallback(
    async (documentNo: string) => {
      setJobs(PENDING)
      try {
        const rows = await documentApi.getOutbox(documentNo)
        setJobs({ rows: [...rows].sort((a, b) => numericAsc(a.outboxId, b.outboxId)), loading: false, error: null })
      } catch (err) {
        setJobs({ rows: null, loading: false, error: apiErrorMessage(err, t('jobs.failed')) })
      }
    },
    [t],
  )

  // Initial load. Keyed on the route id, so navigating between documents without
  // unmounting still reloads. Gated on the access probe: until it says yes, nothing is
  // requested — the denied card below must not be preceded by a document fetch.
  useEffect(() => {
    if (!canOpenDetail) return
    let cancelled = false
    setDocumentLoading(true)
    setDocumentError(null)
    const load = openedAs === 'delivery' ? documentApi.getDelivery : documentApi.getDocument
    load(routeId)
      .then((doc) => {
        if (cancelled) return
        setDocument(doc)
        setDocumentLoading(false)
        // Logs and Jobs load AFTER the document renders — never block the page.
        void loadLogs(doc.documentNo)
        void loadJobs(doc.documentNo)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setDocumentLoading(false)
        setDocumentError(apiErrorMessage(err, t('load.failed')))
      })
    return () => {
      cancelled = true
    }
  }, [routeId, openedAs, canOpenDetail, loadLogs, loadJobs, t])

  /**
   * Reload the document plus Log and Jobs, in place. A failed reload is
   * non-fatal — warn and keep the data already on screen.
   *
   * A SUCCESSFUL reload says nothing: the Refresh button's own spinner already
   * reports it, in place, while it happens. A toast on top would announce a
   * result the operator is looking at — and every redundant success toast makes
   * the channel that carries real failures easier to dismiss unread.
   */
  const reload = useCallback(
    async () => {
      const current = document
      if (!current || refreshing) return
      setRefreshing(true)
      try {
        const load = openedAs === 'delivery' ? documentApi.getDelivery : documentApi.getDocument
        const fresh = await load(current.documentNo)
        setDocument(fresh)
        void loadLogs(fresh.documentNo)
        void loadJobs(fresh.documentNo)
      } catch (err) {
        notify.warn(t('refresh.failed'), apiErrorMessage(err, t('refresh.failedDetail')))
      } finally {
        setRefreshing(false)
      }
    },
    [document, refreshing, openedAs, loadLogs, loadJobs, t],
  )

  /**
   * Post an Update action: resolve the actionType and endpoint from
   * `documentCategory`, then refresh in place on success. The document is left
   * untouched on failure — the server's `400` message is the whole story.
   */
  const postUpdate = useCallback(
    async (kind: UpdateActionKind, actionNote: string, extras?: UpdateHeaderExtras) => {
      const doc = document
      if (!doc || actionBusy) return
      const label = t(`actions.${kind}`)
      const actionType = resolveActionType(kind, doc.documentCategory)
      const body = buildUpdateHeader(doc.documentNo, actionType, actionNote, extras)
      const post = isDeliveryCategory(doc.documentCategory)
        ? documentApi.updateDelivery
        : documentApi.updateDocument

      setActionRunning(true)
      try {
        await post(body)
        setActionRunning(false)
        notify.success(t('toast.done', { label }), t('toast.doneDetail', { label }))
        void reload()
      } catch (err) {
        setActionRunning(false)
        notify.apiError(t('toast.failed', { label }), err, t('toast.failedDetail', { label: label.toLowerCase() }))
      }
    },
    [document, actionBusy, reload, t],
  )

  function onCommand(kind: CommandKind) {
    if (actionBusy) return
    switch (kind) {
      // The four note-carrying commands share one dialog: it confirms AND
      // captures the note, so there is no pre-confirm on top of a dialog.
      case 'add-note':
      case 'close':
      case 'force-close':
      case 'cancel-close-request':
        setNoteCommand(kind)
        return
      case 'change-store':
        setChangeStoreOpen(true)
        return
      case 'reschedule':
        setRescheduleOpen(true)
        return
      case 'request-close':
        setRequestCloseOpen(true)
        return
      case 'return-document':
        // The placeholder toast is gone: the command opens the dialog that
        // creates the return, over the delivery it is about (spec 289 D1).
        setReturnOpen(true)
        return
    }
  }

  async function onRescheduleConfirmed(model: RescheduleDocumentModel) {
    const doc = document
    if (!doc || actionBusy) return
    const label = t('actions.reschedule')
    const post = isDeliveryCategory(doc.documentCategory)
      ? documentApi.rescheduleDelivery
      : documentApi.rescheduleDocument
    setActionRunning(true)
    try {
      await post(model)
      setActionRunning(false)
      notify.success(t('toast.done', { label }), t('reschedule.doneDetail'))
      void reload()
    } catch (err) {
      setActionRunning(false)
      notify.apiError(t('toast.failed', { label }), err, t('toast.failedDetail', { label: label.toLowerCase() }))
    }
  }

  function onChangeStoreConfirmed(result: ChangeStoreResult) {
    void postUpdate('change-store', result.note, {
      actionData: result.actionData,
      actionData2: result.actionData2,
    })
  }

  const headerConditions = useMemo(
    () => (document?.conditions ?? []).filter((c) => c.condDocumentLine === 0),
    [document],
  )
  const itemColumns = useMemo(() => documentColumns.items(), [])
  const itemsFooter = useMemo(() => totalsFooterRow(document?.lines, t), [document, t])
  /**
   * The tab counts. Jobs is the one that judges: while any job has failed it
   * counts the FAILURES in `bad`, not the total — otherwise a failed outbox job
   * is a number indistinguishable from a healthy one (083 D-9). A deferred
   * collection shows no count at all until it resolves; a `0` while Log is still
   * loading would be a claim the app cannot yet make.
   */
  const tabCounts = useMemo(() => {
    const failed = (jobs.rows ?? []).filter(isFailedJob).length
    const plain = (value: number) => ({ value, bad: false })
    return {
      items: plain(document?.lines?.length ?? 0),
      conditions: plain(headerConditions.length),
      log: logs.rows ? plain(logs.rows.length) : null,
      jobs: jobs.rows ? (failed > 0 ? { value: failed, bad: true } : plain(jobs.rows.length)) : null,
    } satisfies Record<TabId, { value: number; bad: boolean } | null>
  }, [document, headerConditions, logs.rows, jobs.rows])
  const conditionColumns = useMemo(() => documentColumns.conditions(), [])
  const logColumns = useMemo(() => documentColumns.logs(), [])
  const jobColumns = useMemo(() => documentColumns.jobs(), [])

  // ----- access states ------------------------------------------------------
  // After every hook, before any render. The identity band is not rendered either: a
  // denied session should not learn the document number resolves to anything.
  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('access.checking')}
      </div>
    )
  }
  if (!canOpenDetail) {
    // Same split as the list guard: a failed probe is a server fault, not a missing grant.
    const unreachable = access.isError
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
        data-oms-denied="detail"
      >
        <div className="text-base font-semibold tracking-tight">
          {t(unreachable ? 'access.unavailableTitle' : 'access.deniedTitle')}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unreachable ? apiErrorMessage(access.error, t('access.unavailableHint')) : t('access.deniedHint')}
        </p>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-2.5">
      {/*
        The page opens straight into the identity band (083 D-2, ticket 091):
        `documentNo` is the largest thing on screen, the sub-ids sit under it,
        the customer block sits at the end, and Back is the chevron at its
        start. The old title row, toolbar row and header field groups are gone.
        It renders while the document loads and after a failure too — the
        chevron is this screen's only way out.
      */}
      <IdentityBand document={document} routeId={routeId} />

      {documentLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('load.loading')}
        </div>
      ) : documentError ? (
        <ErrorBanner title={t('load.failedTitle')} message={documentError} className="p-4" />
      ) : (
        document && (
          <>
            {/*
              Refresh sits at the very end of the rail, not in the page chrome:
              the rail is what a refresh most visibly changes (083 D-3). Its
              behaviour is unchanged — spinner in place, silent on success, a
              toast only on failure.
            */}
            <StatusRail status={document.status} provenance={documentProvenanceRows(document, t)}>
              <Button variant="outlined" disabled={actionRunning || refreshing} onClick={() => void reload()}>
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                {t('refresh.button')}
              </Button>
            </StatusRail>

            {/*
              The action bar's grammar (083 D-10, ticket 094): three labelled
              clusters in order of increasing consequence, then the unlabelled
              terminal pair. Gating is evidence-only — `closeStatus` and the
              server's own `canReturn` are the only fields live data proves a
              contradiction on; the server remains the authority on everything
              else and says so in its `400`. `lines` is handed in for the return
              command's REASON split alone (spec 289 D2), never for its gate.
            */}
            <CommandPanel
              context={{
                closeStatus: document.status?.closeStatus,
                documentCategory: document.documentCategory,
                canReturn: document.canReturn,
                lines: document.lines,
                busy: commandBusy,
              }}
              onCommand={onCommand}
            />

            {/*
              The page's two regions (083 D-6, ticket 092): a 340px summary rail
              and the work area. Below 900px the grid collapses to one column and
              the rail — first in the DOM — becomes a card grid ABOVE the work
              area rather than a drawer, because the summary is the context the
              grid is read with. `rail:` is the named 900px screen declared in
              `global.css` — not Tailwind's `lg`: the spec names the number, and
              it is where the 340px rail plus a readable grid stop fitting side
              by side.
            */}
            <div className="grid gap-2.5 rail:grid-cols-[340px_minmax(0,1fr)]">
              <SummaryRail document={document} />

              <div className="min-w-0">
                <div role="tablist" aria-label={t('tabs.ariaLabel')} className="flex gap-1 border-b border-border">
                  {TAB_IDS.map((id) => {
                    const count = tabCounts[id]
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        id={`tab-${id}`}
                        aria-selected={activeTab === id}
                        aria-controls={`tabpanel-${id}`}
                        onClick={() => setActiveTab(id)}
                        className={
                          'flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm ' +
                          (activeTab === id
                            ? 'border-primary font-semibold text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground')
                        }
                      >
                        {t(`tabs.${id}`)}
                        {count && (
                          // The count is the severity layer's `bad` pill when it
                          // reports failures and `mute` otherwise — one badge, one
                          // vocabulary, no per-site colour (082 D-10). The title
                          // says which number it is; `1` alone would not.
                          <span title={t(count.bad ? 'tabs.failedCount' : 'tabs.rowCount', { count: count.value })}>
                            <StatusBadge sev={count.bad ? 'bad' : 'mute'}>
                              <span className="tabular-nums">{count.value}</span>
                            </StatusBadge>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/*
                  Every panel stays mounted and is hidden with CSS rather than
                  unmounted. Switching tabs must not destroy and rebuild an AG
                  Grid: that throws away column widths, sort and filters the
                  operator set, and costs a visible re-layout each time (D-23).
                */}
                <div className="pt-2.5">
                  {TAB_IDS.map((id) => (
                    <div
                      key={id}
                      role="tabpanel"
                      id={`tabpanel-${id}`}
                      aria-labelledby={`tab-${id}`}
                      hidden={activeTab !== id}
                    >
                      {id === 'items' && (
                        <DetailGrid
                          columnDefs={itemColumns}
                          rowData={document.lines ?? []}
                          emptyMessage={t('items.empty')}
                          pinnedBottomRowData={itemsFooter}
                          rowSelection={ITEM_ROW_SELECTION}
                          getRowStyle={deletedLineRowStyle}
                        />
                      )}
                      {id === 'conditions' && (
                        <DetailGrid
                          columnDefs={conditionColumns}
                          rowData={headerConditions}
                          emptyMessage={t('conditions.empty')}
                        />
                      )}
                      {id === 'log' && (
                        <DetailGrid
                          columnDefs={logColumns}
                          rowData={logs.rows}
                          loading={logs.loading}
                          error={logs.error}
                          emptyMessage={t('log.empty')}
                        />
                      )}
                      {id === 'jobs' && (
                        <DetailGrid
                          columnDefs={jobColumns}
                          rowData={jobs.rows}
                          loading={jobs.loading}
                          error={jobs.error}
                          emptyMessage={t('jobs.empty')}
                          getRowStyle={failedJobRowStyle}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <RescheduleDialog
              open={rescheduleOpen}
              onClose={() => setRescheduleOpen(false)}
              document={document}
              onConfirmed={(model) => void onRescheduleConfirmed(model)}
            />
            <ChangeStoreDialog
              open={changeStoreOpen}
              onClose={() => setChangeStoreOpen(false)}
              document={document}
              onConfirmed={onChangeStoreConfirmed}
            />
            <RequestCloseDialog
              open={requestCloseOpen}
              onClose={() => setRequestCloseOpen(false)}
              onConfirmed={(reason) => void postUpdate('request-close', reason)}
            />
            <ReturnDialog
              open={returnOpen}
              onClose={() => setReturnOpen(false)}
              document={document}
            />
            <NoteDialog
              kind={noteCommand}
              onClose={() => setNoteCommand(null)}
              onConfirmed={(kind, text) => void postUpdate(kind, text)}
            />
          </>
        )
      )}
    </section>
  )
}
