import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'

/**
 * "No connection" (oms 929): the phone could not reach the server, so it does not know whether the last action
 * landed. It says so plainly, and says what is safe: a retry re-sends the same submit, never a second order.
 */
export default function NoConnection() {
  const { t } = useTranslation('mini-pos-phone')
  return (
    <div
      role="status"
      data-screen="no-connection"
      className="flex gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">{t('connection.title')}</p>
        <p>{t('connection.hint')}</p>
      </div>
    </div>
  )
}

const subscribe = (changed: () => void) => {
  window.addEventListener('online', changed)
  window.addEventListener('offline', changed)
  return () => {
    window.removeEventListener('online', changed)
    window.removeEventListener('offline', changed)
  }
}

/** The browser's own word on the connection. It can say online while the server is still unreachable, so a call that
 *  fails on the network says "no connection" too (`isNoConnection`). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
