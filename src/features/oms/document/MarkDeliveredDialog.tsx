import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Truck } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import { revokeMarkDelivered } from '@/core/oms/api'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { formatMoney } from '@/core/util/number-format'
import type { MarkDeliveredRequest } from '@/core/models/sd-document'
import { documentApi } from './api'
import { MARK_DELIVERED_NOTE_MAX, markDeliveredCommit, reasonLabelKey, refusalKeyOf } from './mark-delivered'

/** The reasons are server-held and session-stable: one read per page life. */
const REASONS_KEY = ['oms', 'mark-delivered-reasons'] as const

const isGrantRefused = (err: unknown): boolean => err instanceof ApiError && err.statusCode === 403

/**
 * *Mark delivered…* on a delivery's page (BackOffice spec 2417, ADR 0065; ticket 2422), on the
 * `CentralInvoiceDialog` pattern: a required reason from the server's `DLVM` list, a note that
 * `OTHR` requires, one POST, and the answer in place.
 *
 * - **One send.** A ref refuses a second POST while one is in flight — `isPending` reaches the
 *   render a tick after `mutate`, so the second click of a double click would still find the
 *   button enabled (Central Invoice's drive caught exactly that).
 * - **Nothing dismisses it mid-flight**, so an answer is never dropped.
 * - **A refusal stays inline**, worded from its machine code (2420); a code this client does not
 *   know shows the server's own sentence.
 * - **A 403 — from the reasons read or the POST — closes it with a toast** and revokes the
 *   command for the page life: the server's answer outranks the probe's.
 * - **Success toasts and hands back to the page**, which reloads the delivery so the new status
 *   and the `DDLR` log row are what the operator sees.
 */
export default function MarkDeliveredDialog({
  open,
  onClose,
  onMarked,
  deliveryNo,
  amountDue,
}: {
  open: boolean
  onClose: () => void
  onMarked: () => void
  deliveryNo: string
  amountDue: number | null | undefined
}) {
  const { t } = useTranslation('document')
  const queryClient = useQueryClient()
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const inFlight = useRef(false)

  const grantRefused = () => {
    revokeMarkDelivered(queryClient)
    notify.error(t('markDelivered.grantRefused.title'), t('markDelivered.grantRefused.detail'))
    onClose()
  }

  const reasons = useQuery({
    queryKey: REASONS_KEY,
    queryFn: () => documentApi.markDeliveredReasons(),
    enabled: open,
    staleTime: Infinity,
    retry: false,
  })

  const mark = useMutation({
    mutationFn: (request: MarkDeliveredRequest) => documentApi.markDelivered(request),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: () => {
      notify.success(t('markDelivered.done.title'), t('markDelivered.done.detail', { deliveryNo: fsi(deliveryNo) }))
      onMarked()
    },
    onError: (err) => {
      if (isGrantRefused(err)) grantRefused()
    },
  })

  const commit = markDeliveredCommit({ reasonCode, note, pending: mark.isPending })

  const send = () => {
    if (inFlight.current || !commit.canCommit) return
    inFlight.current = true
    const trimmedNote = note.trim()
    mark.mutate({ deliveryNo, reasonCode, note: trimmedNote || undefined })
  }

  const close = () => {
    if (mark.isPending) return
    onClose()
  }

  // A 403 on the reasons read is the grant refusing too: the same toast, revoke and close.
  const reasonsRefused = reasons.isError && isGrantRefused(reasons.error)
  useEffect(() => {
    if (open && reasonsRefused) grantRefused()
    // `grantRefused` is rebuilt every render; the refusal itself is the event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reasonsRefused])

  const refusal = mark.isError && !isGrantRefused(mark.error) ? mark.error : null
  const refusalKey = refusal ? refusalKeyOf(apiErrorCode(refusal)) : null
  const due = typeof amountDue === 'number' && Number.isFinite(amountDue) && amountDue !== 0

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('markDelivered.title', { deliveryNo: fsi(deliveryNo) })}
      width="30rem"
      // A fresh request on every open: a reason, note or refusal left from the last one would be
      // one careless click from being read as this one's.
      onShow={() => {
        setReasonCode('')
        setNote('')
        mark.reset()
      }}
      footer={
        <>
          <Button variant="text" disabled={mark.isPending} onClick={close}>
            {t('markDelivered.cancel')}
          </Button>
          <Button variant="primary" disabled={!commit.canCommit} onClick={send} data-mark-delivered-commit>
            {mark.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Truck className="h-3.5 w-3.5" aria-hidden />
            )}
            {mark.isPending ? t('markDelivered.committing') : t('markDelivered.commit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-[0.8125rem] text-muted-foreground">{t('markDelivered.intro')}</p>

        {due && (
          // Marking delivered settles no cash (ADR 0065): the amount stays on the driver's clearance.
          <p
            className="flex items-start gap-1.5 rounded-md border border-attention-border bg-attention-050 px-2 py-1.5 text-[0.8125rem] text-attention-800"
            role="note"
            data-mark-delivered-due
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t('markDelivered.amountDue', { amount: fsi(formatMoney(amountDue)) })}</span>
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="mark-delivered-reason">
            {t('markDelivered.reason.label')}
          </label>
          <select
            id="mark-delivered-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={mark.isPending || !reasons.isSuccess}
            required
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-[0.8125rem]"
          >
            <option value="">
              {reasons.isPending ? t('markDelivered.reason.loading') : t('markDelivered.reason.placeholder')}
            </option>
            {(reasons.data ?? []).map((r) => (
              <option key={r.code} value={r.code}>
                {/* Labelled by code from the locale; a code this client does not know shows the server's text. */}
                {t(reasonLabelKey(r.code), { defaultValue: r.description })}
              </option>
            ))}
          </select>
          {reasons.isError && !reasonsRefused && (
            <ErrorBanner
              className="p-2"
              message={apiErrorMessage(reasons.error, t('markDelivered.reason.loadFailed'))}
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="mark-delivered-note">
            {commit.noteRequired ? t('markDelivered.note.labelRequired') : t('markDelivered.note.label')}
          </label>
          <textarea
            id="mark-delivered-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={mark.isPending}
            required={commit.noteRequired}
            // The server's width (`SdDocumentLog.Note`, 100). The cap is on what is typed; the
            // trimmed check below explains the edge a paste with padding could still reach.
            maxLength={MARK_DELIVERED_NOTE_MAX}
            rows={3}
            placeholder={t('markDelivered.note.placeholder')}
            aria-describedby="mark-delivered-note-hint"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-[0.8125rem]"
          />
          {(commit.noteRequired && !note.trim()) || commit.noteTooLong ? (
            <p id="mark-delivered-note-hint" className="text-xs text-muted-foreground">
              {commit.noteTooLong
                ? t('markDelivered.note.tooLong', { max: MARK_DELIVERED_NOTE_MAX })
                : t('markDelivered.note.required')}
            </p>
          ) : null}
        </div>

        {refusal && (
          <ErrorBanner
            className="p-2.5"
            title={t('markDelivered.failed.title')}
            message={refusalKey ? t(refusalKey) : apiErrorMessage(refusal, t('markDelivered.failed.detail'))}
          >
            {apiErrorCode(refusal) && (
              <span className="font-mono text-xs">
                <Ltr>{apiErrorCode(refusal)}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}
