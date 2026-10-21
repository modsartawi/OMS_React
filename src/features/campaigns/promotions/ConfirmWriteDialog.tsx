import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { refreshPromotions } from './api'
import WriteRefusal from './WriteRefusal'

/**
 * Unassign and Delete, confirmed (ticket 536): the question, then the write. A refusal shows here,
 * the dialog kept open and the promotion as it was. The promotions are read afresh after it either
 * way (a refusal such as "not empty" says this page is stale) — except a write that leaves the page
 * (Delete): its caller reads them once it has left, so the gone promotion's campaigns are not asked.
 */
export default function ConfirmWriteDialog<T>({
  title,
  confirm,
  refusedTitle,
  run,
  onClose,
  onDone,
  danger = false,
  leaves = false,
  data,
  children,
}: {
  title: string
  confirm: string
  refusedTitle: string
  run: () => Promise<T>
  onClose: () => void
  onDone: (reply: T) => void
  danger?: boolean
  /** The write's success leaves the page; the caller refreshes the promotions after it has left. */
  leaves?: boolean
  /** The dialog's own `data-*` mark, for the drive. */
  data: string
  children: ReactNode
}) {
  const { t } = useTranslation('campaign-promotions')
  const queryClient = useQueryClient()
  const write = useMutation({ mutationFn: run, onSettled: (_reply, error) => (error || !leaves ? refreshPromotions(queryClient) : undefined) })
  const close = () => !write.isPending && onClose()
  return (
    <Modal
      open
      onClose={close}
      title={title}
      width="32rem"
      footer={
        <>
          <Button variant="text" disabled={write.isPending} onClick={close}>
            {t('form.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={write.isPending} onClick={() => write.mutate(undefined, { onSuccess: onDone })} data-confirm-write="">
            {write.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-confirm-dialog={data}>
        <p className="text-sm">{children}</p>
        {write.isError && <WriteRefusal title={refusedTitle} error={write.error} />}
      </div>
    </Modal>
  )
}
