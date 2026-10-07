import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useMatches, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { OMS_ACCESS_KEY, omsAccessApi } from '@/core/oms/api'
import { canOpenCentralInvoice, centralInvoiceAccessQuery } from '@/core/central-invoice/api'
import CentralInvoiceDialog from '@/core/central-invoice/CentralInvoiceDialog'
import { notify } from '@/core/services/notify'
import { recordRecent } from '@/core/commands/recent'
import { fsi } from '@/core/util/bidi'
import { useCommands } from '@/core/commands/registry'
import { singleKeyScreenOf } from '@/core/commands/palette-model'
import {
  cameFromList,
  openIntentOf,
  resolveOpenIntent,
  withoutOpenIntent,
  type OpenIntent,
} from '@/core/oms/open-intent'
import type {
  SdDocumentHeaderModel,
  SdDocumentLogModel,
  SdDocumentOutboxModel,
  UpdateSdDocumentHeader,
} from '@/core/models/sd-document'
import type { RescheduleDocumentModel } from '@/core/models/slots'
import { documentApi } from './api'
import {
  buildUpdateHeader,
  isDeliveryCategory,
  resolveActionType,
  type CommandKind,
  type OpenedAs,
  type UpdateActionKind,
  type UpdateHeaderExtras,
} from './actions'
import { commandBar, commandOf, surfaceOf, type CommandContext } from './commands'
import { canPost, composerState } from './composer'
import { detailCommands, keyHints } from './detail-keys'
import NoteComposer, { type ComposerFailure } from './NoteComposer'
import DocumentHeader from './DocumentHeader'
import ActivitySpine, { type Deferred } from './ActivitySpine'
import CommandPanel from './CommandPanel'
import FactsColumn from './FactsColumn'
import RescheduleDialog from './RescheduleDialog'
import ChangeStoreDialog, { type ChangeStoreResult } from './ChangeStoreDialog'
import RequestCloseDialog from './RequestCloseDialog'
import NoteDialog, { type NoteCommandKind } from './NoteDialog'
import ReturnDialog from './ReturnDialog'
import MarkDeliveredDialog from './MarkDeliveredDialog'
import { markDeliveredGate } from './mark-delivered'
import { useOrderAttachments } from './use-order-attachments'

/** Ascending comparator treating numeric strings (`logNo`, `outboxId`) as numbers. */
function numericAsc(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return (a ?? '').localeCompare(b ?? '')
}

const PENDING = { rows: null, loading: true, error: null } as const

/**
 * An Update action's body and endpoint for one document: the payload's category picks both the
 * 4-letter actionType and `UpdateDelivery` vs `UpdateDocument` (D-17/D-19).
 */
function updateFor(
  doc: SdDocumentHeaderModel,
  kind: UpdateActionKind,
  note: string,
  extras?: UpdateHeaderExtras,
): { body: UpdateSdDocumentHeader; post: (body: UpdateSdDocumentHeader) => Promise<boolean> } {
  return {
    body: buildUpdateHeader(doc.documentNo, resolveActionType(kind, doc.documentCategory), note, extras),
    post: isDeliveryCategory(doc.documentCategory) ? documentApi.updateDelivery : documentApi.updateDocument,
  }
}

