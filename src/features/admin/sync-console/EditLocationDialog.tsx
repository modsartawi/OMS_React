import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import type { StoreLocation } from '@/core/models/sync-console'
import { AUDIT_KEY, FLEET_KEY, storeKey, syncConsoleApi } from './api'
import { cleanLocationEdit, locationEditReady, type LocationEdit } from './onboard-helpers'
import { TextField } from './TextField'
import ReasonDialog from './ReasonDialog'

const FIELDS: readonly { key: keyof LocationEdit; ltr: boolean }[] = [
  { key: 'description', ltr: false },
  { key: 'ip', ltr: true },
  { key: 'instance', ltr: true },
  { key: 'dbName', ltr: true },
]

/**
 * Edit location (ticket 449), on the shared reason dialog: the description, the IP,
 * the instance and the database — and nothing else. 🚩 The code, the template and the
 * credentials cannot be changed here, and no credential field exists.
 *
 * Save is offered once a field has changed and none is blank (`locationEditReady`);
 * values are sent trimmed. Mounted only while open, so it always opens on the
 * location as the door last returned it.
 */
export default function EditLocationDialog({ location, onClose }: { location: StoreLocation; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const current: LocationEdit = {
    description: location.description,
    ip: location.ip,
    instance: location.instance,
    dbName: location.dbName,
  }
  const [edit, setEdit] = useState<LocationEdit>(current)
  const save = useMutation({
    mutationFn: (reason: string) => syncConsoleApi.editLocation({ code: location.code, ...cleanLocationEdit(edit), reason }),
    onSuccess: () => {
      notify.success(t('editLocation.saved', { code: fsi(location.code) }))
      void qc.invalidateQueries({ queryKey: storeKey(location.code) })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      onClose()
    },
  })

  return (
    <ReasonDialog
      open
      title={t('editLocation.title', { code: fsi(location.code) })}
      note={t('editLocation.note')}
      busy={save.isPending}
      error={save.error}
      confirmLabel={t('editLocation.save')}
      confirmDisabled={!locationEditReady(current, edit)}
      onConfirm={(reason) => save.mutate(reason)}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3" data-edit-location="">
        {FIELDS.map(({ key, ltr }) => (
          <TextField
            key={key}
            label={t(`location.${key}`)}
            value={edit[key]}
            onChange={(v) => setEdit((e) => ({ ...e, [key]: v }))}
            disabled={save.isPending}
            ltr={ltr}
            data={key}
          />
        ))}
      </div>
    </ReasonDialog>
  )
}
