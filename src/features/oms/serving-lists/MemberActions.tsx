import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ban, CircleCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import type { ServingListMemberRow } from '@/core/models/serving-list'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { servingListsApi } from './api'
import type { MemberCellParams } from './member-columns'
import { noteBody } from './name-form'
import WriteDialog, { useRefreshList } from './WriteDialog'
import { writeRefusal } from './write-refusal'

type MemberWrite = 'disable' | 'enable' | 'remove'

/**
 * A member row's actions (oms ticket 570, BackOffice spec 3042 stories 34-36): Disable or Enable, and Remove,
 * each through a dialog with an optional note. Only for an Execute holder.
 *
 * 🚩 AG Grid reads `context` once, at mount: this reads only what cannot change under a mounted grid —
 * `servingListId` and `canEdit` (the probe has resolved before the page renders) — never `context.list`.
 */
export function MemberActionsCell(p: MemberCellParams) {
  const { t } = useTranslation('serving-lists')
  const [open, setOpen] = useState<MemberWrite | null>(null)
  const row = p.data
  if (!row || !p.context?.canEdit) return null
  const store = fsi(row.storeCode)
  return (
    <span className="inline-flex items-center gap-1" data-member-actions={row.storeCode}>
      {row.isEnabled ? (
        <Button variant="ghost" onClick={() => setOpen('disable')} aria-label={t('writes.member.disableAria', { store })} data-member-action="disable">
          <Ban className="h-3 w-3" aria-hidden />
          {t('writes.member.disable')}
        </Button>
      ) : (
        <Button variant="ghost" onClick={() => setOpen('enable')} aria-label={t('writes.member.enableAria', { store })} data-member-action="enable">
          <CircleCheck className="h-3 w-3" aria-hidden />
          {t('writes.member.enable')}
        </Button>
      )}
      <Button variant="ghost" onClick={() => setOpen('remove')} aria-label={t('writes.member.removeAria', { store })} data-member-action="remove">
        <Trash2 className="h-3 w-3" aria-hidden />
        {t('writes.member.remove')}
      </Button>
      {/* Outside the grid's DOM, so the cell's own keyboard handling never sees the note field. */}
      {open &&
        createPortal(<MemberWriteDialog servingListId={p.context.servingListId} member={row} mode={open} onClose={() => setOpen(null)} />, document.body)}
    </span>
  )
}

/**
 * Enable / disable (`PUT …/Stores/{code}/Enabled`) or remove (`DELETE …/Stores/{code}?note=`). A disabled member
 * keeps its place and history but is not bid; a removed one is no longer bid from the next callout (the log keeps
 * it). Neither withdraws a bid already offered. `SVL-00004` / `SVL-00007` mean the screen was stale: refetched.
 */
function MemberWriteDialog({ servingListId, member, mode, onClose }: { servingListId: string; member: ServingListMemberRow; mode: MemberWrite; onClose: () => void }) {
  const { t } = useTranslation('serving-lists')
  const refresh = useRefreshList()
  const [note, setNote] = useState('')

  const send = useMutation({
    mutationFn: () => {
      const body = noteBody(note)
      return mode === 'remove'
        ? servingListsApi.removeStore(servingListId, member.storeCode, body.note)
        : servingListsApi.setStoreEnabled(servingListId, member.storeCode, { enabled: mode === 'enable', ...body })
    },
    onSuccess: () => {
      onClose()
      refresh(servingListId)
      toast.success(t(`writes.member.${mode}Done`, { store: fsi(formatPair(member.storeCode, member.storeName)) }))
    },
    onError: (err) => {
      const r = writeRefusal(err)
      if (r.kind === 'refused' && r.stale) refresh(servingListId)
    },
  })

  return (
    <WriteDialog
      hook={`member-${mode}`}
      title={t(`writes.member.${mode}Title`)}
      confirmLabel={t(`writes.member.${mode}`)}
      confirmVariant={mode === 'remove' ? 'danger' : 'primary'}
      ready
      busy={send.isPending}
      refusal={send.isError ? writeRefusal(send.error) : null}
      note={note}
      onNote={setNote}
      onConfirm={() => send.mutate()}
      onClose={onClose}
    >
      <p className="text-sm font-semibold" data-member-subject={member.storeCode}>
        <Ltr>{formatPair(member.storeCode, member.storeName)}</Ltr>
      </p>
      <p className="text-sm text-muted-foreground">{t(`writes.member.${mode}Effect`)}</p>
      <p className="text-xs text-muted-foreground">{t('writes.openBids')}</p>
    </WriteDialog>
  )
}
