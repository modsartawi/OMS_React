import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, FilePenLine, Hourglass, TriangleAlert, Undo2, X } from 'lucide-react'

import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { COLLECTION_ACCESS_KEY } from '@/core/collection/api'
import type {
  SettlementChangeRequest,
  SettlementChangeRequestActResult,
  SettlementChangeRequestRaiseBody,
} from '@/core/models/settlement'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import type { AccountEntryRow } from './account-projection'
import { changeRequestHistoryKey, settlementApi } from './api'
import {
  afterDecide,
  afterRaise,
  afterWithdraw,
  cardFor,
  changeRequestBody,
  changeRequestFailure,
  offerFor,
  paneRead,
  raisedRequest,
  rejectBody,
  type ActAnswer,
  type ChangeDraft,
  type EntryNow,
} from './change-request'
import { changeFieldError, changeRefusal, type ChangeFieldError, type ChangeRefusal } from './change-refusal'
import { settlementMoney } from './money-display'
import { REASON_MAX } from './posting'
import ReasonField, { invalidateSettlement } from './ReasonField'

/**
 * **The change-request pane** — an accountant asks to change an entry's amount or
 * Description, and the pane shows the request waiting (spec 342 W2–W8, ticket 343).
 *
 * 🔑 **It never tests a status, a figure or a grant itself.** `offerFor` decides the
 * whole of W3's table and this component draws the cell it is handed — later tickets
 * draw the cells it does not yet (Approve / Reject 346, delete and reduce 347, the
 * *applies immediately* sentence 348).
 *
 * 🔑 **Withdraw (345) is the cell's `withdraw`**, drawn for the requester only. One press
 * sends `{ changeRequestId }`; a `WITHDRAWN` answer drops the card at once (W8), and a
 * `NOT_REQUESTER` answer feeds the request's id back to `offerFor` (`notRequesterOf`), so
 * the button is not offered beside the sentence that refused it.
 *
 * 🔑 **Approve / Reject (346) are the cell's `decide`**, drawn for a supervisor beside what
 * the branch has spent from the entry TODAY (the History read's `spentAmount`, or a newer
 * answer's). An `APPLIED` answer redraws the entry's figures and drops the card before the
 * re-read lands; a refused approve leaves the card `OPEN` with 344's sentence and its next
 * step. Reject asks for a Reason first. A bare 403 is named and the probe re-read, which
 * takes the buttons with it (W1) — the outcome is never read from the probe.
 *
 * 🔑 **Redraw from the answer, then re-read (W8).** An accepted raise draws the waiting
 * card and the entry's figures from the act answer AT ONCE, then re-reads History (one
 * key, `changeRequestHistoryKey`) and the account (`invalidateSettlement`); the answer
 * is dropped once the re-read lands, so the server's own row replaces the drawn one.
 *
 * ⚠️ **A 404 is SIS.Api not having shipped the wave**, never a crash: the pane says
 * *"not available yet"* and the rest of the panel works as before (spec 342
 * Boundaries). A bare 403 is named and the probe re-read, as `EntryCorrection` does.
 *
 * 🔑 **A refusal is said by its code (W7, ticket 344).** `changeRefusal` words a 200
 * refusal and names the next step, which this pane follows; `changeFieldError` puts a
 * 400 on the box that can fix it. Neither is worded off the server's `message`, which
 * is drawn only for a code the map does not know.
 *
 * ⚠️ **Every piece of local state is per entry.** A Reason typed for entry 143 must not
 * be in the box when 151 is selected — so `BranchAccount` mounts this pane **keyed by the
 * entry id**. A reset in an effect (EntryCorrection's way) runs AFTER the first render
 * of the new entry, which would draw 143's answer and draft under 151's header for one
 * frame; a fresh mount has no such frame.
 */
type RaiseVars = { entry: EntryNow; body: SettlementChangeRequestRaiseBody }
/** The request withdrawn travels with its entry, for the same reason (`stillOn`). */
type WithdrawVars = { entry: EntryNow; request: SettlementChangeRequest }
/** …and so does the request approved or rejected (346), with a reject's Reason. */
type DecideVars = { entry: EntryNow; request: SettlementChangeRequest }
type RejectVars = DecideVars & { reason: string }

