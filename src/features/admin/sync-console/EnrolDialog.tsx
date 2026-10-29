import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import type { EnrolObjectResponse, PushObject } from '@/core/models/sync-console'
import { AUDIT_KEY, OBJECTS_KEY, syncConsoleApi } from './api'
import { figure } from './helpers'
import { enrolPreviewSentence, enrolRefusalKey } from './objects-helpers'
import ReasonDialog from './ReasonDialog'

/**
 * The enrol dialog (ticket 662, BackOffice 2558-2560): one object, on the shared reason dialog.
 *
 * - **Preview** sends the object and the reason with `preview: true` (the door checks the reason
 *   first, so a preview needs one too). It writes nothing and takes no lock, and answers with the
 *   rows it would send, the stores and the action block as it would start now.
 * - **Enrol** stays disabled until a preview has answered, then posts the same object with
 *   `preview: false`. The block can move between the two (another writer may take numbers); the
 *   real answer's counts are the ones the toast reports.
 * - A refusal from either shows with its code and its words, and the dialog stays open.
 */
export default function EnrolDialog({ object, onClose }: { object: PushObject | null; onClose: () => void }) {
  if (!object) return null
  // Keyed on the object, so a new opening never carries the last one's preview.
  return <Enrol key={object.objectId} object={object} onClose={onClose} />
}

function Enrol({ object, onClose }: { object: PushObject; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const [preview, setPreview] = useState<EnrolObjectResponse | null>(null)

  const ask = useMutation({
    mutationFn: (reason: string) => syncConsoleApi.enrolObject({ objectId: object.objectId, reason, preview: true }),
    onSuccess: (data) => setPreview(data),
    onError: () => setPreview(null),
  })

  const send = useMutation({
    mutationFn: (reason: string) => syncConsoleApi.enrolObject({ objectId: object.objectId, reason, preview: false }),
    onSuccess: (data) => {
      notify.success(
        t('enrol.done', {
          count: data.actionsMinted,
          objectId: fsi(data.objectId),
          stores: fsi(figure(data.storesEnrolled)),
          rows: fsi(figure(data.actionsMinted)),
        }),
      )
      void qc.invalidateQueries({ queryKey: OBJECTS_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      onClose()
    },
    // An object enrolled behind the list's back is now listed as enrolled.
    onError: (err) => {
      if (apiErrorCode(err) === 'ALREADY_ENROLLED') void qc.invalidateQueries({ queryKey: OBJECTS_KEY })
    },
  })

  const close = () => {
    if (send.isPending) return
    onClose()
  }

  const sentence = preview ? enrolPreviewSentence(preview) : null
  const askCode = ask.error ? apiErrorCode(ask.error) : null
  const askCodeKey = askCode ? enrolRefusalKey(askCode) : null

  return (
    <ReasonDialog
      open
      title={t('enrol.title', { objectId: fsi(object.objectId) })}
      note={t('enrol.note')}
      busy={send.isPending}
      error={send.error}
      codeLabel={enrolRefusalKey}
      confirmLabel={t('enrol.confirm')}
      confirmDisabled={preview === null || ask.isPending}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={close}
      extraAction={(reason, reasonOk) => (
        <Button
          variant="secondary"
          disabled={!reasonOk || ask.isPending}
          onClick={() => ask.mutate(reason)}
          data-enrol-preview-button=""
        >
          {ask.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {ask.isPending ? t('enrol.previewing') : t('enrol.previewButton')}
        </Button>
      )}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs" data-enrol-object={object.objectId}>
        <dt className="text-muted-foreground">{t('objects.columns.objectId')}</dt>
        <dd className="font-mono">
          <Ltr>{object.objectId}</Ltr>
        </dd>
        <dt className="text-muted-foreground">{t('objects.columns.table')}</dt>
        <dd className="font-mono">
          <Ltr>{object.table ?? ''}</Ltr>
        </dd>
        <dt className="text-muted-foreground">{t('objects.columns.lineNumber')}</dt>
        <dd className="font-mono">
          <Ltr>{object.lineNumber === null ? '' : String(object.lineNumber)}</Ltr>
        </dd>
      </dl>

      <div
        className="rounded-md border border-border/60 px-3 py-2 text-xs"
        aria-live="polite"
        data-enrol-preview={preview ? 'fresh' : 'none'}
      >
        {sentence ? (
          <p className="font-medium" data-enrol-sentence="">
            {t(sentence.key, {
              count: sentence.values.count,
              rows: fsi(sentence.values.rows),
              stores: fsi(sentence.values.stores),
              line: fsi(sentence.values.line),
              from: fsi(sentence.values.from),
              to: fsi(sentence.values.to),
            })}
          </p>
        ) : (
          <p className="text-muted-foreground">{t('enrol.previewFirst')}</p>
        )}
      </div>

      {/* A failed preview is told apart from a failed enrolment (which shows under the reason). */}
      {ask.error != null && (
        <div data-enrol-preview-error={askCode ?? ''}>
          <ErrorBanner className="p-2" message={apiErrorMessage(ask.error, t('enrol.previewFailed'))}>
            {askCodeKey && <span className="me-2 text-xs">{t(askCodeKey)}</span>}
            {askCode && (
              <span className="font-mono text-xs">
                <Ltr>{askCode}</Ltr>
              </span>
            )}
          </ErrorBanner>
        </div>
      )}
    </ReasonDialog>
  )
}
