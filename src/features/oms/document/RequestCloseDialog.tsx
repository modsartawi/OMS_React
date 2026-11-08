import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Flag } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import { apiErrorMessage } from '@/core/api'
import type { CancellationReasonModel } from '@/core/models/sd-document'
import { fsi } from '@/core/util/bidi'
import { documentApi } from './api'
import { cancellationReasonName, requestCloseCommit } from './request-close'

const REASONS_KEY = ['oms', 'cancellation-reasons'] as const

/**
 * Screen 2 — Request cancellation's reason picker (BackOffice spec 3461, door 3462; oms-react 855).
 *
 * The reasons are the server's active cancellation reasons, asked again on every open (stale at once, so a
 * reason the business retired is gone the next time), in the server's order, each shown in the UI
 * language. The pick posts its code as `reasonCode` and its English name as the note (`request-close.ts`).
 * A list that fails to load says so inline and commit stays disabled. A reason retired while the dialog
 * was open is refused by the server; the page's toast words that refusal by its code.
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
  const [pickedCode, setPickedCode] = useState('')

  const reasons = useQuery({
    queryKey: REASONS_KEY,
    queryFn: () => documentApi.cancellationReasons(),
    enabled: open,
    staleTime: 0,
    retry: false,
  })

  const commit = requestCloseCommit({ status: reasons.status, reasons: reasons.data, pickedCode })

  function submit() {
    if (!commit.picked) return
    onConfirmed(commit.picked)
    onClose()
  }

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
            disabled={!reasons.isSuccess}
            required
            className="w-full"
          >
            <option value="">{reasons.isPending ? t('requestClose.loading') : t('requestClose.placeholder')}</option>
            {(reasons.data ?? []).map((r) => (
              <option key={r.code} value={r.code}>
                {/* A native option is a string-only sink: the server's name, isolated whole. */}
                {fsi(cancellationReasonName(r, i18n.language))}
              </option>
            ))}
          </Select>
          {commit.loadFailed && (
            <ErrorBanner
              className="p-2"
              message={apiErrorMessage(reasons.error, t('requestClose.loadFailed'))}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
