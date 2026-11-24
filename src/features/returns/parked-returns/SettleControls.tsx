import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ban, Banknote, CheckCircle2, Loader2, Wrench } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { ParkedReturnDetail, ParkedReturnGrain } from '@/core/models/parked-returns'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { formatPair, fsi } from '@/core/util/bidi'
import { PARKED_RETURNS_KEY, parkedReturnsApi } from './api'
import {
  CASH_EVIDENCE_MAX,
  CASH_REASON_MAX,
  cashCommit,
  clampTo,
  grainActions,
  rowlessCommit,
  rowlessSeed,
  settleRefusalKey,
  type RowlessForm,
  type SettleOutcome,
  type SettleRequest,
} from './settle'

/**
 * The settle actions (BackOffice ticket 4225, spec 4212 stories 14-22; doors BackOffice 4219), shown only with the settle
 * right (`ParkedReturns:06`). Every answer, a success or a refusal, reads the list and the return again, so the row shows
 * who settled it and when — or what a colleague chose first.
 */

/** A refusal in plain words: the code's own sentence, else the server's message. */
function useRefusalWords() {
  const { t } = useTranslation('parked-returns')
  return (err: unknown) => {
    const key = settleRefusalKey(err)
    return key ? t(key) : apiErrorMessage(err, t('refusal.failed'))
  }
}

/** Reads the list and every open return again (the list key and the detail key share the prefix). */
function useRefreshParked() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: PARKED_RETURNS_KEY })
}

const ICON: Record<SettleOutcome, typeof CheckCircle2> = { REFUNDED: CheckCircle2, VOID_AFTER_CHECK: Ban, PAY_IN_CASH: Banknote }

