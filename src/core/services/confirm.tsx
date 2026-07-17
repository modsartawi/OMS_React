import { create } from 'zustand'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'

interface ConfirmRequest {
  message: string
  header: string
  settle: (accepted: boolean) => void
}

interface ConfirmState {
  request: ConfirmRequest | null
  open: (request: ConfirmRequest) => void
  answer: (accepted: boolean) => void
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  open: (request) => set({ request }),
  answer: (accepted) => {
    const { request } = get()
    set({ request: null })
    request?.settle(accepted)
  },
}))

/**
 * Ask the operator to confirm an action. Resolves `true` only when they accept —
 * Cancel, Escape and a backdrop click all resolve `false`.
 *
 * A promise rather than a callback because that is the shape the call site
 * wants: `if (await confirmAction(...)) post()` reads as one decision, where a
 * callback would split every action across two functions. The promise ALWAYS
 * settles (every dismissal path routes through `answer`), so an awaiting caller
 * can never be stranded.
 */
export function confirmAction(message: string, header: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useConfirmStore.getState().open({ message, header, settle: resolve })
  })
}

/**
 * The single confirm dialog, mounted once by the shell. Keeping one instance
 * app-wide (rather than one per action) is what lets `confirmAction` be callable
 * from anywhere without a component in scope.
 */
export function ConfirmHost() {
  const { t } = useTranslation()
  const request = useConfirmStore((s) => s.request)
  const answer = useConfirmStore((s) => s.answer)

  return (
    <Modal
      open={request !== null}
      onClose={() => answer(false)}
      title={request?.header ?? ''}
      width="24rem"
      footer={
        <>
          <Button variant="text" onClick={() => answer(false)}>
            {t('confirm.no')}
          </Button>
          <Button variant="primary" onClick={() => answer(true)}>
            {t('confirm.yes')}
          </Button>
        </>
      }
    >
      <p className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <span>{request?.message}</span>
      </p>
    </Modal>
  )
}
