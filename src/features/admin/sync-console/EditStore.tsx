import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import type { StoreDetail } from '@/core/models/sync-console'
import { AUDIT_KEY, FLEET_KEY, PENDING_KEY, storeKey, syncConsoleAccessQuery, syncConsoleApi } from './api'
import { STORE_EDIT_FIELDS, cleanStoreEdit, storeEditReady, type StoreEdit } from './onboard-helpers'
import { isWpfStore } from './store-helpers'
import { TextField } from './TextField'
import ReasonDialog from './ReasonDialog'

const LTR_FIELDS: ReadonlySet<keyof StoreEdit> = new Set(['phone', 'cr'])

/**
 * **Edit store** on a store's page (ticket 449): the store master's address fields,
 * with a reason. It renders only with `canOnboard` (absent, not disabled), and not on
 * a WPF store, whose page offers only Move to worker and Test connection.
 *
 * 🚩 No door reads a store's address back (only its description is in the header),
 * so the form opens with the description filled and asks for every other field: a
 * field left blank would be sent blank and wipe what is stored (`storeEditReady`).
 */
export default function EditStore({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  const access = useQuery(syncConsoleAccessQuery())
  const [open, setOpen] = useState(false)
  if (access.data?.canOnboard !== true || isWpfStore(row)) return null
  return (
    <>
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)} data-edit-store-open="">
          {t('editStore.open')}
        </Button>
      </div>
      {open && <EditStoreDialog code={row.code} description={row.description} onClose={() => setOpen(false)} />}
    </>
  )
}

function EditStoreDialog({ code, description, onClose }: { code: string; description: string; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const [edit, setEdit] = useState<StoreEdit>({ description, city: '', area: '', address: '', phone: '', cr: '' })
  const save = useMutation({
    mutationFn: (reason: string) => syncConsoleApi.editStore({ code, ...cleanStoreEdit(edit), reason }),
    onSuccess: () => {
      notify.success(t('editStore.saved', { code: fsi(code) }))
      void qc.invalidateQueries({ queryKey: storeKey(code) })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      void qc.invalidateQueries({ queryKey: PENDING_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      onClose()
    },
  })

  return (
    <ReasonDialog
      open
      title={t('editStore.title', { code: fsi(code) })}
      note={t('editStore.note')}
      busy={save.isPending}
      error={save.error}
      confirmLabel={t('editStore.save')}
      confirmDisabled={!storeEditReady(edit)}
      onConfirm={(reason) => save.mutate(reason)}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3" data-edit-store="">
        {STORE_EDIT_FIELDS.map((key) => (
          <TextField
            key={key}
            label={t(`onboard.fields.${key}`)}
            value={edit[key]}
            onChange={(v) => setEdit((e) => ({ ...e, [key]: v }))}
            disabled={save.isPending}
            ltr={LTR_FIELDS.has(key)}
            data={key}
          />
        ))}
      </div>
    </ReasonDialog>
  )
}
