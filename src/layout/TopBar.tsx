import { useEffect, useRef, useState } from 'react'
import { useLocation, useMatches } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, MapPin } from 'lucide-react'
import { useSession } from '@/core/session'
import { lookupQueries } from '@/core/services/lookups'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import StoreSwitcher from '@/features/auth/StoreSwitcher'
import NotificationBell from './notifications/NotificationBell'
import { deriveCrumb } from './crumb'
import { MENU } from './menu-model'
import { RailDrawer } from './Rail'

// The top bar (spec 380 F11, ticket 386; 363 "Top bar"): 44px on `--card`, holding the
// crumb, then — at the inline end — the store chip and the bell. Nothing else: the
// account lives at the rail foot (`UserMenu.tsx`), Broadcast stays an Administration
// leaf, and the palette field joins with the keyboard step (392). Paper never carries it
// (F20).

/**
 * The crumb's separator. The owner kept the slash under RTL too (378 §5) — punctuation
 * between labels, hidden from assistive tech, which reads the list instead.
 */
const CRUMB_SEPARATOR = '/'

function Separator() {
  return (
    <span aria-hidden className="text-ink-3">
      {CRUMB_SEPARATOR}
    </span>
  )
}

/**
 * Group / [sub-group] / screen / record number, derived from the menu (`crumb.ts`).
 * Read off the FULL menu rather than the permission-filtered one, so it names the screen
 * while the access probes are still settling. The record is a machine value: `Ltr`, mono.
 */
function Crumb() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const matches = useMatches()
  const { trail, record } = deriveCrumb(MENU, pathname, matches[matches.length - 1]?.params)
  // An address no item claims (the home page) still says where the user is.
  const labels = trail.length > 0 ? trail.map((key) => t(key)) : [t('brandName')]
  return (
    <nav aria-label={t('topbar.crumb')} data-crumb className="min-w-0 text-[13px] text-muted-foreground">
      <ol className="flex min-w-0 items-center gap-1.5">
        {labels.map((label, i) => {
          const last = i === labels.length - 1 && !record
          return (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <Separator />}
              <span
                aria-current={last ? 'page' : undefined}
                className={'truncate ' + (last ? 'font-semibold text-foreground' : '')}
              >
                {label}
              </span>
            </li>
          )
        })}
        {record && (
          <li className="flex shrink-0 items-center gap-1.5">
            <Separator />
            <span aria-current="page" data-crumb-record className="font-mono font-semibold text-foreground">
              <Ltr>{record}</Ltr>
            </span>
          </li>
        )}
      </ol>
    </nav>
  )
}

/**
 * The acting store, moved out of the account popup into its own chip (363 "Store
 * chip"), opening today's `StoreSwitcher`.
 *
 * 🚩 **No store is the attention tone, on every screen.** The acting store IS the
 * pricing plant (Nphies contract law 8). A live `Auth/Me` answered
 * `currentStoreCode: ""` on 2026-08-02, and the Nphies form's "your acting store is not
 * resolved yet" was a dead end that named the problem and offered nowhere to fix it.
 * The chip is where it gets fixed, and now it says so before the form does.
 */
function StoreChip() {
  const { t } = useTranslation()
  const store = useSession((s) => s.currentStoreCode)
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Navigating (Back, Forward, a rail link) closes it.
  useEffect(() => setOpen(false), [pathname])

  // The switcher's own store list, read here only to know when its select can take
  // focus — the same session-cached entry, and only while the panel is open, so the chip
  // costs no call on a screen where nobody opens it.
  const storesSettled = !useQuery({ ...lookupQueries.storeDetails(), enabled: open }).isPending

  // Opening moves focus to the picker. While the store list is still loading the
  // select is disabled, so the panel holds focus until it settles, then hands it on —
  // unless the user has moved it meanwhile.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const select = panel?.querySelector<HTMLSelectElement>('select:not(:disabled)')
    if (select && (document.activeElement === panel || !panel?.contains(document.activeElement))) select.focus()
    else if (!panel?.contains(document.activeElement)) panel?.focus()
  }, [open, storesSettled])

  // Esc closes and returns focus to the chip; a press outside closes without moving it.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'layout-store-panel' : undefined}
        data-store-chip={store ? 'set' : 'unset'}
        className={
          'flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs ' +
          (store
            ? 'border-border text-muted-foreground hover:bg-accent'
            : 'border-attention-border bg-attention-050 font-medium text-attention-800')
        }
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {store ? (
          <>
            {/* The words fold away on a narrow bar but stay in the chip's name. */}
            <span className="sr-only lg:not-sr-only">{t('topbar.store.label')}</span>{' '}
            <span className="font-mono font-semibold text-foreground">
              <Ltr>{store}</Ltr>
            </span>
          </>
        ) : (
          <span>{t('topbar.store.unset')}</span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
      </button>
      {open && (
        <div
          ref={panelRef}
          id="layout-store-panel"
          role="dialog"
          aria-labelledby="layout-store-panel-label"
          tabIndex={-1}
          className={'absolute end-0 top-full z-50 mt-1 w-64 p-3 ' + POPOVER}
        >
          <div id="layout-store-panel-label" className="text-xs font-medium text-muted-foreground">
            {t('storeSwitcher.label')}
          </div>
          <StoreSwitcher />
          {!store && (
            <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">{t('storeSwitcher.unset')}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** `withDrawer`: below 640px there is no rail, and the bar leads with the hamburger (387). */
export default function TopBar({ withDrawer }: { withDrawer: boolean }) {
  return (
    <header
      id="layout-topbar"
      className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-3 border-b border-border bg-card px-3 print:hidden"
    >
      {withDrawer && <RailDrawer />}
      <Crumb />
      <div className="flex-1" />
      <div className="flex shrink-0 items-center gap-1.5">
        <StoreChip />
        {/* Hides itself when the Notification Center is off (404 poll). Its panel is 389's. */}
        <NotificationBell />
      </div>
    </header>
  )
}
