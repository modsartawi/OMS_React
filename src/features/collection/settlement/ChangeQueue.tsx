import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { COLLECTION_ACCESS_KEY } from '@/core/collection/api'
import type {
  SettlementChangeQueueRow,
  SettlementChangeRequestActResult,
  SettlementChangeRequestRejectBody,
} from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import { OMS_GRID_HEADER_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { settlementApi } from './api'
import { AccountShimmer, Nothing } from './AccountStates'
import { withEntryNow, withoutRequest, type ChangeQueue as Queue, type ChangeQueueRow } from './change-queue'
import { AskedLines, buildChangeQueueColumns, changeQueueRowId, entryNumberWords, refusalWords } from './change-queue-columns'
import { afterDecide, changeRequestFailure, rejectBody, type DecideDoor } from './change-request'
import { changeFieldError, changeRefusal, type ChangeFieldError, type ChangeRefusal } from './change-refusal'
import { CHANGE_QUEUE_KEY } from './open-lane'
import { REASON_MAX } from './posting'
import ReasonField, { invalidateSettlement } from './ReasonField'

/** What a reject is sent with — captured at the press, so a queue that re-reads under the
 *  dialog cannot change which request the answer is reported against. */
type RejectVars = { row: ChangeQueueRow; body: SettlementChangeRequestRejectBody }

/**
 * **The Change requests tab** of Open settlements (ticket 353, spec 342 W9 / stories
 * 19–20) — every change or delete request waiting in the estate, oldest first, decided
 * inline. Drawn only for a session holding settlement supervision (`openTabs`).
 *
 * 🔑 **The acts are 346's, the words are 344's.** Approve sends `{ changeRequestId }`,
 * Reject `rejectBody`'s `{ changeRequestId, reason }` after a Reason (≤ 200) in a dialog;
 * `afterDecide` reads the answer and `changeRefusal` words a refusal. Nothing here keeps a
 * second code table or reads the outcome from the probe (W1).
 *
 * - **Decided** (`APPLIED` / `REJECTED`): the row leaves the answer on screen at once,
 *   then the queue, History and the lanes are re-read (W8, `invalidateSettlement`).
 * - **Refused**: the request **stays in the queue**, its refusal said on its row (story
 *   20) — a `BELOW_SPENT` with today's spent figure and the *reject it* step. A refusal
 *   that says the request or entry is gone (`redraw` / `close`) is also toasted, because
 *   the re-read takes the row — and the sentence on it — away.
 * - **A bare 403** is named and the probe re-read, which takes the tab with it. **A 404**
 *   is SIS.Api without the acts: said, nothing changed.
 *
 * 🔑 **Opening a row opens the entry's branch account panel** (`onRow`), landing on the
 * entry — a request whose entry is missing lands on the branch.
 */
export default function ChangeQueue({
  queue,
  built,
  onRow,
}: {
  queue: { isPending: boolean; error: unknown }
  built: Queue
  onRow: (row: ChangeQueueRow) => void
}) {
  const { t } = useTranslation('settlement')
  const queryClient = useQueryClient()
  /** The refusal last answered for a request, by its id — said on its row (story 20). */
  const [refusals, setRefusals] = useState<ReadonlyMap<string, ChangeRefusal>>(new Map())
  /** The row Reject was pressed on, and the server's 400 on its Reason. */
  const [rejecting, setRejecting] = useState<{ row: ChangeQueueRow; error: ChangeFieldError | null } | null>(null)

  const setRefusal = (id: string, refusal: ChangeRefusal | null) =>
    setRefusals((m) => {
      const next = new Map(m)
      if (refusal) next.set(id, refusal)
      else next.delete(id)
      return next
    })

  const onDecided = (door: DecideDoor, result: SettlementChangeRequestActResult, row: ChangeQueueRow) => {
    const id = row.changeRequestId
    const number = entryNumberWords(t, row)
    const outcome = afterDecide(door, result)
    if (outcome.kind === 'decided') {
      // 🔑 W8: the answer says it is decided — the row goes now, before the re-read lands.
      queryClient.setQueryData<SettlementChangeQueueRow[]>(CHANGE_QUEUE_KEY, (rows) => withoutRequest(rows, id))
      toast.success(t(door === 'approve' ? 'changeRequest.done.approved' : 'changeRequest.done.rejected', { number }))
      setRefusal(id, null)
    } else if (outcome.kind === 'unconfirmed') {
      toast.warning(
        t(door === 'approve' ? 'changeRequest.errors.approveUnconfirmed' : 'changeRequest.errors.rejectUnconfirmed'),
      )
    } else {
      const refusal = changeRefusal(door, result)
      // Story 20: the request stays waiting — its refusal is said on its row, and (W8) the
      // row's entry figures are the answer's at once, so a BELOW_SPENT never stands beside
      // an older spent figure.
      setRefusal(id, refusal)
      queryClient.setQueryData<SettlementChangeQueueRow[]>(CHANGE_QUEUE_KEY, (rows) => withEntryNow(rows, result))
      if (refusal.step.kind === 'redraw' || refusal.step.kind === 'close')
        toast.warning(refusalWords(t, refusal, row))
    }
    setRejecting(null)
    // Always — every answer is followed by the queue, History, the account and the lanes (W8).
    void invalidateSettlement(queryClient, row.storeId)
  }

  const onDecideError = (door: DecideDoor, error: unknown, row: ChangeQueueRow) => {
    const failure = changeRequestFailure(error)
    if (failure === 'forbidden') {
      // 🚩 W1: named, and the probe re-read — which takes the tab and its buttons with it.
      toast.error(t('changeRequest.errors.decideForbidden'))
      void queryClient.invalidateQueries({ queryKey: COLLECTION_ACCESS_KEY })
      setRejecting(null)
      return
    }
    if (failure === 'not-shipped') {
      toast.error(t('open.changes.actUnavailable'))
      setRejecting(null)
      return
    }
    const field = changeFieldError(apiErrorCode(error))
    // A Reason the server refused lands on the Reject box, the dialog kept open as typed —
    // while that box is still open. Closed under the press, it is said in the toast below.
    if (field?.field === 'reason' && door === 'reject' && rejecting?.row.changeRequestId === row.changeRequestId) {
      setRejecting((r) => (r && r.row.changeRequestId === row.changeRequestId ? { ...r, error: field } : r))
      return
    }
    toast.error(
      field
        ? t(`changeRequest.invalid.${field.sentence}`, { max: REASON_MAX })
        : apiErrorMessage(error, t(door === 'approve' ? 'changeRequest.errors.approveFailed' : 'changeRequest.errors.rejectFailed')),
    )
  }

  const approve = useMutation({
    mutationFn: (row: ChangeQueueRow) => settlementApi.approveChangeRequest(row.changeRequestId),
    onSuccess: (result, row) => onDecided('approve', result, row),
    onError: (error, row) => onDecideError('approve', error, row),
  })
  const reject = useMutation({
    mutationFn: (v: RejectVars) => settlementApi.rejectChangeRequest(v.body),
    onSuccess: (result, v) => onDecided('reject', result, v.row),
    onError: (error, v) => onDecideError('reject', error, v.row),
  })
  /** One act at a time on the queue — a press while another runs is ignored. */
  const busy = approve.isPending || reject.isPending

  const columns = useMemo(
    () =>
      buildChangeQueueColumns(t, {
        busy,
        refusals,
        onApprove: (row) => approve.mutate(row),
        onReject: (row) => setRejecting({ row, error: null }),
      }),
    // `approve.mutate` is stable across renders (TanStack Query).
    [t, busy, refusals],
  )
  const defaultColDef = useMemo(
    () => ({
      ...OMS_GRID_BASE_COL_DEF,
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
      cellDataType: false,
    }),
    [],
  )

  if (queue.isPending) return <AccountShimmer label={t('open.loadingChanges')} />

  if (built.view.kind === 'failed') {
    // ⚠️ A 404 is SIS.Api without 2285 — said as *not available yet*, never as a failure.
    const failure = changeRequestFailure(queue.error)
    if (failure === 'not-shipped')
      return (
        <p className="text-sm text-muted-foreground" data-testid="change-queue-unavailable">
          {t('open.changes.unavailable')}
        </p>
      )
    if (failure === 'forbidden')
      return (
        <p className="text-sm text-muted-foreground" data-testid="change-queue-forbidden">
          {t('open.changes.forbidden')}
        </p>
      )
    return <ErrorBanner message={apiErrorMessage(queue.error, t('open.errors.changesFailed'))} className="p-3" />
  }

  if (built.view.kind === 'empty')
    return <Nothing title={t('open.empty.changes.title')} hint={t('open.empty.changes.hint')} testId="open-empty" />

  const rows = built.view.rows

  return (
    <section className="flex flex-col gap-2" data-region="change-queue">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
          {t('open.changes.title')}
        </h3>
        <span
          data-testid="change-queue-count"
          className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
        >
          {rows.length.toLocaleString('en-US')}
        </span>
      </div>
      <div>
        <AgGridReact<ChangeQueueRow>
          theme={omsGridTheme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          // 🚩 The whole queue, unvirtualised: rows size themselves (`autoHeight` — a refusal,
          // a three-field change, a long Reason), which a fixed frame would cut. The queue
          // is small by nature (2285) and capped at 500.
          domLayout="autoHeight"
          animateRows={false}
          getRowId={changeQueueRowId}
          // Opens the entry's branch account — except from a button of the row's own.
          onRowClicked={(e) =>
            e.data &&
            !(e.event?.target instanceof Element && e.event.target.closest('[data-row-action]')) &&
            onRow(e.data)
          }
          rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
        />
      </div>

      {rejecting && (
        <RejectDialog
          // A fresh box per request: a Reason typed about one must not be in the box for the next.
          key={rejecting.row.changeRequestId}
          row={rejecting.row}
          busy={reject.isPending}
          error={rejecting.error}
          onReject={(body) => reject.mutate({ row: rejecting.row, body })}
          // The server's 400 on the Reason clears on the next keystroke, as on the card.
          onEdit={() => setRejecting((r) => r && (r.error ? { ...r, error: null } : r))}
          onClose={() => setRejecting(null)}
        />
      )}
    </section>
  )
}

/**
 * **Reject, with a Reason** (story 19) — the request on screen before the press (what is
 * asked, by whom, why), and the Reason box the accountant who raised it will read.
 * `rejectBody` decides whether it may be sent; a 400 on the Reason lands on the box.
 */
function RejectDialog({
  row,
  busy,
  error,
  onReject,
  onEdit,
  onClose,
}: {
  row: ChangeQueueRow
  busy: boolean
  error: ChangeFieldError | null
  onReject: (body: SettlementChangeRequestRejectBody) => void
  onEdit: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('settlement')
  const [reason, setReason] = useState('')
  const check = rejectBody(row.request, reason)
  const ready = check.kind === 'ready' && !busy ? check.body : null

  return (
    <Modal
      open
      onClose={onClose}
      title={
        row.entryNumber === null
          ? t('open.changes.reject.titleMissing')
          : t('open.changes.reject.title', { number: row.entryNumber })
      }
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('open.changes.reject.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => ready && onReject(ready)}
            aria-disabled={!ready || undefined}
            aria-busy={busy || undefined}
            data-testid="change-queue-reject-submit"
          >
            {t('changeRequest.reject.submit', { number: entryNumberWords(t, row) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-region="change-queue-reject" data-request={row.changeRequestId}>
        <p className="font-medium">
          <span dir="auto">{row.storeName}</span>{' '}
          <span className="font-mono text-[12px] text-muted-foreground">{row.storeId}</span>
        </p>
        <div className="flex flex-col gap-0.5">
          <AskedLines row={row} />
        </div>
        <blockquote dir="auto" className="rounded-md border border-border/60 bg-muted/30 p-2.5">
          {row.reason || t('changeRequest.card.noReason')}
        </blockquote>
        <ReasonField
          value={reason}
          onValue={(next) => {
            setReason(next)
            onEdit()
          }}
          label={t('changeRequest.reject.reason.label')}
          hint={t('changeRequest.reject.reason.hint', { max: REASON_MAX })}
          required
          error={error ? t(`changeRequest.invalid.${error.sentence}`, { max: REASON_MAX }) : null}
          testId="change-queue-reject-reason"
        />
      </div>
    </Modal>
  )
}
