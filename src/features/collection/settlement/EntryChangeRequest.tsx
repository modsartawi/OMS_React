import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FilePenLine, Hourglass, TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
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
  afterRaise,
  cardFor,
  changeRequestBody,
  entryNow,
  historyFailure,
  offerFor,
  raisedRequest,
  type ChangeDraft,
  type EntryNow,
} from './change-request'
import { settlementMoney } from './money-display'
import { REASON_MAX } from './posting'
import ReasonField, { invalidateSettlement } from './ReasonField'

/**
 * **The change-request pane** — an accountant asks to change an entry's amount or
 * Description, and the pane shows the request waiting (spec 342 W2–W8, ticket 343).
 *
 * 🔑 **It never tests a status, a figure or a grant itself.** `offerFor` decides the
 * whole of W3's table and this component draws the cell it is handed — later tickets
 * draw the cells it does not yet (Withdraw 345, Approve / Reject 346, delete and reduce
 * 347, the *applies immediately* sentence 348).
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
 * ⚠️ **Every piece of local state is per entry.** A Reason typed for entry 143 must not
 * be in the box when 151 is selected.
 */
type RaiseVars = { entry: EntryNow; body: SettlementChangeRequestRaiseBody }

/** The last act answer about the entry on screen, and the request it raised (if one waits). */
type Answered = { result: SettlementChangeRequestActResult; request: SettlementChangeRequest | null }