/** One grain's buttons: Refunded and Void after check (each confirmed), Pay in cash (the dialog). */
export function GrainSettleActions({
  grain,
  returnState,
  canSettle,
  money,
  grains,
}: {
  grain: ParkedReturnGrain
  returnState: string
  canSettle: boolean
  money: (v: number) => string
  /** Every grain of the same return: Void after check is hidden beside a refunded or cash-ruled one. */
  grains: readonly ParkedReturnGrain[]
}) {
  const { t } = useTranslation('parked-returns')
  const words = useRefusalWords()
  const refresh = useRefreshParked()
  const [cashOpen, setCashOpen] = useState(false)
  const actions = grainActions(grain, { canSettle, returnState, grains })
  const amount = fsi(money(grain.amount))
  const partner = fsi(grain.partner)

  const settle = useMutation({
    mutationFn: (request: SettleRequest) => parkedReturnsApi.settle(grain.refundId, request),
    onSuccess: (_grain, request) => {
      notify.success(t(`settle.done.${request.outcome}`), formatPair(grain.partner, money(grain.amount)))
      setCashOpen(false)
    },
    onSettled: () => void refresh(),
  })

  async function press(outcome: SettleOutcome) {
    if (settle.isPending) return
    if (outcome === 'PAY_IN_CASH') {
      settle.reset()
      setCashOpen(true)
      return
    }
    const ok = await confirmAction(t(`settle.confirm.${outcome}.body`, { amount, partner }), t(`settle.confirm.${outcome}.title`))
    if (ok) settle.mutate({ outcome })
  }

  if (actions.length === 0 && !settle.isError) return null

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-border/40 pt-2" data-parked-settle={grain.refundId}>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((outcome) => {
            const Icon = ICON[outcome]
            return (
              <Button
                key={outcome}
                variant={outcome === 'PAY_IN_CASH' ? 'primary' : outcome === 'VOID_AFTER_CHECK' ? 'danger-outlined' : 'outlined'}
                disabled={settle.isPending}
                onClick={() => void press(outcome)}
                data-parked-settle-action={outcome}
              >
                {settle.isPending && settle.variables?.outcome === outcome ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                )}
                {t(`settle.action.${outcome}`)}
              </Button>
            )
          })}
        </div>
      )}
      {settle.isError && !cashOpen && (
        <ErrorBanner className="p-2.5" title={t('refusal.title')} message={words(settle.error)} />
      )}
      {cashOpen && (
        <CashDialog
          amount={amount}
          partner={partner}
          pending={settle.isPending}
          error={settle.isError ? words(settle.error) : null}
          onCommit={(body) => settle.mutate(body)}
          onClose={() => {
            if (!settle.isPending) setCashOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** Pay in cash: a reason AND what the partner's dashboard showed, both required, each within the server's width. */
function CashDialog({
  amount,
  partner,
  pending,
  error,
  onCommit,
  onClose,
}: {
  amount: string
  partner: string
  pending: boolean
  error: string | null
  onCommit: (body: SettleRequest) => void
  onClose: () => void
}) {
  const { t } = useTranslation('parked-returns')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState('')
  const [tried, setTried] = useState(false)
  const commit = cashCommit({ reason, evidence, pending })

  const reasonError = commit.reasonTooLong
    ? t('cash.tooLong', { max: fsi(String(CASH_REASON_MAX)) })
    : tried && commit.reasonMissing
      ? t('cash.reasonMissing')
      : undefined
  const evidenceError = commit.evidenceTooLong
    ? t('cash.tooLong', { max: fsi(String(CASH_EVIDENCE_MAX)) })
    : tried && commit.evidenceMissing
      ? t('cash.evidenceMissing')
      : undefined

  const submit = () => {
    setTried(true)
    if (commit.body) onCommit(commit.body)
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={!pending}
      title={t('cash.title')}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={pending} data-parked-cash-cancel="">
            {t('cash.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={pending || (tried && !commit.canCommit)} data-parked-cash-commit="">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Banknote className="h-3.5 w-3.5" aria-hidden />}
            {pending ? t('cash.committing') : t('cash.commit')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        data-parked-cash-dialog=""
      >
        <p className="text-sm text-muted-foreground">{t('cash.hint', { amount, partner })}</p>
        <Field label={t('cash.reason')} error={reasonError}>
          <Textarea
            value={reason}
            onChange={(e) => setReason(clampTo(e.target.value, CASH_REASON_MAX))}
            maxLength={CASH_REASON_MAX}
            rows={3}
            disabled={pending}
            required
            className="w-full"
            data-parked-cash-reason=""
          />
        </Field>
        <Field label={t('cash.evidence')} error={evidenceError}>
          <Textarea
            value={evidence}
            onChange={(e) => setEvidence(clampTo(e.target.value, CASH_EVIDENCE_MAX))}
            maxLength={CASH_EVIDENCE_MAX}
            rows={4}
            disabled={pending}
            required
            className="w-full"
            data-parked-cash-evidence=""
          />
        </Field>
        {error && <ErrorBanner className="p-2.5" title={t('refusal.title')} message={error} />}
      </form>
    </Modal>
  )
}

/** "Resolve row-less" (story 20): a park the store mirrored with no ledger row, resolved REFUNDED or FAILED. */
export function RowlessResolve({ detail }: { detail: ParkedReturnDetail }) {
  const { t } = useTranslation('parked-returns')
  const words = useRefusalWords()
  const refresh = useRefreshParked()
  const [form, setForm] = useState<RowlessForm | null>(null)
  const commit = form ? rowlessCommit(form, false) : null

  const resolve = useMutation({
    mutationFn: () => parkedReturnsApi.resolveRowless(detail.transactionId, commit!.body!),
    onSuccess: () => {
      notify.success(t('rowless.done'), detail.transactionId)
      setForm(null)
    },
    onSettled: () => void refresh(),
  })
  const set = (change: Partial<RowlessForm>) => setForm((f) => (f ? { ...f, ...change } : f))
  const pending = resolve.isPending

  return (
    <div className="flex flex-col gap-2" data-parked-rowless="">
      <div>
        <Button
          variant="primary"
          onClick={() => {
            resolve.reset()
            setForm(rowlessSeed(detail))
          }}
          data-parked-rowless-open=""
        >
          <Wrench className="h-3.5 w-3.5" aria-hidden />
          {t('rowless.action')}
        </Button>
      </div>
      {resolve.isError && !form && <ErrorBanner className="p-2.5" title={t('refusal.title')} message={words(resolve.error)} />}
      {form && (
        <Modal
          open
          onClose={() => {
            if (!pending) setForm(null)
          }}
          dismissable={!pending}
          title={t('rowless.title')}
          width="34rem"
          footer={
            <>
              <Button variant="text" onClick={() => setForm(null)} disabled={pending}>
                {t('rowless.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (commit?.canCommit && !pending) resolve.mutate()
                }}
                disabled={pending || !commit?.canCommit}
                data-parked-rowless-commit=""
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Wrench className="h-3.5 w-3.5" aria-hidden />}
                {pending ? t('rowless.committing') : t('rowless.commit')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3" data-parked-rowless-dialog="">
            <p className="text-sm text-muted-foreground">{t('rowless.hint')}</p>
            <p className="text-sm">
              <span className="text-muted-foreground">{t('rowless.store')} </span>
              <Ltr>{form.storeCode}</Ltr>
              <span className="ms-4 text-muted-foreground">{t('rowless.cashier')} </span>
              <Ltr>{form.operatorId}</Ltr>
            </p>
            <Field label={t('rowless.status')}>
              <Select value={form.status} onChange={(e) => set({ status: e.target.value })} disabled={pending} data-parked-rowless-status="">
                <option value="">{t('rowless.statusPick')}</option>
                <option value="REFUNDED">{t('rowless.statusRefunded')}</option>
                <option value="FAILED">{t('rowless.statusFailed')}</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('rowless.partner')}>
                <Input value={form.partner} onChange={(e) => set({ partner: e.target.value })} disabled={pending} dir="ltr" maxLength={26} />
              </Field>
              <Field label={t('rowless.tenderType')}>
                <Input value={form.tenderType} onChange={(e) => set({ tenderType: e.target.value })} disabled={pending} dir="ltr" maxLength={26} />
              </Field>
              <Field label={t('rowless.originalReference')}>
                <Input
                  value={form.originalReference}
                  onChange={(e) => set({ originalReference: e.target.value })}
                  disabled={pending}
                  dir="ltr"
                  maxLength={128}
                />
              </Field>
              <Field label={t('rowless.amount')}>
                <Input
                  value={form.amount}
                  onChange={(e) => set({ amount: e.target.value })}
                  disabled={pending}
                  dir="ltr"
                  inputMode="decimal"
                />
              </Field>
            </div>
            {resolve.isError && <ErrorBanner className="p-2.5" title={t('refusal.title')} message={words(resolve.error)} />}
          </div>
        </Modal>
      )}
    </div>
  )
}
