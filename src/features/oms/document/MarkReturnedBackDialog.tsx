import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, Loader2, PackageOpen } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import { revokeMarkReturnedBack } from '@/core/oms/api'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import type { MarkReturnedBackRequest } from '@/core/models/sd-document'
import { documentApi } from './api'
import {
  MARK_RETURNED_BACK_NOTE_MAX,
  markReturnedBackCommit,
  markReturnedBackNotices,
  returnedBackReasonLabelKey,
  returnedBackRefusalKeyOf,
} from './mark-returned-back'

/** The reasons are server-held and session-stable: one read per page life. */
const REASONS_KEY = ['oms', 'mark-returned-back-reasons'] as const

const isGrantRefused = (err: unknown): boolean => err instanceof ApiError && err.statusCode === 403

/**
 * *Mark returned back…* on a delivery's page (BackOffice spec 3433, ADR 0126; oms-react 838), on
 * `MarkDeliveredDialog`'s pattern: a required reason from the server's `DLVB` list, a note that
 * `OTHB` requires, one POST, and the answer in place.
 *
 * - **It says what follows.** Always: the store must now reschedule or cancel the delivery. On an
 *   express delivery also: its order will be requested closed automatically in five minutes. There
 *   is no amount-due line.
 * - **One send.** A ref refuses a second POST while one is in flight.
 * - **Nothing dismisses it mid-flight**, so an answer is never dropped.
 * - **A refusal stays inline**, worded from its machine code (3434, 3435); a code this client does
 *   not know shows the server's own sentence.
 * - **A 403 — from the reasons read or the POST — closes it with a toast** and revokes only
 *   `canMarkReturnedBack` for the page life: the server's answer outranks the probe's.
 * - **Success toasts and hands back to the page**, which reloads the delivery so the `B` status
 *   and the `DRBK` log row are what the operator sees.
 */
export default function MarkReturnedBackDialog({
  open,
  onClose,
  onMarked,
  deliveryNo,
  isExpressDelivery,
}: {
  open: boolean
  onClose: () => void
  onMarked: () => void
  deliveryNo: string
  isExpressDelivery: boolean | null | undefined
}) {
  const { t } = useTranslation('document')
  const queryClient = useQueryClient()
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const inFlight = useRef(false)

  const grantRefused = () => {
    revokeMarkReturnedBack(queryClient)
    notify.error(t('markReturnedBack.grantRefused.title'), t('markReturnedBack.grantRefused.detail'))
    onClose()
  }

  const reasons = useQuery({
    queryKey: REASONS_KEY,
    queryFn: () => documentApi.markReturnedBackReasons(),
    enabled: open,
    staleTime: Infinity,
    retry: false,
  })

  const mark = useMutation({
    mutationFn: (request: MarkReturnedBackRequest) => documentApi.markReturnedBack(request),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: () => {
      notify.success(
        t('markReturnedBack.done.title'),
        t('markReturnedBack.done.detail', { deliveryNo: fsi(deliveryNo) }),
      )
      onMarked()
    },
    onError: (err) => {
      if (isGrantRefused(err)) grantRefused()
    },
  })

  const commit = markReturnedBackCommit({ reasonCode, note, pending: mark.isPending })
  const notices = markReturnedBackNotices({ isExpressDelivery })

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
  const refusalKey = refusal ? returnedBackRefusalKeyOf(apiErrorCode(refusal)) : null

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('markReturnedBack.title', { deliveryNo: fsi(deliveryNo) })}
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
            {t('markReturnedBack.cancel')}
          </Button>
          <Button variant="primary" disabled={!commit.canCommit} onClick={send} data-mark-returned-back-commit>
            {mark.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <PackageOpen className="h-3.5 w-3.5" aria-hidden />
            )}
            {mark.isPending ? t('markReturnedBack.committing') : t('markReturnedBack.commit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-[0.8125rem] text-muted-foreground">{t('markReturnedBack.intro')}</p>

        {notices.reschedule && (
          // Returned back is not an ending (ADR 0126): the store reschedules or cancels it next.
          <p
            className="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 text-[0.8125rem]"
            role="note"
            data-mark-returned-back-reschedule
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t('markReturnedBack.reschedule')}</span>
          </p>
        )}

        {notices.expressAutoClose && (
          // The field's own DRBK queues an express delivery's close request five minutes later.
          <p
            className="flex items-start gap-1.5 rounded-md border border-attention-border bg-attention-050 px-2 py-1.5 text-[0.8125rem] text-attention-800"
            role="note"
            data-mark-returned-back-express
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t('markReturnedBack.expressAutoClose')}</span>
          </p>
        )}

        <Field id="mark-returned-back-reason" label={t('markReturnedBack.reason.label')}>
          <Select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={mark.isPending || !reasons.isSuccess}
            required
            className="w-full"
          >
            <option value="">
              {reasons.isPending ? t('markReturnedBack.reason.loading') : t('markReturnedBack.reason.placeholder')}
            </option>
            {(reasons.data ?? []).map((r) => (
              <option key={r.code} value={r.code}>
                {/* Labelled by code from the locale; a code this client does not know shows the server's text. */}
                {t(returnedBackReasonLabelKey(r.code), { defaultValue: r.description })}
              </option>
            ))}
          </Select>
          {reasons.isError && !reasonsRefused && (
            <ErrorBanner
              className="p-2"
              message={apiErrorMessage(reasons.error, t('markReturnedBack.reason.loadFailed'))}
            />
          )}
        </Field>

        <Field
          id="mark-returned-back-note"
          label={commit.noteRequired ? t('markReturnedBack.note.labelRequired') : t('markReturnedBack.note.label')}
          hint={
            (commit.noteRequired && !note.trim()) || commit.noteTooLong
              ? commit.noteTooLong
                ? t('markReturnedBack.note.tooLong', { max: MARK_RETURNED_BACK_NOTE_MAX })
                : t('markReturnedBack.note.required')
              : undefined
          }
        >
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={mark.isPending}
            required={commit.noteRequired}
            // The server's width (`SdDocumentLog.Note`, 100). The cap is on what is typed; the
            // trimmed check explains the edge a paste with padding could still reach.
            maxLength={MARK_RETURNED_BACK_NOTE_MAX}
            rows={3}
            placeholder={t('markReturnedBack.note.placeholder')}
            className="w-full"
          />
        </Field>

        {refusal && (
          <ErrorBanner
            className="p-2.5"
            title={t('markReturnedBack.failed.title')}
            message={refusalKey ? t(refusalKey) : apiErrorMessage(refusal, t('markReturnedBack.failed.detail'))}
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
