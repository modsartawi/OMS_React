import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Flag } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import { ApiError, apiErrorMessage } from '@/core/api'
import { revokeOnForbidden } from '@/core/oms/api'
import { notify } from '@/core/services/notify'
import type { CancellationReasonModel } from '@/core/models/sd-document'
import { fsi } from '@/core/util/bidi'
import { documentApi } from './api'
import { CANCELLATION_REASONS_KEY, cancellationReasonName, requestCloseCommit } from './request-close'

const isGrantRefused = (err: unknown): boolean => err instanceof ApiError && err.statusCode === 403

/**
 * Screen 2 — Request cancellation's reason picker (BackOffice spec 3461, door 3462; oms-react 855).
 *
 * The reasons are the server's active cancellation reasons, asked again on every open (stale at once, so a
 * reason the business retired is gone the next time), in the server's order, each shown in the UI
 * language. The pick posts its code as `reasonCode` and its English name as the note (`request-close.ts`).
 * Until THIS open's read has finished the dialog says it is loading — the last open's list (or failure) is
 * never shown or committable meanwhile. A list that fails to load, or loads empty, says so inline and commit
 * stays disabled. A 403 on the read is the Change grant refusing: toast, revoke and close, as Mark
 * delivered does. A reason retired while the dialog was open is refused by the server; the page's toast
 * words that refusal by its code and invalidates the cached list.
 *
 * The dialog IS the confirmation for the action: it opens directly from the
 * command panel with no pre-confirm, and its primary button commits (D-20).
 */
export default function RequestCloseDialog({
  open,
  onClose,
  onConfirmed,
}: {
  open: boolean
  onClose: () => void
  onConfirmed: (reason: CancellationReasonModel) => void
}) {
  const { t, i18n } = useTranslation('document')
  const queryClient = useQueryClient()
  const [pickedCode, setPickedCode] = useState('')

  const reasons = useQuery({
    queryKey: CANCELLATION_REASONS_KEY,
    queryFn: () => documentApi.cancellationReasons(),
    enabled: open,
    staleTime: 0,
    retry: false,
  })

  const commit = requestCloseCommit({
    status: reasons.status,
    fetching: reasons.isFetching,
    reasons: reasons.data,
    pickedCode,
  })

  // A 403 on the reasons read is the grant refusing: toast, revoke `canChangeDetail` and close.
  const reasonsRefused = commit.view === 'failed' && isGrantRefused(reasons.error)
  useEffect(() => {
    if (!open || !reasonsRefused) return
    revokeOnForbidden(queryClient, reasons.error, 'canChangeDetail')
    notify.error(t('requestClose.grantRefused.title'), t('requestClose.grantRefused.detail'))
    onClose()
    // The refusal itself is the event; `onClose` and `t` are rebuilt by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reasonsRefused])

  function submit() {
    if (!commit.picked) return
    onConfirmed(commit.picked)
    onClose()
  }

  const ready = commit.view === 'ready'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('actions.request-close')}
      width="27rem"
      // Clear the previous pick on every open — a reason carried over from a
      // dismissed dialog would be one careless click from being posted.
      onShow={() => setPickedCode('')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
          <Button variant="primary" disabled={!commit.canCommit} onClick={submit} data-request-close-commit>
            <Flag className="h-3.5 w-3.5" aria-hidden />
            {t('actions.request-close')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-[0.8125rem] text-muted-foreground">{t('requestClose.hint')}</p>
        <Field id="request-close-reason" label={t('requestClose.label')}>
          <Select
            value={pickedCode}
            onChange={(e) => setPickedCode(e.target.value)}
            disabled={!ready}
            required
            className="w-full"
            data-request-close-view={commit.view}
          >
            <option value="">{commit.view === 'loading' ? t('requestClose.loading') : t('requestClose.placeholder')}</option>
            {ready &&
              (reasons.data ?? []).map((r) => (
                <option key={r.code} value={r.code}>
                  {/* A native option is a string-only sink: the server's name, isolated whole. */}
                  {fsi(cancellationReasonName(r, i18n.language))}
                </option>
              ))}
          </Select>
          {commit.view === 'failed' && !reasonsRefused && (
            <ErrorBanner className="p-2" message={apiErrorMessage(reasons.error, t('requestClose.loadFailed'))} />
          )}
          {commit.view === 'empty' && (
            <p className="text-[0.8125rem] text-muted-foreground" data-request-close-empty>
              {t('requestClose.empty')}
            </p>
          )}
        </Field>
      </div>
    </Modal>
  )
}
