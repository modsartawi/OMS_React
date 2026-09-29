import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, ReceiptText } from 'lucide-react'
import Button from '@/core/ui/Button'
import type { CentralInvoiceRaiseRequest } from '@/core/models/central-invoice'
import { centralInvoiceApi, isGrantRefused, revokeCentralInvoiceAccess } from './api'

/**
 * The one way to raise central invoices (ticket 332), shared by the delivery page's dialog
 * and the bulk screen so the two rules below cannot drift apart between them.
 *
 * - **One send.** `send` refuses while a request is in flight, through a REF: `isPending`
 *   reaches the render a tick after `mutate` (react-query notifies on a scheduled flush),
 *   so the second click of a double click still finds the button enabled. The drive
 *   caught two POSTs without it. The server still dedupes against a queued request.
 * - **A 403 revokes the grant for the page life.** The shared probe entry is overwritten,
 *   so the menu leaf, the bulk screen's gate and the delivery page's action all drop;
 *   `onGrantRefused` is the caller's own reaction on top (the dialog closes and says so).
 */
export function useRaiseCentralInvoice(onGrantRefused?: () => void) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const mutation = useMutation({
    mutationFn: (request: CentralInvoiceRaiseRequest) => centralInvoiceApi.raise(request),
    onSettled: () => {
      inFlight.current = false
    },
    onError: (err) => {
      if (!isGrantRefused(err)) return
      revokeCentralInvoiceAccess(queryClient)
      onGrantRefused?.()
    },
  })
  const send = (request: CentralInvoiceRaiseRequest) => {
    if (inFlight.current) return
    inFlight.current = true
    mutation.mutate(request)
  }
  return { mutation, send }
}

/** The required reason, with the one sentence that says why it is required. */
export function ReasonField({
  id,
  value,
  onChange,
  disabled,
  rows,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  disabled: boolean
  rows: number
}) {
  const { t } = useTranslation('central-invoice')
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground" htmlFor={id}>
        {t('reason.label')}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        rows={rows}
        placeholder={t('reason.placeholder')}
        aria-describedby={`${id}-hint`}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-[0.8125rem]"
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t('reason.hint')}
      </p>
    </div>
  )
}

/** Send, reading *Sending…* with a spinner while in flight. `count` picks the plural. */
export function RaiseButton({
  count,
  pending,
  disabled,
  onClick,
}: {
  count: number
  pending: boolean
  disabled: boolean
  onClick: () => void
}) {
  const { t } = useTranslation('central-invoice')
  return (
    <Button variant="primary" disabled={disabled || pending} onClick={onClick}>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <ReceiptText className="h-3.5 w-3.5" aria-hidden />
      )}
      {pending ? t('send.sending') : t('send.label', { count })}
    </Button>
  )
}
