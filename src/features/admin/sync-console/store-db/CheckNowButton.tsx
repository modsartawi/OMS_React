import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCcwDot } from 'lucide-react'

import type { StoreDbStore } from '@/core/models/store-database'
import { usePermissions } from '@/core/permissions'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { AUDIT_KEY } from '../api'
import ReasonDialog from '../ReasonDialog'
import { STORE_DB_FLEET_KEY, storeDbApi, storeDbHealthKey, storeDbStoreKey } from './api'
import { checkNowBody, checkNowVisible } from './check-now'

/**
 * Check now (oms 917, BO 4032 door `POST StoreDatabase/CheckNow`): `StoreDatabase.Act`, a reason, audited. Hidden
 * without Act. The fresh reading the door answers REPLACES the page's read (`setQueryData` on the store's key), so the
 * header, the Not checked banner and the Readings panel show it at once; the health check is re-run, the fleet and
 * the audit feed re-read. The read can take up to ~30 s (spec D3): the dialog stays busy meanwhile.
 */
export default function CheckNowButton({ store }: { store: StoreDbStore }) {
  const { t } = useTranslation('sync-console')
  const permissions = usePermissions()
  const [open, setOpen] = useState(false)
  if (!checkNowVisible(permissions)) return null
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
    onSuccess: (fresh) => {
      qc.setQueryData(storeDbStoreKey(store.code), fresh)
      void qc.invalidateQueries({ queryKey: storeDbHealthKey(store.code) })
      void qc.invalidateQueries({ queryKey: STORE_DB_FLEET_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      if (fresh.lastAttempt?.succeeded === false) notify.warn(t('storeDb.live.checkNow.failedRead', { code: fsi(store.code) }))
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
