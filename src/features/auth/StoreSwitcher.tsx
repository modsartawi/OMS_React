import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSession } from '@/core/session'
import { useStoreLock } from '@/core/engine-session/store-lock'
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
 *
 * 🚩 **A live engine session holds it still** (ticket 217, Nphies contract law 8).
 * The acting store IS the pricing plant, bound once when the authorization
 * transaction opens and immutable for its life; there is no verb to move it. So
 * while a session holds the lock the control is disabled and says why, rather
 * than accepting a switch that would leave the shell claiming one store while the
 * engine prices at another.
 */
export default function StoreSwitcher() {
  const { t } = useTranslation()
  const currentStoreCode = useSession((s) => s.currentStoreCode)
  const setCurrentStore = useSession((s) => s.setCurrentStore)
  const lockedByEngineSession = useStoreLock((s) => s.holders > 0)
  const [switching, setSwitching] = useState(false)

  const stores = useQuery(lookupQueries.storeDetails())

  const options = (stores.data ?? [])
    .map((store) => ({ code: (store.storeCode ?? '').trim(), city: (store.city ?? '').trim() }))
    .filter((store) => store.code)
    .sort((a, b) => a.code.localeCompare(b.code))

  async function pick(storeCode: string) {
    // No-op picks (same store, blank, already switching) are ignored — and a
    // locked switcher is refused here as well as disabled above, because the
    // disabled attribute is the courtesy and this is the rule.
    if (!storeCode || storeCode === currentStoreCode || switching || lockedByEngineSession) return
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
    <>
    {lockedByEngineSession && (
      <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">
        {t('storeSwitcher.lockedByEngineSession')}
      </p>
    )}
    <select
      aria-label={t('storeSwitcher.ariaLabel')}
      disabled={switching || stores.isPending || lockedByEngineSession}
      title={lockedByEngineSession ? t('storeSwitcher.lockedByEngineSession') : undefined}
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
    </>
  )
}