/**
 * Screen 2 — Document Details.
 *
 * Loads the full document (as an order or a delivery), renders the light
 * header (ticket 402), the command panel, then two columns: the activity spine
 * (ticket 403) and the facts column (ticket 404). There are no tabs. Log and Jobs
 * are fetched after the document renders, never blocking the page: the spine
 * draws the header's steps at once and dates them when the Log arrives.
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
  const location = useLocation()
  const navigate = useNavigate()
  // Letters exist only on a single-key screen (365 §2): the delivery route, not the document one.
  const singleKeyScreen = singleKeyScreenOf(useMatches().map((m) => m.handle))
  const hints = keyHints(singleKeyScreen)

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
  // Central invoicing's own grant (ticket 332) — the SAME key and options as the menu leaf
  // and the bulk screen's gate, so it costs no extra call, and a 403 from the dialog (which
  // overwrites the entry) removes the action here too.
  const centralInvoiceAccess = useQuery(centralInvoiceAccessQuery())

  const [document, setDocument] = useState<SdDocumentHeaderModel | null>(null)
  const [documentLoading, setDocumentLoading] = useState(true)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [actionRunning, setActionRunning] = useState(false)

  const [logs, setLogs] = useState<Deferred<SdDocumentLogModel>>(PENDING)
  const [jobs, setJobs] = useState<Deferred<SdDocumentOutboxModel>>(PENDING)

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [changeStoreOpen, setChangeStoreOpen] = useState(false)
  const [requestCloseOpen, setRequestCloseOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [centralInvoiceOpen, setCentralInvoiceOpen] = useState(false)
  const [markDeliveredOpen, setMarkDeliveredOpen] = useState(false)

  /**
   * The note-carrying command awaiting its dialog, or `null`: Cancel order, Force cancel and
   * Withdraw request capture their notes inside their own confirm dialog (083 D-11), so the note
   * typed there is unambiguously the note that posts.
   */
  const [noteCommand, setNoteCommand] = useState<NoteCommandKind | null>(null)

  /**
   * The note composer at the spine's Now line (D8, ticket 405): Add note posts from here. Its
   * text lives on the page because the page's Esc is refused while it is unsent (D10).
   */
  const [noteText, setNoteText] = useState('')
  const [notePosting, setNotePosting] = useState(false)
  const [noteFailure, setNoteFailure] = useState<ComposerFailure | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const composer = composerState(noteText, notePosting)
  /** The record on screen now, for a note post that answers after the operator has moved on. */
  const currentRoute = useRef(routeId)

  /**
   * The list's one-shot `open` intent (ticket 401, D9; 367 §3), waiting for the header, and the
   * command it was refused on. Read off the history entry and replaced away at once, so a
   * reload or a Back never finds it again — even when the header then fails to load.
   */
  const [pendingIntent, setPendingIntent] = useState<OpenIntent | null>(null)
  const [refusedIntent, setRefusedIntent] = useState<OpenIntent | null>(null)

  const actionBusy = actionRunning || refreshing
  const commandBusy =
    actionBusy ||
    rescheduleOpen ||
    changeStoreOpen ||
    requestCloseOpen ||
    returnOpen ||
    centralInvoiceOpen ||
    markDeliveredOpen ||
    noteCommand !== null

  // Another record drops what the last one was asked to open. Declared before the capture, so
  // on arrival the capture's own answer wins.
  useEffect(() => {
    setPendingIntent(null)
    setRefusedIntent(null)
    setNoteText('')
    setNoteFailure(null)
    currentRoute.current = routeId
  }, [routeId])

  // Every history entry: take its intent and replace the entry without it. The replace is a new
  // location with no intent, so it leaves the pending one alone.
  useEffect(() => {
    const intent = openIntentOf(location.state)
    if (!intent) return
    setPendingIntent(intent)
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: withoutOpenIntent(location.state) },
    )
  }, [location, navigate])

  const loadLogs = useCallback(
    async (documentNo: string) => {
      setLogs(PENDING)
      try {
        const rows = await documentApi.getLogs(documentNo)
        setLogs({ rows: [...rows].sort((a, b) => numericAsc(a.logNo, b.logNo)), loading: false, error: null })
      } catch (err) {
        setLogs({ rows: null, loading: false, error: apiErrorMessage(err, t('log.loadFailed')) })
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
        setJobs({ rows: null, loading: false, error: apiErrorMessage(err, t('jobs.loadFailed')) })
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
        // D11: the palette's Recent remembers the number opened, only once its header has
        // loaded — a record that is not found or is denied never gets here.
        recordRecent({ kind: openedAs, no: routeId })
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
      const { body, post } = updateFor(doc, kind, actionNote, extras)

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

  /**
   * Add note from the composer (D8): today's add-note body, `documentNo` + the note, on the
   * category's own endpoint. The box is read-only while it posts, so what clears is what was
   * sent. Success clears it and re-reads the spine, where the note joins the past as an event
   * row; that is the whole report, so no toast says it again. A failure stays inline under the
   * box, with the server's message and code, and keeps the text.
   *
   * The palette can open another record while the post is on its way. Its answer then belongs to
   * a page that is gone: nothing on the new record is cleared, failed or reloaded, and a failure,
   * having no box left to show under, is toasted with the record it was for.
   */
  async function postNote() {
    const doc = document
    if (!doc || actionBusy || !canPost(composer)) return
    const from = routeId
    const { body, post } = updateFor(doc, 'add-note', noteText)
    setActionRunning(true)
    setNotePosting(true)
    setNoteFailure(null)
    let failure: { err: unknown } | null = null
    try {
      await post(body)
    } catch (err) {
      failure = { err }
    }
    setActionRunning(false)
    setNotePosting(false)
    if (currentRoute.current !== from) {
      if (failure)
        notify.apiError(
          t('composer.failedElsewhere', { documentNo: fsi(doc.documentNo) }),
          failure.err,
          t('composer.failedDetail'),
        )
      return
    }
    if (failure) {
      setNoteFailure({ message: apiErrorMessage(failure.err, t('composer.failedDetail')), code: apiErrorCode(failure.err) })
      return
    }
    setNoteText('')
    void reload()
  }

  const focusComposer = () => composerRef.current?.focus()

  /**
   * Back to the list (D10): history-back when the list opened this record, so its own entry, with
   * its query and current row, is what comes back; otherwise the list route.
   */
  const backToList = () => {
    if (cameFromList(location.state)) void navigate(-1)
    else void navigate('/oms/deliveries')
  }

  function onCommand(kind: CommandKind) {
    if (actionBusy) return
    // Add note focuses the composer (D8); every other command opens its own dialog.
    if (surfaceOf(kind) === 'composer') {
      focusComposer()
      return
    }
    switch (kind) {
      // The note-carrying commands share one dialog: it confirms AND captures
      // the note, so there is no pre-confirm on top of a dialog.
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

  /**
   * What the command bar gates on, built once for the bar and for the open intent, so the
   * intent can only open what the bar's own button would.
   */
  const commandContext: CommandContext | null = document
    ? {
        closeStatus: document.status?.closeStatus,
        documentCategory: document.documentCategory,
        openedAs,
        canReturn: document.canReturn,
        lines: document.lines,
        busy: commandBusy,
      }
    : null

  /**
   * Mark delivered (ticket 2422): `null` hides it — no grant, or not a category-`D` delivery;
   * otherwise its state, disabled with a reason off the delivery's own status. A 403 from the
   * dialog revokes the grant on the shared probe entry, which hides it here again.
   */
  const markDeliveredState = document
    ? markDeliveredGate({
        canMarkDelivered: access.data?.canMarkDelivered,
        documentCategory: document.documentCategory,
        deliveryStatus: document.status?.deliveryStatus,
        closeStatus: document.status?.closeStatus,
        busy: commandBusy,
      })
    : null

  // D9: the intent is consumed once, after the header loads, through the bar's own gate. An
  // allowed one opens its real dialog, or, for add-note, focuses the composer. A refused one
  // opens nothing: the bar rings and focuses its button, which shows its reason, and a warn
  // toast repeats the reason. This render's `onCommand`.
  useEffect(() => {
    if (!pendingIntent || !commandContext || documentLoading || commandContext.busy) return
    setPendingIntent(null)
    const bar = commandBar(commandContext, t)
    const resolved = resolveOpenIntent(pendingIntent, (kind) => commandOf(bar, kind))
    if (!resolved) return
    if (resolved.outcome === 'open') {
      onCommand(resolved.intent)
      return
    }
    setRefusedIntent(resolved.intent)
    notify.warn(t(`actions.${resolved.intent}`), resolved.reason)
  })

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

  // D10: R / C through the bar's own gate, N to the composer, and Esc back to the list, refused
  // while the composer holds unsent text. Each is a palette row too. A denied session registers
  // nothing; until the header loads, only Esc.
  useCommands(
    canOpenDetail
      ? detailCommands({
          context: documentLoading || documentError ? null : commandContext,
          composer,
          singleKeyScreen,
          back: backToList,
          focusComposer,
          command: onCommand,
        })
      : [],
  )

  // The order's files (spec 324, ticket 327): the facts column's Attachments disclosure,
  // drawn only while its gate admits; its list, an AUDITED read, waits on the
  // disclosure's first opening (`useOrderAttachments`).
  const attachments = useOrderAttachments(document, routeId)

  /**
   * The page's own Refresh: the document, Log and Jobs as always — and the order's
   * files only when their disclosure has been opened on this visit. Before that it reads none:
   * every ByOwner is an audit row. Commands reload through `reload` alone, so they
   * never re-read the files.
   */
  const refresh = () => {
    void reload()
    attachments.refresh()
  }

  // ----- access states ------------------------------------------------------
  // After every hook, before any render. The header is not rendered either: a
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

  const shownDocument = documentLoading || documentError ? null : document

  return (
    <section className="flex flex-col gap-2.5">
      {/*
        The page opens on the light header (spec 380 D2, ticket 402): the number, the
        now-step badge, the due/paid tag, the tags and All statuses on line one, the sub-ids
        on line two, Back at its start and Refresh at its end. It renders while the document
        loads and after a failure too — the chevron is this screen's only way out — and the
        command bar sits directly beneath it. Refresh's behaviour is unchanged: spinner in
        place, silent on success, a toast only on failure. While a document loads or has
        failed to, the header shows the route id alone, never the last record's facts.
      */}
      <DocumentHeader document={shownDocument} routeId={routeId}>
        {shownDocument && (
          <Button variant="outlined" disabled={actionRunning || refreshing} onClick={refresh}>
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {t('refresh.button')}
          </Button>
        )}
      </DocumentHeader>

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
              The action bar's grammar (083 D-10, ticket 094): three labelled
              clusters in order of increasing consequence, then the unlabelled
              terminal pair. Gating is evidence-only — `closeStatus` and the
              server's own `canReturn` are the only fields live data proves a
              contradiction on; the server remains the authority on everything
              else and says so in its `400`. `lines` is handed in for the return
              command's REASON split alone (spec 289 D2), never for its gate.
            */}
            {commandContext && (
              <CommandPanel
                context={commandContext}
                onCommand={onCommand}
                refused={refusedIntent}
                onRefusedLeft={() => setRefusedIntent(null)}
                keysOf={hints.bar}
                // A delivery's page only (category `D`, the payload's answer): a central
                // invoice invoices a delivery, and the server refuses anything else anyway.
                onCentralInvoice={
                  canOpenCentralInvoice(centralInvoiceAccess.data) && isDeliveryCategory(document.documentCategory)
                    ? () => setCentralInvoiceOpen(true)
                    : null
                }
                markDelivered={
                  markDeliveredState && {
                    disabled: markDeliveredState.disabled,
                    reason: markDeliveredState.reasonKey === null ? null : t(markDeliveredState.reasonKey),
                    onTake: () => setMarkDeliveredOpen(true),
                  }
                }
              />
            )}

            {/*
              Two columns (spec 380 D4): the activity spine (ticket 403) on the start
              side, about 340–420px, and the facts column (ticket 404) on the end side.
              Grid columns follow the writing direction, so the pair mirrors under RTL.
              From 1280px (`xl`) they sit side by side; below, the spine stacks above,
              its failed-job banners first. 083's tabs and 340px summary rail are gone:
              every fact they held is in one of the two.
            */}
            <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
              <ActivitySpine
                document={document}
                logs={logs}
                jobs={jobs}
                composer={
                  <NoteComposer
                    value={noteText}
                    onChange={setNoteText}
                    state={composer}
                    busy={actionBusy}
                    failure={noteFailure}
                    onPost={() => void postNote()}
                    textareaRef={composerRef}
                    focusKeys={hints.composer}
                  />
                }
              />
              <FactsColumn document={document} attachments={attachments} />
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
              // The return exists. The dialog closes and the delivery beneath it
              // reloads, so the screen the operator comes back to shows the
              // newly-consumed quantities — and the screen STAYS PUT: the toast
              // carries the new return number (spec 289 D8).
              onCreated={() => {
                setReturnOpen(false)
                void reload()
              }}
              document={document}
            />
            {/*
              Nothing reloads after an answer: an accepted delivery is only QUEUED — its
              billing status changes when the billing worker runs, not now.
            */}
            <CentralInvoiceDialog
              open={centralInvoiceOpen}
              onClose={() => setCentralInvoiceOpen(false)}
              deliveryNo={document.documentNo}
            />
            {/*
              The field's own delivered (ADR 0065): on success the delivery reloads, so its new
              status and the DDLR log row with the reason are what the operator sees.
            */}
            <MarkDeliveredDialog
              open={markDeliveredOpen}
              onClose={() => setMarkDeliveredOpen(false)}
              onMarked={() => {
                setMarkDeliveredOpen(false)
                void reload()
              }}
              deliveryNo={document.documentNo}
              amountDue={document.amountDue}
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
