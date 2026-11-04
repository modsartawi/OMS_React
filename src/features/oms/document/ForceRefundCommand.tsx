import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HandCoins, Loader2 } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Textarea from '@/core/ui/Textarea'
import Ltr from '@/core/ui/Ltr'
import { apiErrorCode, apiErrorKind, apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { revokeOnForbidden } from '@/core/oms/api'
import { mintRequestId } from '@/core/util/request-id'
import { fsi } from '@/core/util/bidi'
import type { LfReturnDetailModel } from '@/core/models/lf-return'
import { documentApi } from './api'
import {
  buildForceRefundRequest,
  clampReceivedQuantity,
  forceRefundAction,
  forceRefundGate,
  forceRefundLines,
  pressRequestId,
} from './force-refund'

/**
 * **Force refund** on the LF return panel (spec 759 F5, ticket 763; BackOffice 3375): the command
 * the panel's `actions` slot carries, and the dialog it opens. Drawn only for a 04 holder; disabled,
 * with its reason, once the watch is `refunded` or `forced`.
 *
 * The dialog is the confirmation (the ReturnDialog rule): one row per line — received `0..asked`,
 * nothing typed, the operator states every line — and a required reason. Nothing on the wire is
 * money. On success the watch is re-read (`watchKey`), so the panel itself shows `forced` with who
 * and why: the visible proof that the automatic refund is stopped.
 */
export default function ForceRefundCommand({
  canForce,
  returnDeliveryNo,
  detail,
  watchKey,
}: {
  /** The access model's `canForceLocalFulfillmentReturnRefund` (04, counted only beside 03). */
  canForce: boolean
  returnDeliveryNo: string
  detail: LfReturnDetailModel
  /** The panel read's query key, invalidated after a force. */
  watchKey: readonly unknown[]
}) {
  const { t } = useTranslation('document')
  const [open, setOpen] = useState(false)
  const action = forceRefundAction(canForce, detail.outcome)
  if (!action.shown) return null
  const reason = action.disabled ? t(action.reasonKey) : undefined
  return (
    <>
      <Button
        variant="outlined"
        aria-disabled={action.disabled || undefined}
        title={reason}
        onClick={() => {
          if (!action.disabled) setOpen(true)
        }}
        data-lf-force=""
        data-lf-force-disabled={action.disabled ? '' : undefined}
      >
        <HandCoins className="h-3.5 w-3.5" aria-hidden />
        {t('lfReturn.force.action')}
      </Button>
      {open && (
        <ForceRefundDialog
          onClose={() => setOpen(false)}
          returnDeliveryNo={returnDeliveryNo}
          detail={detail}
          watchKey={watchKey}
        />
      )}
    </>
  )
}

function ForceRefundDialog({
  onClose,
  returnDeliveryNo,
  detail,
  watchKey,
}: {
  onClose: () => void
  returnDeliveryNo: string
  detail: LfReturnDetailModel
  watchKey: readonly unknown[]
}) {
  const { t } = useTranslation('document')
  const queryClient = useQueryClient()
  const rows = useMemo(() => forceRefundLines(detail), [detail])
  /**
   * What is IN each box. The gate and the body read it through the clamp on every render, so what
   * is judged is always what would be sent; blur only rewrites the box to the clamped value.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const received = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.itemNumber, clampReceivedQuantity(drafts[row.itemNumber], row.asked)])),
    [rows, drafts],
  )
  const [reason, setReason] = useState('')
  const [refusal, setRefusal] = useState<{ message: string; code: string | null; refused: boolean } | null>(null)
  /**
   * The idempotency key of the last press the server never answered. Held across a retry so a slow
   * network forces once; dropped the moment the server answers (success or refusal). The dialog is
   * mounted per opening, so a new opening starts with none.
   */
  const heldRequestId = useRef<string | null>(null)
  /** Flips synchronously: two clicks before React re-renders still post once. */
  const inFlight = useRef(false)

  const gate = forceRefundGate(rows, received, reason)

  const force = useMutation({
    mutationFn: documentApi.forceLfReturnRefund,
    onSuccess: () => {
      heldRequestId.current = null
      void queryClient.invalidateQueries({ queryKey: watchKey })
      notify.success(t('lfReturn.force.done.title', { returnDeliveryNo: fsi(returnDeliveryNo) }), t('lfReturn.force.done.detail'))
      onClose()
    },
    onError: (err: unknown) => {
      revokeOnForbidden(queryClient, err, 'canForceLocalFulfillmentReturnRefund')
      // A guardrail refusal is an ANSWER: the next press is a new request. Anything else (network,
      // 5xx) is "I do not know" — the held id stays, so pressing again replays rather than re-forces.
      const refused = apiErrorKind(err) === 'business'
      if (refused) heldRequestId.current = null
      setRefusal({ message: apiErrorMessage(err, t('lfReturn.force.refused.fallback')), code: apiErrorCode(err), refused })
    },
    onSettled: () => {
      inFlight.current = false
    },
  })

  function submit() {
    if (!gate.ok || inFlight.current || force.isPending) return
    inFlight.current = true
    const requestId = pressRequestId(heldRequestId.current, mintRequestId)
    heldRequestId.current = requestId
    setRefusal(null)
    force.mutate(buildForceRefundRequest({ returnDeliveryNo, rows, received, reason, requestId }))
  }

  function requestClose() {
    if (force.isPending) return
    onClose()
  }

  function commit(itemNumber: string, asked: number) {
    const next = clampReceivedQuantity(drafts[itemNumber], asked)
    setDrafts((prev) => ({ ...prev, [itemNumber]: next === null ? '' : String(next) }))
  }

  return (
    <Modal
      open
      onClose={requestClose}
      title={t('lfReturn.force.title', { returnDeliveryNo: fsi(returnDeliveryNo) })}
      width="44rem"
      footer={
        <>
          <span
            data-lf-force-gate={gate.ok ? 'ok' : 'blocked'}
            className={'me-auto self-center text-[0.75rem] ' + (gate.ok ? 'text-muted-foreground' : 'font-semibold text-danger-800')}
          >
            {t(gate.key, gate.params)}
          </span>
          <Button variant="text" onClick={requestClose} disabled={force.isPending}>
            {t('dialog.cancel')}
          </Button>
          <Button variant="primary" disabled={!gate.ok || force.isPending} onClick={submit} data-lf-force-submit="">
            {force.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <HandCoins className="h-3.5 w-3.5" aria-hidden />}
            {force.isPending ? t('lfReturn.force.submitting') : t('lfReturn.force.submit')}
          </Button>
        </>
      }
    >
      {refusal && (
        <div className="mb-3" data-lf-force-refusal="">
          <ErrorBanner
            className="p-2.5"
            title={refusal.refused ? t('lfReturn.force.refused.title') : t('lfReturn.force.failed.title')}
            message={refusal.message}
          >
            {refusal.code && (
              <p className="mt-0.5 font-mono text-[0.6875rem]" data-lf-force-refusal-code="">
                <Ltr>{refusal.code}</Ltr>
              </p>
            )}
            {!refusal.refused && (
              <p className="mt-0.5" data-lf-force-retry-safe="">
                {t('lfReturn.force.failed.retrySafe')}
              </p>
            )}
          </ErrorBanner>
        </div>
      )}

      <p className="mb-3 text-[0.8125rem] text-muted-foreground">{t('lfReturn.force.intro')}</p>

      <div className="rounded-lg border border-border">
        <table className="w-full border-collapse text-[0.8125rem]" data-lf-force-lines="">
          <thead>
            <tr className="border-b border-border/60 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-2 py-1.5 text-start">{t('lfReturn.force.columns.item')}</th>
              <th scope="col" className="px-2 py-1.5 text-start">{t('lfReturn.force.columns.sku')}</th>
              <th scope="col" className="w-20 px-2 py-1.5 text-end">{t('lfReturn.force.columns.asked')}</th>
              <th scope="col" className="w-32 px-2 py-1.5 text-end">{t('lfReturn.force.columns.received')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.itemNumber}-${i}`} className="border-b border-border/40 last:border-b-0" data-lf-force-row={row.itemNumber}>
                <td className="px-2 py-1.5 font-mono">
                  <Ltr>{row.itemNumber}</Ltr>
                </td>
                <td className="px-2 py-1.5 font-mono">
                  <Ltr>{row.sku}</Ltr>
                </td>
                <td className="px-2 py-1.5 text-end tabular-nums">
                  <Ltr>{row.asked}</Ltr>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-col items-end gap-0.5">
                    <Input
                      className="w-16 text-center tabular-nums"
                      dir="ltr"
                      inputMode="numeric"
                      value={drafts[row.itemNumber] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setDrafts((prev) => ({ ...prev, [row.itemNumber]: value }))
                      }}
                      onBlur={() => commit(row.itemNumber, row.asked)}
                      aria-label={t('lfReturn.force.receivedLabel', { itemNumber: fsi(row.itemNumber) })}
                      data-lf-force-qty={row.itemNumber}
                    />
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {t('lfReturn.force.ofAsked', { asked: fsi(row.asked) })}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="mt-3 block text-[0.8125rem]">
        <span className="mb-1 block font-medium">{t('lfReturn.force.reasonLabel')}</span>
        <Textarea
          className="min-h-20 w-full"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('lfReturn.force.reasonPlaceholder')}
          data-lf-force-reason=""
        />
      </label>
    </Modal>
  )
}
