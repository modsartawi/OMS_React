import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { ButtonVariant } from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import type { CommandKind, ControlAction } from '@/core/models/sync-console'
import { AUDIT_KEY, FLEET_KEY, storeKey, syncConsoleApi } from './api'
import { controlResultSummary, type ResultSummary } from './control-helpers'
import { figure } from './helpers'
import ReasonDialog from './ReasonDialog'

/** A control about to be sent: what, and to which stores. */
export interface ControlRequest {
  action: ControlAction
  codes: string[]
}

/** What a per-row answer was for: a control (447), a command or a cancel (448). */
export type OutcomeAction = ControlAction | CommandKind | 'CancelCommand'

/** A per-row answer, kept by the page so its failures stay listed after the toast has gone. */
export interface ControlOutcome {
  action: OutcomeAction
  summary: ResultSummary
}

/** A control's button, the same on the store page and the fleet's bulk bar: Move is the step
 *  forward, Hand back the one that lets go of the worker; the rest are ordinary. */
export const CONTROL_VARIANT: Record<ControlAction, ButtonVariant> = {
  Move: 'primary',
  Pause: 'secondary',
  Resume: 'secondary',
  HandBack: 'danger-outlined',
}

/** The controls whose effect deserves a sentence in the dialog (the prototype's notes). */
const NOTED: ReadonlySet<ControlAction> = new Set(['Move', 'HandBack', 'Pause'])

/**
 * The one-sentence summary of a per-row answer, for the toast. The counts are data
 * interpolated into a sentence, so each takes `fsi`; the action is the bundle's own word.
 * `group` picks the sentences: a control's (`results`, "pending until the worker
 * applies it"), a command's (`commandResults`, "queued") or a cancel's (`cancelResults`).
 */
export function resultSentence(
  t: TFunction,
  actionLabel: string,
  s: ResultSummary,
  group: 'results' | 'commandResults' | 'cancelResults' = 'results',
): string {
  return t(`${group}.${s.outcome}`, {
    action: actionLabel,
    count: s.total,
    total: fsi(figure(s.total)),
    ok: fsi(figure(s.ok)),
    failed: fsi(figure(s.failed)),
  })
}

/**
 * The toast for a per-row answer: success when every row went through, error when
 * none did, a warning in between. `detail` (a batch id, say) is not shown on an
 * all-refused answer, where nothing was queued.
 */
export function notifyOutcome(s: ResultSummary, sentence: string, detail?: string): void {
  if (s.outcome === 'allOk') notify.success(sentence, detail)
  else if (s.outcome === 'allFailed') notify.error(sentence)
  else notify.warn(sentence, detail)
}

/**
 * `POST ActionSync/Stores/Control` behind the shared reason dialog (ticket 447) — one
 * store from its page, or the fleet's selection of up to 50.
 *
 * The answer becomes one toast sentence (`controlResultSummary`), and the failures go
 * back to the page (`onResult`) to stay listed with their codes. Every answer
 * refetches the fleet, the store pages and the audit feed: the pending badge then
 * reads the door's `controlPending`, never a flag set here. Only the pages of the
 * stores in the request are refetched.
 */
export default function ControlDialog({
  request,
  onClose,
  onResult,
}: {
  request: ControlRequest | null
  onClose: () => void
  onResult: (outcome: ControlOutcome) => void
}) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: ({ action, codes, reason }: ControlRequest & { reason: string }) =>
      syncConsoleApi.control({ action, codes, reason }),
    onSuccess: (data, { action, codes }) => {
      const summary = controlResultSummary(data.results)
      const sentence = resultSentence(t, t(`controls.${action}`), summary)
      notifyOutcome(summary, sentence)
      onResult({ action, summary })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      for (const code of codes) void qc.invalidateQueries({ queryKey: storeKey(code) })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      close()
    },
  })

  const close = () => {
    send.reset()
    onClose()
  }

  if (!request) return null
  const { action, codes } = request
  const label = t(`controls.${action}`)
  const title =
    codes.length === 1
      ? t('dialog.titleOne', { action: label, code: fsi(codes[0]) })
      : t('dialog.titleMany', { action: label, count: codes.length, n: fsi(figure(codes.length)) })

  return (
    <ReasonDialog
      open
      title={title}
      codes={codes}
      note={NOTED.has(action) ? t(`controls.notes.${action}`) : undefined}
      busy={send.isPending}
      error={send.error}
      confirmLabel={label}
      onConfirm={(reason) => send.mutate({ action, codes, reason })}
      onClose={close}
    />
  )
}