type Notice = { kind: 'refused'; code: string } | { kind: 'error'; text: string }

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
  /** The entry on screen NOW — read by a re-read that resolves after the render it began in. */
  const onScreen = useRef(entryId)
  onScreen.current = entryId

  const history = useQuery({
    queryKey: changeRequestHistoryKey(entryId),
    queryFn: () => settlementApi.changeRequestHistory(entryId),
    enabled: entryId !== '',
    // ⚠️ A 404 (not shipped) or a 403 will not change on a retry — say so at once.
    retry: (count, error) => historyFailure(error) === 'other' && count < 1,
  })

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ChangeDraft>(EMPTY_DRAFT)
  const [answered, setAnswered] = useState<Answered | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  /** A raise answered 404 — the History read may have come from a cache older than the door's removal. */
  const [raiseUnshipped, setRaiseUnshipped] = useState(false)

  useEffect(() => {
    setOpen(false)
    setDraft(EMPTY_DRAFT)
    setAnswered(null)
    setNotice(null)
    setRaiseUnshipped(false)
  }, [entryId])

  // 🚩 A bare 403 on the read: the probe said this session holds the settlement grant,
  // and the door says it no longer does. Re-reading the probe takes the screen's buttons
  // with it.
  const readFailure = history.isError ? historyFailure(history.error) : null
  useEffect(() => {
    if (readFailure === 'forbidden') void queryClient.invalidateQueries({ queryKey: COLLECTION_ACCESS_KEY })
  }, [readFailure, queryClient])

  // ⚠️ The entry travels WITH the request (EntryCorrection's `stillOn`): the selection
  // can change inside one request's latency, and an answer about 143 must never be drawn
  // under 151's header.
  const stillOn = (of: EntryNow) => of.settlementEntryId === entryId

  const raise = useMutation({
    mutationFn: (v: RaiseVars) => settlementApi.raiseChangeRequest(v.body),
    onSuccess: (result, v) => {
      // Always: whatever happened, the branch it happened to is the server's to redraw.
      invalidateSettlement(queryClient, v.entry.storeId)
      const outcome = afterRaise(result)
      if (outcome.kind === 'refused') {
        if (stillOn(v.entry)) setNotice({ kind: 'refused', code: outcome.code })
        return
      }
      toast.success(
        t(outcome.kind === 'applied' ? 'changeRequest.done.applied' : 'changeRequest.done.raised', {
          number: v.entry.entryNumber,
        }),
      )
      const reread = queryClient.invalidateQueries({ queryKey: changeRequestHistoryKey(v.entry.settlementEntryId) })
      if (!stillOn(v.entry)) return
      // 🔑 W8: drawn from the answer NOW — the figures, and the card for a request that waits.
      const mine: Answered = {
        result,
        request:
          outcome.kind === 'waiting'
            ? raisedRequest(v.entry, v.body, result, { staffId: userId ?? '', name: displayName ?? userId ?? '' })
            : null,
      }
      setAnswered(mine)
      setOpen(false)
      setDraft(EMPTY_DRAFT)
      setNotice(null)
      // …then the re-read replaces it, on this entry only, and only if nothing newer was drawn.
      void reread.then(() => {
        if (onScreen.current === v.entry.settlementEntryId) setAnswered((now) => (now === mine ? null : now))
      })
    },
    onError: (error, v) => {
      const failure = historyFailure(error)
      if (failure === 'forbidden') {
        toast.error(t('changeRequest.errors.forbidden'))
        void queryClient.invalidateQueries({ queryKey: COLLECTION_ACCESS_KEY })
        if (stillOn(v.entry)) setOpen(false)
        return
      }
      if (!stillOn(v.entry)) return
      if (failure === 'not-shipped') {
        setRaiseUnshipped(true)
        return
      }
      setNotice({ kind: 'error', text: apiErrorMessage(error, t('changeRequest.errors.raiseFailed')) })
    },
  })

  if (!row) return null

  const now = entryNow(row, history.data, answered?.result)
  const failure = raiseUnshipped ? 'not-shipped' : readFailure
  const offer = offerFor(
    now,
    {
      // The answer is the newer word on the request too: a raise that waits, or one applied at once.
      openRequest: answered ? answered.request : (history.data?.openRequest ?? null),
      spentAmount: now.spentAmount,
    },
    { canOpenSettlement: canOpen, canSuperviseSettlement: canSupervise, userId },
  )
  const state = failure ?? (history.isPending ? 'loading' : offer.kind)
  const money = (v: number | null | undefined) => settlementMoney(v, currencyKey)

  const startChange = () => {
    setDraft({ amount: String(now.amount), description: now.description, reason: '' })
    setNotice(null)
    setOpen(true)
  }

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
      ) : history.isPending ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-loading">
          {t('changeRequest.loading')}
        </p>
      ) : offer.kind === 'finished' ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-finished">
          {t(`changeRequest.finished.${offer.because}`)}
        </p>
      ) : offer.kind === 'unstated' ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-unstated">
          {t('changeRequest.unstated')}
        </p>
      ) : offer.kind === 'read-only' ? (
        <p className="text-sm text-muted-foreground" data-testid="change-request-read-only">
          {t('changeRequest.readOnly')}
        </p>
      ) : offer.kind === 'waiting' ? (
        <WaitingCard request={offer.request} entryNumber={row.entryNumber} money={money} />
      ) : (
        <>
          {notice && (
            <p
              role="status"
              data-testid="change-request-notice"
              data-code={notice.kind === 'refused' ? notice.code : undefined}
              className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {notice.kind === 'refused'
                  ? t('changeRequest.refused', { code: notice.code || '—' })
                  : notice.text}
              </span>
            </p>
          )}
          {open ? (
            <ChangeForm
              entry={now}
              floor={offer.floor}
              mode={offer.mode}
              draft={draft}
              onDraft={setDraft}
              busy={raise.isPending}
              money={money}
              onSubmit={(body) => raise.mutate({ entry: now, body })}
              onBack={() => setOpen(false)}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground" data-testid="change-request-why">
                {t('changeRequest.ask.why', { number: row.entryNumber })}
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
  busy: boolean
  money: (v: number | null | undefined) => string
  onSubmit: (body: SettlementChangeRequestRaiseBody) => void
  onBack: () => void
}) {
  const { t } = useTranslation('settlement')
  const check = changeRequestBody({ ...entry, spentAmount: floor }, draft)
  const held = check.kind === 'held' ? check : null
  const canSend = check.kind === 'ready' && !busy

  return (
    <div className="flex flex-col gap-3" data-testid="change-request-form" data-mode={mode}>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">{t('changeRequest.form.amount.label')}</span>
        <input
          value={draft.amount}
          onChange={(e) => onDraft({ ...draft, amount: e.target.value })}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={held?.amount ? true : undefined}
          data-testid="change-request-amount"
          className={
            'h-9 max-w-xs rounded-md border bg-card px-2 text-sm tabular-nums outline-none focus:border-primary/60 ' +
            (held?.amount ? 'border-attention-border' : 'border-border')
          }
        />
        {held?.amount && (
          <span className="text-xs text-attention-800" data-testid="change-request-amount-error">
            {t(`changeRequest.form.amount.${held.amount}`, { floor: money(floor) })}
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
        error={held?.description ? t(`changeRequest.form.description.${held.description}`, { max: REASON_MAX }) : null}
        testId="change-request-description"
      />

      <ReasonField
        value={draft.reason}
        onValue={(reason) => onDraft({ ...draft, reason })}
        label={t('changeRequest.form.reason.label')}
        hint={t('changeRequest.form.reason.hint', { max: REASON_MAX })}
        required
        testId="change-request-reason"
      />

      {/* Said before the press, not after a refusal: the server's NO_CHANGE, shadowed. */}
      {held?.unchanged && (
        <p className="text-sm text-muted-foreground" data-testid="change-request-unchanged">
          {t('changeRequest.form.unchanged')}
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
 * 🚩 No act yet: Withdraw (345) and Approve / Reject (346) draw the cells `offerFor`
 * already returns.
 */
function WaitingCard({
  request,
  entryNumber,
  money,
}: {
  request: SettlementChangeRequest
  entryNumber: number
  money: (v: number | null | undefined) => string
}) {
  const { t } = useTranslation('settlement')
  const card = cardFor(request)

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
    </div>
  )
}
