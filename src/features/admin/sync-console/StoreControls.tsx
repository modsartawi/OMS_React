import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import type { StoreDetail } from '@/core/models/sync-console'
import { syncConsoleAccessQuery } from './api'
import { allowedControls } from './control-helpers'
import ControlDialog, { CONTROL_VARIANT, type ControlOutcome, type ControlRequest } from './ControlDialog'
import ControlResults from './ControlResults'

/**
 * The store page's lasting controls (ticket 447): Pause or Resume and Hand back on a
 * worker store, Move to worker on a WPF store — `allowedControls`, by the door's host
 * and paused flag and the `canOperate` grant. Without the grant nothing renders at
 * all: absent, not disabled. Each opens the shared reason dialog.
 */
export default function StoreControls({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  const access = useQuery(syncConsoleAccessQuery())
  const [request, setRequest] = useState<ControlRequest | null>(null)
  const [outcome, setOutcome] = useState<ControlOutcome | null>(null)
  const controls = allowedControls(row, access.data)
  if (controls.length === 0) return null

  return (
    <div className="flex flex-col gap-2" data-store-controls={controls.join(' ')}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('controls.label')}>
        {controls.map((action) => (
          <Button
            key={action}
            variant={CONTROL_VARIANT[action]}
            onClick={() => setRequest({ action, codes: [row.code] })}
            data-control={action}
          >
            {t(`controls.${action}`)}
          </Button>
        ))}
      </div>
      <ControlResults outcome={outcome} onDismiss={() => setOutcome(null)} />
      <ControlDialog request={request} onClose={() => setRequest(null)} onResult={setOutcome} />
    </div>
  )
}
