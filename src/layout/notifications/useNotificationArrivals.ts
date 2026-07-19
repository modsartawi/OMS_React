import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useNcStore, ncItems } from './store'
import { arrivalsToToast } from './helpers'

// Raises a sonner notification the moment a genuinely-new item is polled, in
// lock-step with the badge bump (both derive from the same store update). A
// client-side `seen` set distinguishes arrivals from changes (the server never
// labels them, 024 §Watermark); the pure `arrivalsToToast` also applies the
// 15-minute freshness gate so a cold-start backlog doesn't re-pop. Styled by
// DisplayStyle:
//   • Toast  (JOB_DONE)  → auto-dismiss (~8s).
//   • Banner (BROADCAST) → persistent, with View (opens the panel) + Dismiss.
// No sound (no v1 type sets PlaySound).
const AUTO_DISMISS_MS = 8_000

export function useNotificationArrivals(): void {
  const { t } = useTranslation('notifications')
  // `ncItems` derives a fresh array each call — wrap in useShallow so the snapshot is
  // reference-stable until the items actually change (else useSyncExternalStore loops).
  const items = useNcStore(useShallow(ncItems))
  const setPanelOpen = useNcStore((s) => s.setPanelOpen)
  // Ids already considered for a toast — persists across renders so nothing
  // re-toasts on a later poll (or a change to an item already seen).
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    const now = Date.now()
    const arrivals = arrivalsToToast(seen.current, items, now)
    // Mark every current id seen so only the next genuine arrival can toast.
    for (const item of items) seen.current.add(item.notificationId)

    for (const item of arrivals) {
      if (item.displayStyle === 'Banner') {
        toast(item.title, {
          description: item.body,
          duration: Infinity, // sticky until dismissed — an ops broadcast isn't missed
          action: { label: t('toast.view'), onClick: () => setPanelOpen(true) },
          cancel: { label: t('toast.dismiss'), onClick: () => {} }, // sonner dismisses on click
        })
      } else {
        toast(item.title, { description: item.body, duration: AUTO_DISMISS_MS })
      }
    }
  }, [items, t, setPanelOpen])
}
