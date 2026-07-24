import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { confirmAction } from '@/core/services/confirm'
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
import { statusBreakdownRows } from './fields'
import { documentColumns, failedJobRowStyle } from './columns'
import DocumentHeader from './DocumentHeader'
import CommandPanel from './CommandPanel'
import ShippingAddress from './ShippingAddress'
import FieldGroup from './FieldGroup'
import DetailGrid from './DetailGrid'
import RescheduleDialog from './RescheduleDialog'
import ChangeStoreDialog, { type ChangeStoreResult } from './ChangeStoreDialog'
import RequestCloseDialog from './RequestCloseDialog'

/** Whether this record was opened as a document or a delivery. */
export type OpenedAs = 'document' | 'delivery'

type TabId = 'items' | 'conditions' | 'log' | 'status' | 'jobs'
const TAB_IDS: TabId[] = ['items', 'conditions', 'log', 'status', 'jobs']

/** `DeliveryDocumentType` code for BeyondBorder — the Return Document gate. */
const BEYOND_BORDER = 'BB'

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
 * Loads the full document (as an order or a delivery), renders the header
 * groups, the command panel, the shipping address and the five tabs. Log and
 * Jobs are fetched after the document renders — never blocking the page.
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
 */
export default function DocumentDetailsPage({ openedAs }: { openedAs: OpenedAs }) {
  const { t } = useTranslation('document')
  const params = useParams()
  const routeId = (params.documentNo ?? params.deliveryNo ?? '').trim()

  const [document, setDocument] = useState<SdDocumentHeaderModel | null>(null)
  const [documentLoading, setDocumentLoading] = useState(true)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [actionRunning, setActionRunning] = useState(false)

  const [logs, setLogs] = useState<Deferred<SdDocumentLogModel>>(PENDING)
  const [jobs, setJobs] = useState<Deferred<SdDocumentOutboxModel>>(PENDING)

  const [activeTab, setActiveTab] = useState<TabId>('items')
  const [note, setNote] = useState('')
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [changeStoreOpen, setChangeStoreOpen] = useState(false)
  const [requestCloseOpen, setRequestCloseOpen] = useState(false)

  /**
   * The note captured when Change Store was triggered. Change Store posts the
   * note that was on screen when the operator opened the picker, not whatever it
   * says when they finish picking.
   */
  const [pendingNote, setPendingNote] = useState('')

  const actionBusy = actionRunning || refreshing
  const commandBusy = actionBusy || rescheduleOpen || changeStoreOpen || requestCloseOpen

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
  // unmounting still reloads.
  useEffect(() => {
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
  }, [routeId, openedAs, loadLogs, loadJobs, t])

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
        if (kind === 'add-note') setNote('')
        void reload()
      } catch (err) {
        setActionRunning(false)
        notify.apiError(t('toast.failed', { label }), err, t('toast.failedDetail', { label: label.toLowerCase() }))
      }
    },
    [document, actionBusy, reload, t],
  )

  async function onCommand(kind: CommandKind) {
    if (actionBusy) return
    switch (kind) {
      case 'add-note':
      case 'close':
      case 'force-close':
      case 'cancel-close-request': {
        const label = t(`actions.${kind}`)
        if (await confirmAction(t('confirm.message'), label)) void postUpdate(kind, note)
        return
      }
      case 'change-store':
        setPendingNote(note)
        setChangeStoreOpen(true)
        return
      case 'reschedule':
        setRescheduleOpen(true)
        return
      case 'request-close':
        setRequestCloseOpen(true)
        return
      case 'return-document':
        notify.info(t('actions.return-document'), t('returnDocument.unavailable'))
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
    void postUpdate('change-store', pendingNote, {
      actionData: result.actionData,
      actionData2: result.actionData2,
    })
  }

  const returnEnabled = (document?.deliveryDocumentType ?? '').trim().toUpperCase() === BEYOND_BORDER
  const headerConditions = useMemo(
    () => (document?.conditions ?? []).filter((c) => c.condDocumentLine === 0),
    [document],
  )
  const itemColumns = useMemo(() => documentColumns.items(), [])
  const conditionColumns = useMemo(() => documentColumns.conditions(), [])
  const logColumns = useMemo(() => documentColumns.logs(), [])
  const jobColumns = useMemo(() => documentColumns.jobs(), [])

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Link to="/oms/deliveries" className="inline-flex items-center gap-1.5 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('back')}
        </Link>
        <span className="flex-1" />
        {document?.isExpressDelivery === true && (
          <span className="rounded-full bg-attention-050 px-2 py-0.5 text-xs font-semibold text-attention-800">
            {t('dawaaNow')}
          </span>
        )}
        {document && (
          <Button variant="outlined" disabled={actionRunning || refreshing} onClick={() => void reload()}>
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {t('refresh.button')}
          </Button>
        )}
      </div>

      <h1 className="text-base font-semibold tracking-tight">
        {t('title')}
        {document && <span className="text-muted-foreground"> · {document.documentNo}</span>}
      </h1>

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
            <DocumentHeader document={document} />

            <CommandPanel
              note={note}
              onNoteChange={setNote}
              busy={commandBusy}
              returnEnabled={returnEnabled}
              onCommand={(kind) => void onCommand(kind)}
            />

            <div className="grid gap-2.5 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
              <ShippingAddress address={document.shippingAddress} />

              <div className="min-w-0">
                <div role="tablist" aria-label={t('tabs.ariaLabel')} className="flex gap-1 border-b border-border">
                  {TAB_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      id={`tab-${id}`}
                      aria-selected={activeTab === id}
                      aria-controls={`tabpanel-${id}`}
                      onClick={() => setActiveTab(id)}
                      className={
                        'border-b-2 px-3 py-1.5 text-sm ' +
                        (activeTab === id
                          ? 'border-primary font-semibold text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground')
                      }
                    >
                      {t(`tabs.${id}`)}
                    </button>
                  ))}
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
                      {id === 'status' && (
                        <FieldGroup
                          title={t('groups.status')}
                          fields={document.status ? statusBreakdownRows(document.status, t) : []}
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
          </>
        )
      )}
    </section>
  )
}
