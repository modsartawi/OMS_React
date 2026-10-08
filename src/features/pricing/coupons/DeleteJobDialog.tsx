import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Trash2 } from 'lucide-react'
import { ApiError, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import { notify } from '@/core/services/notify'
import type { ImportJob } from '@/core/models/coupons'
import { fsi } from '@/core/util/bidi'
import { couponsApi } from './api'
import { describeDeletePreview, isolatedCount } from './helpers'

// Delete a mistaken upload (spec 2463, ticket 439; BackOffice 2465/2466). The dialog reads the
// server's preview first and states it in plain language; a preview that refuses (`canDelete`
// false) shows the server's reason and the confirm stays shut. A reason is required and capped at
// the server's 512 characters, so the CUP-09099 length refusal never reaches a user.
//
// A delete that the server refuses after the confirm with a 409 (another upload went active, or the
// job was already deleted) means the row has moved on: the dialog closes, toasts through
// `notify.apiError` as the ticket asks, and the grid re-reads. Any other failure (network, 5xx, a
// 400) is said inside the dialog, which stays open with the typed reason (spec 380 F18).

const REASON_MAX = 512

interface Props {
  /** The row being deleted; null keeps the dialog shut. */
  job: ImportJob | null
  onClose: () => void
  /** Re-read the jobs grid (after a delete, or after a refusal). */
  onSettled: () => void | Promise<void>
}

export default function DeleteJobDialog({ job, onClose, onSettled }: Props) {
  const { t } = useTranslation('coupons')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const jobId = job?.jobId ?? null
  // Read fresh on every open: what a delete removes changes while other uploads run.
  const preview = useQuery({
    queryKey: ['coupons', 'jobs', 'deletePreview', jobId],
    queryFn: () => couponsApi.jobDeletePreview(jobId!),
    enabled: jobId !== null,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  })

  function close() {
    if (busy) return
    setReason('')
    setError(null)
    onClose()
  }

  const ready = preview.data?.canDelete === true && reason.trim().length > 0 && !busy

  async function confirm() {
    if (!job || !ready) return
    setBusy(true)
    setError(null)
    // The toast is raised only after the dialog has closed: under an open `showModal()` it would
    // paint beneath the backdrop (spec 380 F18).
    let toast: () => void
    try {
      const result = await couponsApi.deleteJob(job.jobId, reason.trim())
      toast = () => notify.success(t('import.delete.done', { count: result.deleted, n: isolatedCount(result.deleted) }))
    } catch (err) {
      if (!(err instanceof ApiError && err.statusCode === 409)) {
        setError(err)
        return
      }
      toast = () => notify.apiError(t('import.delete.failed'), err)
    } finally {
      setBusy(false)
    }
    setReason('')
    onClose()
    toast()
    await onSettled()
  }

  const data = preview.data

  return (
    <Modal
      open={job !== null}
      onClose={close}
      title={t('import.delete.title')}
      width="28rem"
      footer={
        <>
          <Button variant="text" onClick={close} disabled={busy}>
            {t('import.delete.cancel')}
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={!ready}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t('import.delete.confirm')}
          </Button>
        </>
      }
    >
      {job && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {t('import.delete.intro', { jobId: fsi(job.jobId), templateId: fsi(job.templateId) })}
          </p>

          {preview.isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('import.delete.loading')}
            </div>
          ) : preview.isError ? (
            <ErrorBanner
              title={t('import.delete.previewFailed')}
              message={apiErrorMessage(preview.error, t('import.delete.previewFailed'))}
              className="p-2.5"
            />
          ) : data?.canDelete ? (
            <>
              <p data-testid="delete-preview">{describeDeletePreview(data, t)}</p>
              <p className="text-xs text-muted-foreground">{t('import.delete.cannotUndo')}</p>
            </>
          ) : data ? (
            // A refused preview states only the refusal: the counts describe a delete that won't happen.
            <ErrorBanner
              title={t('import.delete.refused')}
              message={data.refusalMessage ?? t('import.delete.refused')}
              className="p-2.5"
            />
          ) : null}

          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('import.delete.reason')}
            <input
              type="text"
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary"
              value={reason}
              maxLength={REASON_MAX}
              disabled={busy || data?.canDelete !== true}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error !== null && (
            <ErrorBanner
              title={t('import.delete.failed')}
              message={apiErrorMessage(error, t('import.delete.failed'))}
              className="p-2.5"
            />
          )}
        </div>
      )}
    </Modal>
  )
}
