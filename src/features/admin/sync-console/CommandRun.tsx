import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, X, XCircle, Clock } from 'lucide-react'
import type { SyncCommand } from '@/core/models/sync-console'
import { AUDIT_KEY, COMMANDS_KEY, FLEET_KEY, storeKey, syncConsoleApi } from './api'
import { pollUntilTerminal, runVerdict, type RunVerdict } from './command-helpers'
import type { QueuedCommand } from './CommandDialog'
import IconButton from '@/core/ui/IconButton'

/** One command being followed on a store's page. */
export interface CommandRunState {
  queued: QueuedCommand
  verdict: RunVerdict
  command: SyncCommand | undefined
}

/**
 * Follows a queued command to its end (ticket 448): `GET ActionSync/Commands?batch=`
 * every 2 s until every command of the batch is terminal, or 60 s have passed — then
 * it reads "still running", never "failed". A newer command replaces the one being
 * followed, and leaving the page stops the poll. The end refetches the store, the
 * fleet, the commands and the audit feed.
 */
export function useCommandRun(code: string) {
  const qc = useQueryClient()
  const [run, setRun] = useState<CommandRunState | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const follow = useCallback(
    (queued: QueuedCommand) => {
      abort.current?.abort()
      const ctl = new AbortController()
      abort.current = ctl
      setRun({ queued, verdict: 'running', command: undefined })
      const mine = (list: SyncCommand[]) => list.find((c) => c.id === queued.commandId)
      void pollUntilTerminal(() => syncConsoleApi.batch(queued.batchId).then((p) => p.items), {
        signal: ctl.signal,
        onUpdate: (list) => setRun({ queued, verdict: runVerdict(mine(list), false), command: mine(list) }),
      }).then(({ outcome, commands }) => {
        if (outcome === 'aborted') return
        const command = mine(commands)
        setRun({ queued, verdict: runVerdict(command, outcome === 'timeout'), command })
        void qc.invalidateQueries({ queryKey: storeKey(code) })
        void qc.invalidateQueries({ queryKey: COMMANDS_KEY })
        void qc.invalidateQueries({ queryKey: AUDIT_KEY })
        void qc.invalidateQueries({ queryKey: FLEET_KEY })
      })
    },
    [code, qc],
  )

  const dismiss = useCallback(() => {
    abort.current?.abort()
    setRun(null)
  }, [])

  return { run, follow, dismiss }
}

const TONE: Record<RunVerdict, string> = {
  running: 'border-border/60 bg-muted text-muted-foreground',
  ok: 'border-success-border bg-success-050 text-success-800',
  failed: 'border-danger-border bg-danger-050 text-danger-800',
  stillRunning: 'border-attention-border bg-attention-050 text-attention-800',
}

/**
 * The followed command's line: "Testing…", then OK or the command's flattened
 * error (its `result`, the worker's own words, isolated as free text).
 */
export function CommandRunLine({ run, onDismiss }: { run: CommandRunState | null; onDismiss: () => void }) {
  const { t } = useTranslation('sync-console')
  if (!run) return null
  const { verdict, command, queued } = run
  const Icon = verdict === 'running' ? Loader2 : verdict === 'ok' ? CheckCircle2 : verdict === 'failed' ? XCircle : Clock
  return (
    <div
      className={'flex items-start gap-2 rounded-md border px-3 py-2 text-xs ' + TONE[verdict]}
      role="status"
      aria-label={t('run.label')}
      data-command-run={queued.kind}
      data-run-verdict={verdict}
    >
      <Icon className={'mt-0.5 h-3.5 w-3.5 shrink-0' + (verdict === 'running' ? ' animate-spin' : '')} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{t(`run.${queued.kind}.${verdict}`)}</span>
        {verdict !== 'running' && command?.result && (
          <bdi className="[overflow-wrap:anywhere]" data-run-result="">
            {command.result}
          </bdi>
        )}
      </div>
      {verdict !== 'running' && (
        <IconButton size="compact" label={t('run.dismiss')} onClick={onDismiss} data-run-dismiss="">
          <X className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      )}
    </div>
  )
}
