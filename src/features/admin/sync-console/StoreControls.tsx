import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import type { StoreDetail } from '@/core/models/sync-console'
import { syncConsoleAccessQuery } from './api'
import { isCommandKind, storeActions } from './command-helpers'
import CommandDialog, { type CommandRequest } from './CommandDialog'
import { CommandRunLine, useCommandRun } from './CommandRun'
import ControlDialog, { CONTROL_VARIANT, type ControlOutcome, type ControlRequest } from './ControlDialog'
import ControlResults from './ControlResults'
import RePushDialog from './RePushDialog'

/**
 * The store page's control row: the lasting controls (ticket 447 — Pause or Resume
 * and Hand back on a worker store, Move to worker on a WPF store) and the one-shot
 * commands (ticket 448 — Retry now, Re-push and Test connection on a worker store,
 * Test connection alone on a WPF store), in the prototype's order (`storeActions`).
 * Without `canOperate` nothing renders at all: absent, not disabled.
 *
 * Every button opens a reason dialog. Retry now and Test connection are then
 * followed to their end on this page ("testing…", then OK or the error).
 */
export default function StoreControls({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  const access = useQuery(syncConsoleAccessQuery())
  const [control, setControl] = useState<ControlRequest | null>(null)
  const [command, setCommand] = useState<CommandRequest | null>(null)
  const [rePush, setRePush] = useState<string[] | null>(null)
  const [outcome, setOutcome] = useState<ControlOutcome | null>(null)
  const { run, follow, dismiss } = useCommandRun(row.code)
  const actions = storeActions(row, access.data)
  if (actions.length === 0) return null

  const open = (action: (typeof actions)[number]) => {
    if (action === 'RePush') setRePush([row.code])
    else if (isCommandKind(action)) setCommand({ kind: action, code: row.code })
    else setControl({ action, codes: [row.code] })
  }

  return (
    <div className="flex flex-col gap-2" data-store-controls={actions.join(' ')}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('controls.label')}>
        {actions.map((action) => (
          <Button
            key={action}
            // The one-shot commands are ordinary buttons beside the lasting controls.
            variant={isCommandKind(action) ? 'secondary' : CONTROL_VARIANT[action]}
            onClick={() => open(action)}
            data-control={action}
          >
            {t(`controls.${action}`)}
          </Button>
        ))}
      </div>
      <CommandRunLine run={run} onDismiss={dismiss} />
      <ControlResults outcome={outcome} onDismiss={() => setOutcome(null)} />
      <ControlDialog request={control} onClose={() => setControl(null)} onResult={setOutcome} />
      <CommandDialog
        request={command}
        onClose={() => setCommand(null)}
        onQueued={follow}
        onResult={(o) => setOutcome(o.summary.failures.length > 0 ? o : null)}
      />
      <RePushDialog codes={rePush} onClose={() => setRePush(null)} onResult={setOutcome} />
    </div>
  )
}
