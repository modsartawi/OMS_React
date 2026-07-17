import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSession } from '@/core/session'
import { lookupQueries } from '@/core/services/lookups'
import { authApi } from './api'

/**
 * The acting-store picker, embedded in the account popup.
 *
 * Options come from `SdDocument/StoreDetails` — session-cached, and shared with
 * the Screen 1 lookups. ⚠ That list may be broader than the user's real
 * permissions (AR-2): server-side authorization is the truth, this is a
 * convenience picker. No per-user `Auth/Stores` endpoint exists yet.
 *
 * The select is bound to the session's current store, so a failed switch reverts
 * to the previous code for free. No reload — the next search reflects the new
 * store server-side.
 */
export default function StoreSwitcher() {
  const { t } = useTranslation()
  const currentStoreCode = useSession((s) => s.currentStoreCode)
  const setCurrentStore = useSession((s) => s.setCurrentStore)
  const [switching, setSwitching] = useState(false)

  const stores = useQuery(lookupQueries.storeDetails())

  const options = (stores.data ?? [])
    .map((store) => ({ code: (store.storeCode ?? '').trim(), city: (store.city ?? '').trim() }))
    .filter((store) => store.code)
    .sort((a, b) => a.code.localeCompare(b.code))

  async function pick(storeCode: string) {
    // No-op picks (same store, blank, already switching) are ignored.
    if (!storeCode || storeCode === currentStoreCode || switching) return
    setSwitching(true)
    try {
      const session = await authApi.switchStore(storeCode)
      const applied = session.currentStoreCode ?? storeCode
      setCurrentStore(applied)
      toast.success(t('storeSwitcher.changed.title'), {
        description: t('storeSwitcher.changed.detail', { storeCode: applied }),
      })
    } catch {
      // The select stays bound to the session value, so it reverts on its own.
      toast.error(t('storeSwitcher.failed.title'), { description: t('storeSwitcher.failed.detail') })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <select
      aria-label={t('storeSwitcher.ariaLabel')}
      disabled={switching || stores.isPending}
      value={currentStoreCode ?? ''}
      onChange={(e) => void pick(e.target.value)}
      className="mt-1 h-7 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"
    >
      {/* The session's store may not be in the list (or the list may still be loading). */}
      {currentStoreCode && !options.some((o) => o.code === currentStoreCode) && (
        <option value={currentStoreCode}>{currentStoreCode}</option>
      )}
      {options.map((store) => (
        <option key={store.code} value={store.code}>
          {store.city ? `${store.code} · ${store.city}` : store.code}
        </option>
      ))}
    </select>
  )
}
