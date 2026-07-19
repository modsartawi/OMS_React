import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useNcStore, ncItems } from './store'
import { unreadCount, visibleItems } from './helpers'
import { useNotificationPoll } from './useNotificationPoll'
import NotificationPanel from './NotificationPanel'

// The Notification Center bell (Receive chrome, spec 031). Rides the AppShell top
// bar in the status cluster, left of the theme + account controls. Drives the
// portal-wide poll and shows a terracotta unread badge whose count is
// client-derived (Active ∧ not-expired ∧ !read). Zero unread ⇒ no badge; a 404
// poll (feature off server-side) ⇒ the whole bell renders nothing. Clicking the
// bell opens a dropdown panel (033) anchored to it; outside-click / Escape close
// it. Opening does NOT mark anything read.
export default function NotificationBell() {
  const { t } = useTranslation('notifications')
  useNotificationPoll()

  const disabled = useNcStore((s) => s.disabled)
  const items = useNcStore(ncItems)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // A coarse clock so an item expiring between polls drops out of the count/list
  // without waiting for the next 30s fetch (expiry is a client-side filter).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Outside-click + Escape close (parity with the account popup).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Feature off server-side (404 poll) — show nothing, not a dead control.
  if (disabled) return null

  const count = unreadCount(items, now)
  const visible = visibleItems(items, now)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('bell.ariaLabel')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative rounded-md p-1.5 hover:bg-accent"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -end-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ring px-1 text-[10px] font-bold text-white ring-2 ring-background tabular-nums"
            aria-hidden
          >
            {count}
          </span>
        )}
      </button>
      {open && <NotificationPanel items={visible} now={now} />}
    </div>
  )
}
