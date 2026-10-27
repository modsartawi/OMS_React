import { useId, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { ApiError, apiErrorCode, apiErrorKind, apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleSessionLookup, RuleSessionState, RuleSupportCancelReply } from '@/core/models/rule-session'
import { RULE_SESSIONS_KEY, rememberCancelledSession, ruleCampaignApi } from '@/core/rules/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { formatNumber } from '@/core/util/number-format'
import { CANCEL_REASON_MAX, cancelBody, cancelFailure, isStaleRefusal, mayHaveLanded, pressRequestId, reasonProblem, type PreviousPress } from './cancel'
import { BudgetEventText, MovementText } from './session-ui'
import { momentText } from './timeline'

/**
 * Cancel session (tickets 518, 527): the confirmation says what a cancel does to a session in this
 * state and asks why — the reason is required (at most 500 characters) and HQ keeps it with the
 * call. HQ does it (`POST Rules/Support/Cancel { sessionId, requestId, reason }`, BackOffice 2760)
 * and answers the rollback and the session after, which the page then shows. Each press sends a new
 * request id, but a retry of a press HQ never answered sends the same one, so a cancel that did land
 * comes back `repeated` and moves nothing twice. A refusal shows here, verbatim, with its code; a
 * bare 403 (no `RuleSupport` 02 grant) says so.
 */
export default function CancelSessionDialog({
  saleId,
  state,
  onClose,
  onCancelled,
}: {
  saleId: string
  state: RuleSessionState
  onClose: () => void
  onCancelled: (result: RuleSupportCancelReply) => void
}) {
  const { t } = useTranslation('rule-sessions')
  const queryClient = useQueryClient()
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const [press, setPress] = useState<PreviousPress | null>(null)
  const cancel = useMutation({
    mutationFn: (requestId: string) => ruleCampaignApi.cancelSession(cancelBody(saleId, requestId, reason)),
    onError: (err, requestId) => {
      setPress({ requestId, failure: apiErrorKind(err), statusCode: err instanceof ApiError ? err.statusCode : 0 })
      // The session moved on: it and the lists are read afresh, and this dialog has nothing left to send.
      if (isStaleRefusal(apiErrorCode(err))) void queryClient.invalidateQueries({ queryKey: RULE_SESSIONS_KEY })
    },
    onSuccess: (result) => {
      rememberCancelledSession(queryClient, saleId, result.session)
      onCancelled(result)
    },
  })
  const close = () => {
    if (!cancel.isPending) onClose()
  }
  const problem = reasonProblem(reason)
  const confirm = () => {
    setTried(true)
    if (problem) return
    cancel.mutate(pressRequestId(press))
  }
  const code = cancel.isError ? apiErrorCode(cancel.error) : null
  const stale = isStaleRefusal(code)
  // A press that may have landed is retried as it was: same id, same reason.
  const retrying = !!press && mayHaveLanded(press)
  const failure = cancel.isError ? cancelFailure(code, isBareDenial(cancel.error)) : null
  const message = failure === 'denied' ? t('cancel.denied') : apiErrorMessage(cancel.error, t('cancel.refused'))
  const returns = state === 'closed' || state === 'partiallyReturned'

  const bad = tried && !!problem
  const reasonNote = (
    <>
      {retrying ? (
        t('cancel.reasonKept')
      ) : tried && problem === 'required' ? (
        t('cancel.reasonRequired')
      ) : (
        <Trans
          t={t}
          i18nKey={problem === 'tooLong' ? 'cancel.reasonTooLong' : 'cancel.reasonHint'}
          values={{ n: formatNumber(reason.trim().length), max: formatNumber(CANCEL_REASON_MAX) }}
          components={{ v: <bdi dir="ltr" /> }}
        />
      )}
    </>
  )

  return (
    <Modal
      open
      onClose={close}
      title={t('cancel.title')}
      width="34rem"
      footer={
        <>
          <Button variant="text" disabled={cancel.isPending} onClick={close}>
            {t('cancel.keep')}
          </Button>
          <Button variant="danger" disabled={cancel.isPending || stale} onClick={confirm} data-session-cancel-confirm="">
            {cancel.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('cancel.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-session-cancel={saleId}>
        <p>
          <Trans t={t} i18nKey={returns ? 'cancel.bodyReturn' : 'cancel.bodyPaying'} values={{ saleId }} components={{ v: <bdi dir="ltr" className="font-mono" /> }} />
        </p>
        {/* The reason's counter line turns into its error once Confirm has been tried: one line, one hook. */}
        <Field
          id={reasonId}
          label={t('cancel.reason')}
          hint={bad ? undefined : <span data-session-cancel-reason-hint="">{reasonNote}</span>}
          error={bad ? <span data-session-cancel-reason-hint={problem}>{reasonNote}</span> : undefined}
        >
          <Textarea
            dir="auto"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={cancel.isPending}
            readOnly={retrying}
            className="w-full"
            data-session-cancel-reason=""
          />
        </Field>
        {cancel.isError && (
          <div data-session-cancel-refusal="">
            <ErrorBanner className="p-2.5" title={t('cancel.refusedTitle')} message={message}>
              {failure && failure !== 'denied' && <p className="mt-1 text-xs">{t(`cancel.refusal.${failure}`)}</p>}
              {code && (
                <p className="mt-1 text-xs" data-refusal-code={code}>
                  {t('cancel.refusalCode')}{' '}
                  <span className="font-mono">
                    <Ltr>{code}</Ltr>
                  </span>
                </p>
              )}
            </ErrorBanner>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** What the cancel rolled back, as HQ answered it: budget journal lines and events, the coupon refund,
 *  the created codes it disabled and the points it gave back. A repeat moved nothing and says so. */
export function RollbackPanel({ result, session }: { result: RuleSupportCancelReply; session: RuleSessionLookup }) {
  const { t } = useTranslation('rule-sessions')
  const { rollback, repeated } = result
  const code = (c: string) => (
    <code className="font-mono font-semibold">
      <Ltr>{c}</Ltr>
    </code>
  )
  const sections: { key: string; items: ReactNode[] }[] = [
    {
      key: 'budgets',
      items: (rollback.movements ?? []).map((m) => (
        <li key={m.movementId} className="flex flex-wrap gap-1.5">
          {code(m.campaign)}
          <span>
            <MovementText move={m} />
          </span>
        </li>
      )),
    },
    {
      key: 'budgetEvents',
      items: (rollback.budgetEvents ?? []).map((e) => (
        <li key={e.eventId} className="flex flex-wrap gap-1.5">
          {code(e.campaign)}
          <span className="flex flex-col">
            <BudgetEventText event={e} />
          </span>
        </li>
      )),
    },
    {
      key: 'coupon',
      items: rollback.couponRefund
        ? [
            <li key="refund">
              <Trans
                t={t}
                i18nKey="rollback.couponRefund"
                values={{ code: session.coupon?.code ?? session.session.couponCode ?? '', tx: rollback.couponRefund.transactionId }}
                components={{ v: <bdi dir="ltr" className="font-mono" /> }}
              />
            </li>,
          ]
        : [],
    },
    {
      key: 'createdCodes',
      items: (rollback.createdCoupons ?? []).map((c, i) => (
        <li key={i} className="flex flex-wrap gap-1.5">
          {code(c.campaign)}
          <span>
            <Trans t={t} i18nKey="rollback.createdCode" values={{ code: c.code ?? '', state: c.state ?? '' }} components={{ v: <bdi dir="ltr" className="font-mono" /> }} />
          </span>
        </li>
      )),
    },
    {
      key: 'points',
      items: (rollback.pointsActivities ?? []).map((a) => (
        <li key={a.activityId}>
          <Trans
            t={t}
            i18nKey="rollback.pointsActivity"
            values={{ type: a.activityType, points: formatNumber(a.points), loyId: a.loyId, at: momentText(a.at) }}
            components={{ v: <bdi dir="ltr" /> }}
          />
        </li>
      )),
    },
  ]
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-success-border bg-success-050 p-4 text-xs text-success-800"
      role="status"
      data-session-rollback=""
      data-repeated={repeated}
    >
      <h2 className="text-sm font-semibold">{t(repeated ? 'rollback.repeatedTitle' : 'rollback.title', { state: t(`status.${session.session.state}`) })}</h2>
      {repeated && <p data-rollback-repeated="">{t('rollback.repeated')}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.key} className="flex flex-col gap-1" data-rollback={s.key} data-rollback-count={s.items.length}>
            <h3 className="font-semibold">{t(`rollback.${s.key}`)}</h3>
            {s.items.length === 0 ? <p>{t('rollback.none')}</p> : <ul className="flex flex-col gap-1">{s.items}</ul>}
          </div>
        ))}
      </div>
    </section>
  )
}
