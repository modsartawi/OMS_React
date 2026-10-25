import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Pencil, Power, PowerOff, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import type { ServingListRow } from '@/core/models/serving-list'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { servingListsApi } from './api'
import { deactivateWarning } from './deactivate-warning'
import NameDialog from './NameDialog'
import { noteBody } from './name-form'
import WriteDialog, { listName, useRefreshList } from './WriteDialog'
import { writeRefusal } from './write-refusal'

export interface HeaderActionsProps {
  /** The list's row (the header renders the slot only once it is known). */
  list: ServingListRow
  /** `canEditServingLists`. */
  canEdit: boolean
}

/**
 * The detail header's actions (oms ticket 570, BackOffice spec 3042 stories 30, 32, 33): Rename, and Deactivate
 * or Reactivate. Only for an Execute holder (`canEditServingLists`). There is no delete of a list.
 */
export default function HeaderActions({ list, canEdit }: HeaderActionsProps) {
  const { t } = useTranslation('serving-lists')
  const [open, setOpen] = useState<'rename' | 'state' | null>(null)
  if (!canEdit) return null
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen('rename')} data-action="rename">
        <Pencil className="h-3 w-3" aria-hidden />
        {t('writes.rename.button')}
      </Button>
      {list.isActive ? (
        <Button variant="danger-outlined" onClick={() => setOpen('state')} data-action="deactivate">
          <PowerOff className="h-3 w-3" aria-hidden />
          {t('writes.deactivate.button')}
        </Button>
      ) : (
        <Button variant="outlined" onClick={() => setOpen('state')} data-action="reactivate">
          <Power className="h-3 w-3" aria-hidden />
          {t('writes.reactivate.button')}
        </Button>
      )}
      {open === 'rename' && <NameDialog list={list} onClose={() => setOpen(null)} />}
      {open === 'state' && <StateDialog list={list} onClose={() => setOpen(null)} />}
    </>
  )
}

/**
 * Deactivate (`POST …/Deactivate`) or reactivate (`POST …/Reactivate`). The door never refuses a deactivation a
 * type points at — the warning is ours, naming the competed types. The answer's own `warning` (if any) follows
 * as a toast. `SVL-00007` (already in that state) means the screen was stale: it is refetched.
 */
function StateDialog({ list, onClose }: { list: ServingListRow; onClose: () => void }) {
  const { t, i18n } = useTranslation('serving-lists')
  const refresh = useRefreshList()
  const [note, setNote] = useState('')
  // Fixed at open: a refetch behind the dialog must not flip what Confirm sends.
  const [deactivating] = useState(list.isActive)
  const mode = deactivating ? 'deactivate' : 'reactivate'
  const competed = deactivating ? deactivateWarning(list) : null

  const send = useMutation({
    mutationFn: () =>
      deactivating ? servingListsApi.deactivate(list.servingListId, noteBody(note)) : servingListsApi.reactivate(list.servingListId, noteBody(note)),
    onSuccess: (row) => {
      onClose()
      refresh(list.servingListId)
      toast.success(t(`writes.${mode}.done`, { name: fsi(listName(row, i18n.language)) }))
      // Server text ("English / Arabic"), passed through as data.
      if (deactivating && row.warning) notify.warn(t('writes.deactivate.warned'), row.warning)
    },
    onError: (err) => {
      const r = writeRefusal(err)
      if (r.kind === 'refused' && r.stale) refresh(list.servingListId)
    },
  })

  return (
    <WriteDialog
      hook={mode}
      title={t(`writes.${mode}.title`)}
      confirmLabel={t(`writes.${mode}.confirm`)}
      confirmVariant={deactivating ? 'danger' : 'primary'}
      ready
      busy={send.isPending}
      refusal={send.isError ? writeRefusal(send.error) : null}
      note={note}
      onNote={setNote}
      onConfirm={() => send.mutate()}
      onClose={onClose}
    >
      <p className="text-sm" data-state-subject="">
        <Trans t={t} i18nKey={`writes.${mode}.subject`} values={{ name: listName(list, i18n.language) }} components={{ b: <bdi className="font-semibold" /> }} />
      </p>
      <p className="text-sm text-muted-foreground">{t(`writes.${mode}.effect`)}</p>
      {competed && (
        <p
          className="flex items-start gap-2 rounded-md bg-attention-050 px-3 py-2 text-sm text-attention-800"
          role="alert"
          data-deactivate-competed={competed.join(' ')}
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('writes.deactivate.competed', { types: fsi(listText(competed, i18n.language)) })}
        </p>
      )}
      {deactivating && !competed && (
        <p className="text-xs text-muted-foreground" data-deactivate-competed="">
          {t('writes.deactivate.noCompeted')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('writes.openBids')}</p>
    </WriteDialog>
  )
}
