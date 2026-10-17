import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { RuleSessionCancelled, RuleSessionRollback } from '@/core/models/rule-campaign'
import { rememberCancelledSession, ruleCampaignApi } from '@/core/rules/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatNumber } from '@/core/util/number-format'
import { BudgetMoveText } from './session-ui'

/**
 * Cancel session (ticket 518): the confirmation says what a cancel rolls back; HQ does it
 * (`RuleCampaign/Sessions/{saleId}/Cancel`, PROVISIONAL, BackOffice 2760) and answers the session
 * cancelled with its rollback, which the page then shows. A refusal shows here, verbatim, with its
 * code.
 */
export default function CancelSessionDialog({
  saleId,
  onClose,
  onCancelled,
}: {
  saleId: string
  onClose: () => void
  onCancelled: (result: RuleSessionCancelled) => void
}) {
  const { t } = useTranslation('rule-sessions')
  const queryClient = useQueryClient()
  const cancel = useMutation({
    mutationFn: () => ruleCampaignApi.cancelSession(saleId),
    onSuccess: (result) => {
      rememberCancelledSession(queryClient, saleId, result.session)
      onCancelled(result)
    },
  })
  const close = () => {
    if (!cancel.isPending) onClose()
  }
  const code = cancel.isError ? apiErrorCode(cancel.error) : null

  return (
    <Modal
      open
      onClose={close}
      title={t('cancel.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" disabled={cancel.isPending} onClick={close}>
            {t('cancel.keep')}
          </Button>
          <Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate()} data-session-cancel-confirm="">
            {cancel.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('cancel.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-session-cancel={saleId}>
        <p>
          <Trans t={t} i18nKey="cancel.body" values={{ saleId }} components={{ v: <bdi dir="ltr" className="font-mono" /> }} />
        </p>
        <p className="text-muted-foreground">{t('cancel.notReturn')}</p>
        {cancel.isError && (
          <div data-session-cancel-refusal="">
            <ErrorBanner className="p-2.5" title={t('cancel.refusedTitle')} message={apiErrorMessage(cancel.error, t('cancel.refused'))}>
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

/** What the cancel rolled back, as HQ answered it: budgets, coupon uses, created codes and points. */
export function RollbackPanel({ rollback, currency }: { rollback: RuleSessionRollback; currency: string }) {
  const { t } = useTranslation('rule-sessions')
  const code = (c: string) => (
    <code className="font-mono font-semibold">
      <Ltr>{c}</Ltr>
    </code>
  )
  const sections = [
    {
      key: 'budgets',
      items: rollback.budgets.map((b, i) => (
        <li key={i} className="flex flex-wrap gap-1.5">
          {code(b.campaignCode)}
          <span>
            <BudgetMoveText kind="released" budget={b.budget} limit={b.limit} amount={b.amount} currency={currency} />
          </span>
        </li>
      )),
    },
    {
      key: 'coupons',
      items: rollback.coupons.map((c, i) => (
        <li key={i} className="flex flex-wrap gap-1.5">
          {code(c.campaignCode)}
          <span>
            <Trans t={t} i18nKey="rollback.coupon" values={{ code: c.code }} components={{ v: <bdi dir="ltr" className="font-mono" /> }} />
          </span>
        </li>
      )),
    },
    {
      key: 'createdCodes',
      items: rollback.createdCodes.map((c, i) => (
        <li key={i} className="flex flex-wrap gap-1.5">
          {code(c.campaignCode)}
          <span>
            <Trans t={t} i18nKey="rollback.createdCode" values={{ code: c.code }} components={{ v: <bdi dir="ltr" className="font-mono" /> }} />
          </span>
        </li>
      )),
    },
    {
      key: 'points',
      items: rollback.points.map((p, i) => (
        <li key={i} className="flex flex-wrap gap-1.5">
          {code(p.campaignCode)}
          <span>
            <Trans t={t} i18nKey={`rollback.${p.kind}`} values={{ points: formatNumber(p.points) }} components={{ v: <Ltr /> }} />
          </span>
        </li>
      )),
    },
  ] as const
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-success-border bg-success-050 p-4 text-xs text-success-800" role="status" data-session-rollback="">
      <h2 className="text-sm font-semibold">{t('rollback.title')}</h2>
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
