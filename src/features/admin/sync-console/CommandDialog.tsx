import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import type { SyncCommandRequest } from '@/core/models/sync-console'
import { AUDIT_KEY, COMMANDS_KEY, FLEET_KEY, syncConsoleApi } from './api'
import { controlResultSummary } from './control-helpers'
import { resultSentence, type ControlOutcome } from './ControlDialog'
import ReasonDialog from './ReasonDialog'

/** A one-shot command about to be sent from a store's page. */
export interface CommandRequest {
  kind: SyncCommandRequest['kind']
  code: string
}

/** A command the door queued: the batch to poll, and the store's own command in it. */
export interface QueuedCommand {
  kind: SyncCommandRequest['kind']
  batchId: string
  commandId: string
}

/**
 * `POST ActionSync/Commands` — Retry now or Test connection on one store — behind the
 * shared reason dialog (ticket 448).
 *
 * A queued command goes back to the page (`onQueued`), which polls it to its end. A
 * refused one (`NOT_ON_WORKER`, `DUPLICATE_PENDING`) is one toast sentence plus the
 * listed failure (`onResult`), and nothing is polled. A whole refusal stays in the
 * dialog with its code.
 */
export default function CommandDialog({
  request,
  onClose,
  onQueued,
  onResult,
}: {
  request: CommandRequest | null
  onClose: () => void
  onQueued: (queued: QueuedCommand) => void
  onResult: (outcome: ControlOutcome) => void
}) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: ({ kind, code, reason }: CommandRequest & { reason: string }) =>
      syncConsoleApi.sendCommand({ kind, codes: [code], reason }),
    onSuccess: (data, { kind, code }) => {
      const summary = controlResultSummary(data.results)
      const mine = data.results.find((r) => r.code === code && r.ok && r.commandId)
      if (mine?.commandId) onQueued({ kind, batchId: data.batchId, commandId: mine.commandId })
      else if (summary.outcome === 'allOk') {
        // Queued, but the door named no command: there is nothing to follow here.
        notify.warn(t('run.untracked', { action: t(`auditActions.${kind}`) }))
      } else {
        // Refused: its code is listed under the controls.
        notify.error(resultSentence(t, t(`auditActions.${kind}`), summary, 'commandResults'))
      }
      onResult({ action: kind, summary })
      void qc.invalidateQueries({ queryKey: COMMANDS_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      close()
    },
  })

  const close = () => {
    send.reset()
    onClose()
  }

  if (!request) return null
  const { kind, code } = request
  const label = t(`controls.${kind}`)

  return (
    <ReasonDialog
      open
      title={t('dialog.titleOne', { action: label, code: fsi(code) })}
      codes={[code]}
      note={t(`controls.notes.${kind}`)}
      busy={send.isPending}
      error={send.error}
      confirmLabel={label}
      onConfirm={(reason) => send.mutate({ kind, code, reason })}
      onClose={close}
    />
  )
}