/** `invalid` — a 400 with no box to sit on (Withdraw has no form), in 344's words. */
type Notice =
  | { kind: 'refused'; refusal: ChangeRefusal }
  | { kind: 'invalid'; error: ChangeFieldError }
  | { kind: 'error'; text: string }

const EMPTY_DRAFT: ChangeDraft = { amount: '', description: '', reason: '' }

export default function EntryChangeRequest({
  row,
  currencyKey,
  canOpen,
  canSupervise,
}: {
  row: AccountEntryRow | null
  currencyKey: string
  /** `canOpenSettlement` — Raise sits behind it. Hides buttons, guards nothing. */
  canOpen: boolean
  /** `canSuperviseSettlement` — decides the supervisor's cells. Hides buttons, guards nothing. */
  canSupervise: boolean
}) {
  const { t } = useTranslation('settlement')
  const queryClient = useQueryClient()
  const userId = useSession((s) => s.userId)
  const displayName = useSession((s) => s.displayName)

  const entryId = row?.settlementEntryId ?? ''

  const history = useQuery({
    queryKey: changeRequestHistoryKey(entryId),
    queryFn: () => settlementApi.changeRequestHistory(entryId),
    enabled: entryId !== '',
    // ⚠️ A 404 (not shipped) or a 403 will not change on a retry — say so at once.
    retry: (count, error) => changeRequestFailure(error) === 'other' && count < 1,
  })

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ChangeDraft>(EMPTY_DRAFT)
  const [answered, setAnswered] = useState<ActAnswer | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  /** A 400 on the box that can fix it — cleared by the next keystroke. */
  const [fieldError, setFieldError] = useState<ChangeFieldError | null>(null)
  /** `ENTRY_NOT_OPEN`: the entry no longer exists, and the pane draws only that sentence. */
  const [gone, setGone] = useState(false)
  /** A raise or withdraw answered 404 — the History read may have come from a cache older than the door's removal. */
  const [actUnshipped, setActUnshipped] = useState(false)
  /** The request a withdraw was refused `NOT_REQUESTER` on — `offerFor` stops offering Withdraw on it. */
  const [notRequesterOf, setNotRequesterOf] = useState<string | null>(null)
  /** 346: the Reject box is open, what is typed in it, and a 400 that belongs on it. */
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<ChangeFieldError | null>(null)

  // 🚩 A bare 403 on the read: the probe said this session holds the settlement grant,
  // and the door says it no longer does. Re-reading the probe takes the screen's buttons
  // with it.
  const readFailure = history.isError ? changeRequestFailure(history.error) : null
  useEffect(() => {
    if (readFailure === 'forbidden') void queryClient.invalidateQueries({ queryKey: COLLECTION_ACCESS_KEY })
  }, [readFailure, queryClient])

  // ⚠️ The entry travels WITH the request (EntryCorrection's `stillOn`): the selection
  // can change inside one request's latency, and an answer about 143 must never be drawn
  // under 151's header.
  const stillOn = (of: EntryNow) => of.settlementEntryId === entryId

  /** Draw `mine` until `reread` lands — unless something newer was drawn meanwhile. */
  const drawUntil = (reread: Promise<void>, mine: ActAnswer) => {
    setAnswered(mine)
    void reread.then(() => setAnswered((now) => (now === mine ? null : now)))
  }

  const raise = useMutation({
    mutationFn: (v: RaiseVars) => settlementApi.raiseChangeRequest(v.body),
    onSuccess: (result, v) => {
      // Always — a refusal too: whatever happened, the entry and its History are the
      // server's to redraw. A raise refused because a request now waits, or because the
      // entry was finished meanwhile, is answered by the re-read turning this pane into
      // the card or the finished sentence.
      const reread = invalidateSettlement(queryClient, v.entry.storeId)
      const drawUntilReread = (mine: ActAnswer) => drawUntil(reread, mine)
      const outcome = afterRaise(result)
      if (outcome.kind === 'refused') {
        if (!stillOn(v.entry)) return
        const refusal = changeRefusal('raise', result)
        setNotice({ kind: 'refused', refusal })
        setFieldError(null)
        // 🔑 W8 holds for a refusal too: its figures are the entry NOW — a BELOW_SPENT
        // answer's spentAmount is the floor the form redraws with, before History lands.
        drawUntilReread({ result })
        switch (refusal.step.kind) {
          case 'close':
            setGone(true)
            setOpen(false)
            return
          case 'redraw':
          case 'open-request':
          case 'reread':
            // The re-read (always, above) draws the finished sentence or the waiting card.
            setOpen(false)
            return
          case 'refill-floor':
          case 'stay':
          case 'none':
          case 'reject':
          case 'reduce':
          case 'not-requester':
            // The form stays as typed — its floor refilled from the answer for
            // BELOW_SPENT. `reduce` answers only a delete, whose form is 347's.
            return
        }
      }
      toast.success(
        t(outcome.kind === 'applied' ? 'changeRequest.done.applied' : 'changeRequest.done.raised', {
          number: v.entry.entryNumber,
        }),
      )
      if (!stillOn(v.entry)) return
      // 🔑 W8: drawn from the answer NOW — the figures, and the card for a request that waits.
      const mine: ActAnswer = {
        result,
        request:
          outcome.kind === 'waiting'
            ? raisedRequest(v.entry, v.body, result, { staffId: userId ?? '', name: displayName ?? userId ?? '' })
            : null,
      }
      // …then History and the account re-read replace it.
      drawUntilReread(mine)
      setOpen(false)
      setDraft(EMPTY_DRAFT)
      setNotice(null)
      setFieldError(null)
    },
    onError: (error, v) => {
      const failure = changeRequestFailure(error)
      if (failure === 'forbidden') {
        toast.error(t('changeRequest.errors.forbidden'))
        void queryClient.invalidateQueries({ queryKey: COLLECTION_ACCESS_KEY })
        if (stillOn(v.entry)) setOpen(false)
        return
      }
      if (!stillOn(v.entry)) return
      if (failure === 'not-shipped') {
        setActUnshipped(true)
        return
      }
      // A 400 the map knows lands on its box; any other failure keeps the server's words.
      const field = changeFieldError(apiErrorCode(error), v.body)
      if (field) {
        setFieldError(field)
        setNotice(null)
        return
      }
      setNotice({ kind: 'error', text: apiErrorMessage(error, t('changeRequest.errors.raiseFailed')) })
    },
  })

  const withdraw = useMutation({
    mutationFn: (v: WithdrawVars) => settlementApi.withdrawChangeRequest(v.request.changeRequestId),
    onSuccess: (result, v) => {
      // Always — every answer is followed by History and the account re-read (W8).
      const reread = invalidateSettlement(queryClient, v.entry.storeId)
      const outcome = afterWithdraw(result)
      if (outcome.kind === 'withdrawn') {
        toast.success(t('changeRequest.done.withdrawn', { number: v.entry.entryNumber }))
        if (!stillOn(v.entry)) return
        // 🔑 W8: the card goes NOW — the answer says nothing waits, and its figures are
        // the entry's (unchanged) — then History and the account replace it.
        drawUntil(reread, { result, request: null })
        setNotice(null)
        return
      }
      if (!stillOn(v.entry)) return
      // Neither withdrawn nor refused-away: `request` is left unset, so History's word stands.
      drawUntil(reread, { result })
      if (outcome.kind === 'unconfirmed') {
        setNotice({ kind: 'error', text: t('changeRequest.errors.withdrawUnconfirmed') })
        return
      }
      const refusal = changeRefusal('withdraw', result)
      setNotice({ kind: 'refused', refusal })
      if (refusal.step.kind === 'close') setGone(true)
      else if (refusal.step.kind === 'not-requester') setNotRequesterOf(v.request.changeRequestId)
      // Any other step (CHANGE_NOT_OPEN's redraw): the re-read, always above, draws what is true.
    },
    onError: (error, v) => {
      const failure = changeRequestFailure(error)
      if (failure === 'forbidden') {
        toast.error(t('changeRequest.errors.withdrawForbidden'))
        void queryClient.invalidateQueries({ queryKey: COLLECTION_ACCESS_KEY })
        return
      }
      if (!stillOn(v.entry)) return
      if (failure === 'not-shipped') {
        setActUnshipped(true)
        return
      }
      // No form to put a 400 on: 344's sentence goes in the notice line.
      const field = changeFieldError(apiErrorCode(error))
      setNotice(
        field
          ? { kind: 'invalid', error: field }
          : { kind: 'error', text: apiErrorMessage(error, t('changeRequest.errors.withdrawFailed')) },
      )
    },
  })

  /**
   * What a supervisor's approve or reject came back with (346) — one handler for both
   * doors, because both answer the same act response and differ only in their words.
   */
  const onDecided = (door: 'approve' | 'reject', result: SettlementChangeRequestActResult, v: DecideVars) => {
    // Always — every answer is followed by History and the account re-read (W8).
    const reread = invalidateSettlement(queryClient, v.entry.storeId)
    const outcome = afterDecide(door, result)
    if (outcome.kind === 'decided') {
      toast.success(
        t(door === 'approve' ? 'changeRequest.done.approved' : 'changeRequest.done.rejected', {
          number: v.entry.entryNumber,
        }),
      )
      if (!stillOn(v.entry)) return
      // 🔑 W8: the answer's figures NOW — corrected after an approve, untouched after a
      // reject — and no card: the answer says nothing waits. Then the re-read replaces it.
      drawUntil(reread, { result, request: null })
      setNotice(null)
      setRejecting(false)
      setRejectReason('')
      setRejectError(null)
      return
    }
    if (!stillOn(v.entry)) return
    // A refusal says nothing about what waits (`request` unset): the card stays, still
    // OPEN, and the answer's figures are today's — a BELOW_SPENT's `spentAmount` included.
    drawUntil(reread, { result })
    if (outcome.kind === 'unconfirmed') {
      setNotice({
        kind: 'error',
        text: t(door === 'approve' ? 'changeRequest.errors.approveUnconfirmed' : 'changeRequest.errors.rejectUnconfirmed'),
      })
      return
    }
    const refusal = changeRefusal(door, result)
    setNotice({ kind: 'refused', refusal })
    setRejectError(null)
    if (refusal.step.kind === 'close') setGone(true)
    // `reject` (the entry outran the request): the card and its Reject stay, and the
    // notice names the step. Any other step (CHANGE_NOT_OPEN's redraw): the re-read,
    // always above, draws what is true.
  }

  const onDecideError = (door: 'approve' | 'reject', error: unknown, v: DecideVars) => {
    const failure = changeRequestFailure(error)
    if (failure === 'forbidden') {
      // 🚩 W1: named, and the probe re-read — which takes Approve / Reject with it. The
      // outcome is never decided from the probe; this only says the door refused.
      toast.error(t('changeRequest.errors.decideForbidden'))
      void queryClient.invalidateQueries({ queryKey: COLLECTION_ACCESS_KEY })
      if (stillOn(v.entry)) {
        setRejecting(false)
        setRejectError(null)
      }
      return
    }
    if (!stillOn(v.entry)) return
    if (failure === 'not-shipped') {
      setActUnshipped(true)
      return
    }
    // A Reason the server refused lands on the Reject box; any other 400 in the notice line.
    const field = changeFieldError(apiErrorCode(error))
    if (field?.field === 'reason' && door === 'reject') {
      setRejectError(field)
      setNotice(null)
      return
    }
    setNotice(
      field
        ? { kind: 'invalid', error: field }
        : {
            kind: 'error',
            text: apiErrorMessage(
              error,
              t(door === 'approve' ? 'changeRequest.errors.approveFailed' : 'changeRequest.errors.rejectFailed'),
            ),
          },
    )
  }

  const approve = useMutation({
    mutationFn: (v: DecideVars) => settlementApi.approveChangeRequest(v.request.changeRequestId),
    onSuccess: (result, v) => onDecided('approve', result, v),
    onError: (error, v) => onDecideError('approve', error, v),
  })

  const reject = useMutation({
    mutationFn: (v: RejectVars) => settlementApi.rejectChangeRequest(v.request.changeRequestId, v.reason),
    onSuccess: (result, v) => onDecided('reject', result, v),
    onError: (error, v) => onDecideError('reject', error, v),
  })

  if (!row) return null

  // 🔑 W8: an answer is the newer word on the figures AND on the request — one that a raise
  // stored, or one applied, rejected or withdrawn. A refusal says nothing about what waits.
  const read = paneRead(row, history.data, answered)
  const now = read.now
  const failure = actUnshipped ? 'not-shipped' : readFailure
  const offer = offerFor(
    now,
    { ...read, notRequesterOf },
    { canOpenSettlement: canOpen, canSuperviseSettlement: canSupervise, userId },
  )
  /** One act at a time on the card — a press while another runs is ignored. */
  const cardBusy = withdraw.isPending || approve.isPending || reject.isPending
  const state = failure ?? (gone ? 'gone' : history.isPending ? 'loading' : offer.kind)
  const money = (v: number | null | undefined) => settlementMoney(v, currencyKey)

  const startChange = () => {
    setDraft({ amount: String(now.amount), description: now.description, reason: '' })
    setNotice(null)
    setFieldError(null)
    setOpen(true)
  }
  const onDraft = (next: ChangeDraft) => {
    setDraft(next)
    setFieldError(null)
  }

  const noticeLine = notice && (
    <p
      role="status"
      data-testid="change-request-notice"
      data-code={
        notice.kind === 'refused' ? notice.refusal.code : notice.kind === 'invalid' ? notice.error.code : undefined
      }
      data-step={notice.kind === 'refused' ? notice.refusal.step.kind : undefined}
      className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {notice.kind === 'error'
          ? notice.text
          : notice.kind === 'invalid'
            ? t(`changeRequest.invalid.${notice.error.sentence}`, { max: REASON_MAX })
            : notice.refusal.words.kind === 'message'
              ? notice.refusal.words.text
              : t(`changeRequest.refusal.${notice.refusal.words.key}`, {
                  number: row.entryNumber,
                  spent: money(notice.refusal.spent),
                  code: notice.refusal.code,
                })}
        {/* 346: a refused approve's way on — 344's step, said beside its sentence. */}
        {notice.kind === 'refused' && notice.refusal.step.kind === 'reject' && (
          <span className="mt-1 block" data-testid="change-request-notice-step">
            {t('changeRequest.step.reject')}
          </span>
        )}
      </span>
    </p>
  )

  return (
    <section
      data-region="entry-change-request"
      data-entry={row.entryNumber}
      data-offer={state}
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{t('changeRequest.title')}</h2>
        <span className="font-mono text-[12px] text-muted-foreground">
          {t('changeRequest.forEntry', { number: row.entryNumber })}
        </span>
      </header>

      {failure === 'not-shipped' ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-unavailable">
          {t('changeRequest.unavailable')}
        </p>
      ) : failure === 'forbidden' ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-forbidden">
          {t('changeRequest.errors.readForbidden')}
        </p>
      ) : failure === 'other' ? (
        <ErrorBanner
          message={apiErrorMessage(history.error, t('changeRequest.errors.loadFailed'))}
          className="p-3"
        />
      ) : gone ? (
        noticeLine
      ) : history.isPending ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-loading">
          {t('changeRequest.loading')}
        </p>
      ) : offer.kind === 'finished' ? (
        <>
          {noticeLine}
          <p className="text-sm text-muted-foreground" data-testid="change-request-finished">
            {t(`changeRequest.finished.${offer.because}`)}
          </p>
        </>
      ) : offer.kind === 'unstated' ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-unstated">
          {t('changeRequest.unstated')}
        </p>
      ) : offer.kind === 'read-only' ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-read-only">
          {t('changeRequest.readOnly')}
        </p>
      ) : offer.kind === 'waiting' ? (
        <>
          {noticeLine}
          <WaitingCard
            request={offer.request}
            entryNumber={row.entryNumber}
            money={money}
            withdraw={
              offer.withdraw
                ? {
                    busy: cardBusy,
                    onWithdraw: () => {
                      if (cardBusy) return
                      setNotice(null)
                      withdraw.mutate({ entry: now, request: offer.request })
                    },
                  }
                : null
            }
            decide={
              offer.decide
                ? {
                    busy: cardBusy,
                    spent: now.spentAmount,
                    amount: now.amount,
                    rejecting,
                    reason: rejectReason,
                    reasonError: rejectError,
                    onApprove: () => {
                      if (cardBusy) return
                      setNotice(null)
                      approve.mutate({ entry: now, request: offer.request })
                    },
                    onStartReject: () => {
                      if (cardBusy) return
                      setNotice(null)
                      setRejecting(true)
                    },
                    onReason: (next) => {
                      setRejectReason(next)
                      setRejectError(null)
                    },
                    onReject: (reason) => {
                      if (cardBusy) return
                      setNotice(null)
                      reject.mutate({ entry: now, request: offer.request, reason })
                    },
                    onBack: () => {
                      setRejecting(false)
                      setRejectError(null)
                    },
                  }
                : null
            }
          />
        </>
      ) : (
        <>
          {noticeLine}
          {open ? (
            <ChangeForm
              entry={now}
              floor={offer.floor}
              mode={offer.mode}
              draft={draft}
              onDraft={onDraft}
              fieldError={fieldError}
              busy={raise.isPending}
              money={money}
              onSubmit={(body) => raise.mutate({ entry: now, body })}
              onBack={() => setOpen(false)}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground" data-testid="change-request-why">
                {/* ⚠️ Per mode: a supervisor's own change applies at once (2194), so the
                    accountant's "a supervisor approves it" would be false for them. */}
                {t(offer.mode === 'now' ? 'changeRequest.ask.whyNow' : 'changeRequest.ask.why', {
                  number: row.entryNumber,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={startChange}
                  data-testid="change-request-open"
                  data-mode={offer.mode}
                >
                  <FilePenLine className="h-3.5 w-3.5" aria-hidden />
                  {t(offer.mode === 'now' ? 'changeRequest.ask.now' : 'changeRequest.ask.request')}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

/**
 * **The change form (W4)** — the entry's current amount and Description filled in, the
 * floor named, a required Reason, and Submit held while nothing differs.
 *
 * 🔑 `changeRequestBody` decides what may be sent and what is; this draws its answer.
 */
function ChangeForm({
  entry,
  floor,
  mode,
  draft,
  onDraft,
  fieldError,
  busy,
  money,
  onSubmit,
  onBack,
}: {
  entry: EntryNow
  floor: number
  mode: 'request' | 'now'
  draft: ChangeDraft
  onDraft: (next: ChangeDraft) => void
  /** The server's 400, on its box (ticket 344) — the form's own check outranks it. */
  fieldError: ChangeFieldError | null
  busy: boolean
  money: (v: number | null | undefined) => string
  onSubmit: (body: SettlementChangeRequestRaiseBody) => void
  onBack: () => void
}) {
  const { t } = useTranslation('settlement')
  const check = changeRequestBody({ ...entry, spentAmount: floor }, draft)
  const held = check.kind === 'held' ? check : null
  const canSend = check.kind === 'ready' && !busy
  /** The server's sentence for a 400 on `field`, or `null`. */
  const served = (field: ChangeFieldError['field']) =>
    fieldError?.field === field ? t(`changeRequest.invalid.${fieldError.sentence}`, { max: REASON_MAX }) : null
  // ⚠️ The day box is 349's; until it exists a day's 400 is said at the foot of the form.
  const formError = served('form') ?? served('businessDay')
  const amountError = held?.amount
    ? t(`changeRequest.form.amount.${held.amount}`, { floor: money(floor) })
    : served('amount')

  return (
    <div className="flex flex-col gap-3" data-testid="change-request-form" data-mode={mode}>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">{t('changeRequest.form.amount.label')}</span>
        <input
          value={draft.amount}
          onChange={(e) => onDraft({ ...draft, amount: e.target.value })}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={amountError ? true : undefined}
          data-testid="change-request-amount"
          className={
            'h-9 max-w-xs rounded-md border bg-card px-2 text-sm tabular-nums outline-none focus:border-primary/60 ' +
            (amountError ? 'border-attention-border' : 'border-border')
          }
        />
        {amountError && (
          <span className="text-xs text-attention-800" data-testid="change-request-amount-error">
            {amountError}
          </span>
        )}
        <span className="text-xs text-muted-foreground" data-testid="change-request-floor">
          {t('changeRequest.form.amount.floor', { floor: money(floor) })}
        </span>
      </label>

      <ReasonField
        value={draft.description}
        onValue={(description) => onDraft({ ...draft, description })}
        label={t('changeRequest.form.description.label')}
        hint={t('changeRequest.form.description.hint', { max: REASON_MAX })}
        required
        error={
          held?.description
            ? t(`changeRequest.form.description.${held.description}`, { max: REASON_MAX })
            : served('description')
        }
        testId="change-request-description"
      />

      <ReasonField
        value={draft.reason}
        onValue={(reason) => onDraft({ ...draft, reason })}
        label={t('changeRequest.form.reason.label')}
        hint={t('changeRequest.form.reason.hint', { max: REASON_MAX })}
        required
        error={served('reason')}
        testId="change-request-reason"
      />

      {/* Said before the press, not after a refusal: the server's NO_CHANGE, shadowed. */}
      {held?.unchanged && (
        <p className="text-sm text-muted-foreground" data-testid="change-request-unchanged">
          {t('changeRequest.form.unchanged')}
        </p>
      )}

      {formError && (
        <p
          role="alert"
          className="text-sm text-attention-800"
          data-testid="change-request-form-error"
          data-code={fieldError?.code}
        >
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => canSend && onSubmit(check.body)}
          aria-disabled={!canSend || undefined}
          data-testid="change-request-submit"
        >
          {t(mode === 'now' ? 'changeRequest.form.submit.now' : 'changeRequest.form.submit.request', {
            number: entry.entryNumber,
          })}
        </Button>
        <Button variant="text" onClick={onBack} data-testid="change-request-back">
          {t('changeRequest.form.back')}
        </Button>
      </div>
    </div>
  )
}

/**
 * **The waiting-request card (W6)** — kind, old → new (only what differs), who asked
 * and when, the Reason, and that the entry keeps working at its current figures.
 *
 * 🔑 **Withdraw and Approve / Reject are drawn only when handed** — `offerFor`'s
 * `withdraw` and `decide` cells, never a test here.
 */
function WaitingCard({
  request,
  entryNumber,
  money,
  withdraw,
  decide,
}: {
  request: SettlementChangeRequest
  entryNumber: number
  money: (v: number | null | undefined) => string
  /** The requester's act (345) — `null` when `offerFor` did not offer it. */
  withdraw: { busy: boolean; onWithdraw: () => void } | null
  /** A supervisor's acts (346) — `null` when `offerFor` did not offer them. */
  decide: {
    busy: boolean
    /** The server's spent figure TODAY (History, or a newer answer) — `null` when unsaid. */
    spent: number | null
    amount: number
    rejecting: boolean
    reason: string
    /** The server's 400 on the Reason, in 344's words. */
    reasonError: ChangeFieldError | null
    onApprove: () => void
    onStartReject: () => void
    onReason: (next: string) => void
    onReject: (reason: string) => void
    onBack: () => void
  } | null
}) {
  const { t } = useTranslation('settlement')
  const card = cardFor(request)
  // `rejectBody` decides whether the Reason may be sent; the box only draws its answer.
  const rejectCheck = decide ? rejectBody(request, decide.reason) : null
  const rejectReady = rejectCheck?.kind === 'ready' && !decide?.busy ? rejectCheck.body : null

  return (
    <div
      className="flex flex-col gap-2 text-sm"
      data-testid="change-request-card"
      data-request={request.changeRequestId}
      data-kind={card.kind}
    >
      <p className="flex items-start gap-2">
        <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium">{t(`changeRequest.card.waiting.${card.kind}`, { number: entryNumber })}</span>
      </p>

      {card.changes.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          {card.changes.map((c) => (
            <div key={c.field} className="contents" data-testid={`change-request-card-${c.field}`}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(`changeRequest.card.field.${c.field}`)}
              </dt>
              <dd dir="auto" className={c.field === 'amount' ? 'tabular-nums' : undefined}>
                {c.field === 'amount'
                  ? t('changeRequest.card.fromTo', { from: money(c.from), to: money(c.to) })
                  : c.field === 'businessDay'
                    ? t('changeRequest.card.fromTo', { from: formatDay(c.from), to: formatDay(c.to) })
                    : t('changeRequest.card.fromTo', { from: c.from, to: c.to })}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className="text-muted-foreground" data-testid="change-request-card-by">
        {card.at
          ? t('changeRequest.card.askedAt', { by: card.by, at: formatDateTime(card.at) })
          : t('changeRequest.card.asked', { by: card.by })}
      </p>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">{t('changeRequest.card.reason')}</span>
        {/* Server text, routinely Arabic — `dir="auto"` on its own element. */}
        <blockquote
          dir="auto"
          className="rounded-md border border-border/60 bg-muted/30 p-2.5"
          data-testid="change-request-card-reason"
        >
          {card.reason || t('changeRequest.card.noReason')}
        </blockquote>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="change-request-card-live">
        {t('changeRequest.card.live', { number: entryNumber })}
      </p>
      {withdraw && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            variant="secondary"
            onClick={withdraw.onWithdraw}
            aria-disabled={withdraw.busy || undefined}
            aria-busy={withdraw.busy || undefined}
            data-testid="change-request-withdraw"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {t('changeRequest.card.withdraw')}
          </Button>
          <span className="text-xs text-muted-foreground">{t('changeRequest.card.withdrawHint')}</span>
        </div>
      )}
      {decide && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-2" data-testid="change-request-decide">
          {/* Story 16: judged against TODAY's figures — the server's spent, never one computed here. */}
          <p className="tabular-nums" data-testid="change-request-spent-now">
            {decide.spent === null
              ? t('changeRequest.card.spentUnstated', { number: entryNumber })
              : t('changeRequest.card.spentNow', {
                  number: entryNumber,
                  spent: money(decide.spent),
                  amount: money(decide.amount),
                })}
          </p>
          {decide.rejecting ? (
            <div className="flex flex-col gap-2" data-testid="change-request-reject-form">
              <ReasonField
                value={decide.reason}
                onValue={decide.onReason}
                label={t('changeRequest.reject.reason.label')}
                hint={t('changeRequest.reject.reason.hint', { max: REASON_MAX })}
                required
                error={
                  decide.reasonError
                    ? t(`changeRequest.invalid.${decide.reasonError.sentence}`, { max: REASON_MAX })
                    : null
                }
                testId="change-request-reject-reason"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() => rejectReady && decide.onReject(rejectReady.reason)}
                  aria-disabled={!rejectReady || undefined}
                  aria-busy={decide.busy || undefined}
                  data-testid="change-request-reject-submit"
                >
                  {t('changeRequest.reject.submit', { number: entryNumber })}
                </Button>
                <Button variant="text" onClick={decide.onBack} data-testid="change-request-reject-back">
                  {t('changeRequest.reject.back')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                variant="primary"
                onClick={decide.onApprove}
                aria-disabled={decide.busy || undefined}
                aria-busy={decide.busy || undefined}
                data-testid="change-request-approve"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {t('changeRequest.card.approve')}
              </Button>
              <Button
                variant="secondary"
                onClick={decide.onStartReject}
                aria-disabled={decide.busy || undefined}
                data-testid="change-request-reject"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {t('changeRequest.card.reject')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t('changeRequest.card.decideHint', { number: entryNumber })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
