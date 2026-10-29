import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { AUDIT_KEY, SCRIPTS_KEY, syncConsoleApi } from './api'
import { retryPreviewSentence, scriptRefusalKey, withdrawPreviewSentence, type PreviewSentence } from './scripts-helpers'
import ReasonDialog from './ReasonDialog'
import ScriptRefusal from './ScriptRefusal'

/**
 * What a script's detail asks for (ticket 664, BackOffice spec 3202 D7/D9, door 3206):
 * - `withdraw`: every store that has not run it is withdrawn; executed stores stay executed;
 * - `retry` with no `code`: every exhausted store gets five fresh attempts (`codes` left out);
 * - `retry` with a `code`: that exhausted store alone (`codes: [code]`).
 */
export type ScriptAction = { kind: 'withdraw' } | { kind: 'retry'; code?: string }

/**
 * Withdraw or Retry, on the shared reason dialog: preview first (`preview: true`, writes nothing;
 * it answers how many stores the write would touch), then confirm with the reason
 * (`preview: false`, the same body). A refusal shows with its code and the dialog stays open.
 * Success toasts, and the list, the detail and the audit feed are re-read.
 */
export default function ScriptActionDialog({
  scriptId,
  title,
  action,
  onClose,
}: {
  scriptId: string
  /** The script's title, as the dialog and the toast name it. */
  title: string
  action: ScriptAction | null
  onClose: () => void
}) {
  if (!action) return null
  const key = action.kind === 'retry' ? `retry:${action.code ?? '*'}` : 'withdraw'
  return <Act key={key} scriptId={scriptId} title={title} action={action} onClose={onClose} />
}

function Act({ scriptId, title, action, onClose }: { scriptId: string; title: string; action: ScriptAction; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const [preview, setPreview] = useState<PreviewSentence | null>(null)
  const ns = action.kind === 'withdraw' ? 'scriptWithdraw' : 'scriptRetry'

  const post = (reason: string, isPreview: boolean): Promise<PreviewSentence> =>
    action.kind === 'withdraw'
      ? syncConsoleApi.withdrawScript({ scriptId, reason, preview: isPreview }).then(withdrawPreviewSentence)
      : syncConsoleApi
          .retryScript({ scriptId, ...(action.code ? { codes: [action.code] } : {}), reason, preview: isPreview })
          .then(retryPreviewSentence)

  const ask = useMutation({
    mutationFn: (reason: string) => post(reason, true),
    // A new preview sets the last confirm's refusal aside.
    onMutate: () => send.reset(),
    onSuccess: setPreview,
    onError: () => setPreview(null),
  })

  const send = useMutation({
    mutationFn: (reason: string) => post(reason, false),
    onSuccess: (done) => {
      notify.success(t(`${ns}.done`, { count: done.count, n: fsi(done.n), title: fsi(title) }))
      void qc.invalidateQueries({ queryKey: SCRIPTS_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      onClose()
    },
  })

  const close = () => {
    if (send.isPending) return
    onClose()
  }

  const dialogTitle =
    action.kind === 'withdraw'
      ? t('scriptWithdraw.title', { title: fsi(title) })
      : action.code
        ? t('scriptRetry.titleStore', { title: fsi(title), code: fsi(action.code) })
        : t('scriptRetry.titleAll', { title: fsi(title) })

  return (
    <ReasonDialog
      open
      title={dialogTitle}
      codes={action.kind === 'retry' && action.code ? [action.code] : undefined}
      note={t(`${ns}.note`)}
      busy={send.isPending}
      error={send.error}
      codeLabel={scriptRefusalKey}
      confirmLabel={t(`${ns}.confirm`)}
      confirmDisabled={preview === null || ask.isPending}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={close}
      extraAction={(reason, reasonOk) => (
        <Button variant="secondary" disabled={!reasonOk || ask.isPending} onClick={() => ask.mutate(reason)} data-script-action-preview="">
          {ask.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {ask.isPending ? t(`${ns}.previewing`) : t(`${ns}.previewButton`)}
        </Button>
      )}
    >
      <div
        className="rounded-md border border-border/60 px-3 py-2 text-xs"
        aria-live="polite"
        data-script-action={action.kind}
        data-script-action-preview-box={preview ? 'fresh' : 'none'}
      >
        {preview ? (
          <p className="font-medium" data-script-action-sentence="">
            {t(preview.key, { count: preview.count, n: fsi(preview.n) })}
          </p>
        ) : (
          <p className="text-muted-foreground">{t(`${ns}.previewFirst`)}</p>
        )}
      </div>
      {ask.error != null && <ScriptRefusal error={ask.error} title={t(`${ns}.previewFailed`)} />}
      {send.error != null && <ScriptRefusal error={send.error} title="" storesOnly />}
    </ReasonDialog>
  )
}
