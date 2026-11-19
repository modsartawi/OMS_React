import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCcwDot } from 'lucide-react'

import type { StoreDbStore } from '@/core/models/store-database'
import { usePermissions } from '@/core/permissions'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { canActStoreDb } from '../access'
import { AUDIT_KEY } from '../api'
import ReasonDialog from '../ReasonDialog'
import { STORE_DB_FLEET_KEY, storeDbApi, storeDbHealthKey, storeDbStoreKey } from './api'
import { checkNowBody, checkNowOutcome } from './check-now'

/**
 * Check now (oms 917, BO 4032 door `POST StoreDatabase/CheckNow`): `StoreDatabase.Act`, a reason, audited. Hidden
 * without Act. The door answers the reading it took, not a store page: the server keeps it, so the store's page and its
 * health check are re-read (exact keys — the live look and sp_Blitz are not re-run), and the fleet and the audit feed.
 * A failed read is told as a failure. The read can take up to ~30 s (spec D3): the dialog stays busy meanwhile.
 */
export default function CheckNowButton({ store }: { store: StoreDbStore }) {
  const { t } = useTranslation('sync-console')
  const permissions = usePermissions()
  const [open, setOpen] = useState(false)
  if (!canActStoreDb(permissions)) return null
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)} data-check-now="">
        <RefreshCcwDot className="h-3.5 w-3.5" aria-hidden />
        {t('storeDb.live.checkNow.button')}
      </Button>
      {open && <CheckNowDialog store={store} onClose={() => setOpen(false)} />}
    </>
  )
}

function CheckNowDialog({ store, onClose }: { store: StoreDbStore; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: (reason: string) => {
      const body = checkNowBody(store.code, reason)
      // The dialog never confirms without a reason; this only keeps the door from ever being sent an empty one.
      if (!body) return Promise.reject(new Error('reason required'))
      return storeDbApi.checkNow(body)
    },
    onSuccess: (answer) => {
      void qc.invalidateQueries({ queryKey: storeDbStoreKey(store.code), exact: true })
      void qc.invalidateQueries({ queryKey: storeDbHealthKey(store.code), exact: true })
      void qc.invalidateQueries({ queryKey: STORE_DB_FLEET_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      if (checkNowOutcome(answer) === 'failedRead') notify.warn(t('storeDb.live.checkNow.failedRead', { code: fsi(store.code) }))
      else notify.success(t('storeDb.live.checkNow.done', { code: fsi(store.code) }))
      onClose()
    },
  })

  return (
    <ReasonDialog
      open
      title={t('storeDb.live.checkNow.title')}
      codes={[store.code]}
      note={t('storeDb.live.checkNow.note')}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('storeDb.live.checkNow.confirm')}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    />
  )
}
