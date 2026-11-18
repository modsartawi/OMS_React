import { useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, ReceiptText } from 'lucide-react'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Textarea from '@/core/ui/Textarea'
import type { CentralInvoiceRaiseRequest } from '@/core/models/central-invoice'
import { centralInvoiceApi, isGrantRefused } from './api'

/**
 * The one way to raise central invoices (ticket 332), shared by the delivery page's dialog
 * and the bulk screen so the two rules below cannot drift apart between them.
 *
 * - **One send.** `send` refuses while a request is in flight, through a REF: `isPending`
 *   reaches the render a tick after `mutate` (react-query notifies on a scheduled flush),
 *   so the second click of a double click still finds the button enabled. The drive
 *   caught two POSTs without it. The server still dedupes against a queued request.
 * - **A 403 re-reads the grant.** `@/core/api` invalidates the one permissions answer on
 *   every 403 (oms 914), so the menu leaf, the bulk screen's gate and the delivery page's
 *   action drop together once the refetch lands; `onGrantRefused` is the caller's own
 *   reaction on top (the dialog closes and says so).
 */
export function useRaiseCentralInvoice(onGrantRefused?: () => void) {
  const inFlight = useRef(false)
  const mutation = useMutation({
    mutationFn: (request: CentralInvoiceRaiseRequest) => centralInvoiceApi.raise(request),
    onSettled: () => {
      inFlight.current = false
    },
    onError: (err) => {
      if (isGrantRefused(err)) onGrantRefused?.()
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
    <Field id={id} label={t('reason.label')} hint={t('reason.hint')}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        rows={rows}
        placeholder={t('reason.placeholder')}
        className="w-full"
      />
    </Field>
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
