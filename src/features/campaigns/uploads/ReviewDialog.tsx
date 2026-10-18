import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorDetails, apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleUploadActivation, RuleUploadDetail, RuleUploadSummary } from '@/core/models/rule-upload'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { campaignUploadApi } from './api'
import { campaignChanges, uploadRefusalView, type ReviewAction } from './review'

/** A note's longest length, as draft approval's: a sentence or two for the uploader or the version history. */
const NOTE_MAX = 500

/**
 * Activate or Send back, confirmed in a dialog (ticket 532), on the revision LOADED — the whole upload,
 * never one campaign of it. Activate repeats the counts and the disabling list and takes an optional
 * note; Send back takes a required one. A refusal shows inside, the dialog kept open and the upload
 * left as it was, the way draft approval shows them (our words, HQ's message where it says more,
 * its detail lines, its code, and the next step).
 */
export default function ReviewDialog({
  detail,
  action,
  onClose,
  onSendBack,
  onReload,
  onList,
  onActivated,
  onSentBack,
}: {
  detail: RuleUploadDetail
  action: ReviewAction
  onClose: () => void
  /** A refused activation that must go back to its uploader: the Send back dialog instead. */
  onSendBack: () => void
  /** The upload moved since it was loaded: load it again. */
  onReload: () => void
  /** A stale link: the list. */
  onList: () => void
  onActivated: (activation: RuleUploadActivation) => void
  onSentBack: (upload: RuleUploadSummary) => void
}) {
  const { t } = useTranslation('campaign-uploads')
  const noteId = useId()
  const hintId = useId()
  const [note, setNote] = useState('')
  const { upload, campaigns, disabling } = detail
  const body = { dealCode: upload.dealCode, revision: upload.revision, note }
  const activate = useMutation({ mutationFn: () => campaignUploadApi.activate(body), onSuccess: onActivated })
  const sendBack = useMutation({ mutationFn: () => campaignUploadApi.sendBack(body), onSuccess: onSentBack })
  const run = action === 'activate' ? activate : sendBack
  const noted = action === 'activate' || note.trim().length > 0
  const ready = !run.isPending && noted
  const changes = campaignChanges(campaigns)

  return (
    <Modal
      open
      onClose={() => !run.isPending && onClose()}
      title={t(`review.dialog.${action}.title`)}
      width="36rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={run.isPending} data-review-cancel="">
            {t('review.dialog.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} onClick={() => ready && run.mutate()} data-review-confirm="">
            {run.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t(`review.dialog.${action}.confirm`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-review-dialog={action}>
        <p className="text-sm">
          <Trans
            t={t}
            i18nKey={`review.dialog.${action}.body`}
            values={{ deal: upload.dealCode, revision: upload.revision, by: upload.uploadedBy }}
            components={{ deal: <Ltr />, rev: <Ltr />, by: <Ltr /> }}
          />
        </p>

        {action === 'activate' && (
          <>
            <p className="text-sm" data-review-counts="">
              <Trans
                t={t}
                i18nKey="review.dialog.activate.counts"
                count={campaigns.length}
                values={changes}
                components={{ n: <Ltr />, new: <Ltr />, changed: <Ltr />, unchanged: <Ltr /> }}
              />
            </p>
            {disabling.length > 0 ? (
              <div className="rounded-md border border-danger-border bg-danger-050 p-2.5 text-sm text-danger-800" data-review-disabling={disabling.length}>
                <p className="font-semibold">
                  <Trans t={t} i18nKey="review.disabling.title" count={disabling.length} components={{ n: <Ltr /> }} />
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs">
                  {disabling.map((d) => (
                    <li key={d.id} data-review-disabling-id={d.id}>
                      <Ltr>{d.id}</Ltr>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground" data-review-no-disabling="">
                {t('review.dialog.activate.noDisabling')}
              </p>
            )}
          </>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="text-xs font-medium text-muted-foreground">
            {t(`review.dialog.${action}.note`)}
          </label>
          <textarea
            id={noteId}
            dir="auto"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            required={action === 'sendBack'}
            aria-describedby={action === 'sendBack' ? hintId : undefined}
            onChange={(e) => {
              setNote(e.target.value)
              if (run.isError) run.reset()
            }}
            disabled={run.isPending}
            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            data-review-note=""
          />
          {action === 'sendBack' && (
            <p id={hintId} className="text-xs text-muted-foreground" data-review-note-required="">
              {t('review.dialog.sendBack.required')}
            </p>
          )}
        </div>

        {run.isError && <Refusal action={action} error={run.error} onReload={onReload} onSendBack={onSendBack} onList={onList} />}
      </div>
    </Modal>
  )
}

/** HQ's refusal of Activate or Send back, by its code (`uploadRefusalView`). */
function Refusal({
  action,
  error,
  onReload,
  onSendBack,
  onList,
}: {
  action: ReviewAction
  error: unknown
  onReload: () => void
  onSendBack: () => void
  onList: () => void
}) {
  const { t } = useTranslation('campaign-uploads')
  const code = apiErrorCode(error)
  const bareDenial = isBareDenial(error)
  const view = uploadRefusalView(action, { code, bareDenial, details: apiErrorDetails(error) })
  const fallback = t('review.refused.fallback')
  const said = view.reason === 'denied' ? t('denied') : view.reason ? t(`review.refusal.${view.reason}`) : apiErrorMessage(error, fallback)
  return (
    <div data-review-refusal={action} data-review-refusal-reason={view.reason ?? undefined} data-upload-denied={bareDenial ? '' : undefined}>
      <ErrorBanner className="p-2.5" title={t(`review.refused.${action}`)} message={said}>
        {/* HQ's own message under our words, as draft approval shows a refusal with its code. */}
        {view.reason && view.reason !== 'denied' && (
          <p className="mt-1 text-xs" data-review-refusal-message="">
            <bdi>{apiErrorMessage(error, fallback)}</bdi>
          </p>
        )}
        {view.details.length > 0 && (
          <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-4 text-xs" data-review-refusal-details={view.details.length}>
            {view.details.map((line, i) => (
              <li key={i}>
                <bdi>{line}</bdi>
              </li>
            ))}
          </ul>
        )}
        {code && (
          <p className="mt-1 text-xs" data-review-refusal-code={code}>
            {t('review.refused.code')}{' '}
            <span className="font-mono">
              <Ltr>{code}</Ltr>
            </span>
          </p>
        )}
        {view.next === 'reload' && (
          <Button variant="outlined" className="mt-2" onClick={onReload} data-review-reload="">
            {t('review.refusal.reload')}
          </Button>
        )}
        {view.next === 'sendBack' && (
          <Button variant="outlined" className="mt-2" onClick={onSendBack} data-review-send-back="">
            {t('review.refusal.sendBack')}
          </Button>
        )}
        {view.next === 'list' && (
          <Button variant="outlined" className="mt-2" onClick={onList} data-review-list="">
            {t('review.refusal.list')}
          </Button>
        )}
      </ErrorBanner>
    </div>
  )
}
