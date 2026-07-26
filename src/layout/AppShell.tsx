import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { MENU, isActive, type ShellMenuItem } from './menu-model'
import { useVisibleMenu } from './useVisibleMenu'
import { useTheme } from './theme'
import { useSession } from '@/core/session'
import { authApi } from '@/features/auth/api'
import { buildTag } from '@/core/build-info'
import BrandMark from '@/core/ui/BrandMark'
import NotificationBell from './notifications/NotificationBell'

const MOBILE_QUERY = '(max-width: 991px)'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'U'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

function MenuLeaf({ item, onNavigate }: { item: ShellMenuItem; onNavigate: () => void }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const active = isActive(item, pathname)
  const Icon = item.icon
  return (
    <NavLink
      to={item.routerLink!}
      onClick={onNavigate}
      className={
        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ' +
        (active ? 'bg-sidebar-accent font-medium' : 'hover:bg-sidebar-accent/60')
      }
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span>{t(item.labelKey)}</span>
    </NavLink>
  )
}

function MenuGroup({ item, onNavigate }: { item: ShellMenuItem; onNavigate: () => void }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const hasActiveChild = (item.items ?? []).some((c) => isActive(c, pathname))
  // Auto-expand for active descendants; manual override until the URL changes.
  const [manual, setManual] = useState<boolean | null>(null)
  useEffect(() => setManual(null), [pathname])
  const expanded = manual ?? hasActiveChild
  const Icon = item.icon
  return (
    <div>
      <button
        type="button"
        onClick={() => setManual(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-sidebar-accent/60"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="flex-1 text-start">{t(item.labelKey)}</span>
        <ChevronDown className={'h-3.5 w-3.5 transition-transform ' + (expanded ? '' : '-rotate-90')} aria-hidden />
      </button>
      {expanded && (
        <div className="ms-2 mt-0.5 flex flex-col gap-0.5">
          {(item.items ?? []).map((c) => (
            <MenuLeaf key={c.labelKey} item={c} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

function AccountPopup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const session = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  const name = session.displayName || session.userId || t('user')

  async function logout() {
    // Best-effort: clear + redirect even if Auth/Logout fails.
    try {
      await authApi.logout()
    } catch {
      /* ignore */
    }
    useSession.getState().clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('topbar.account')}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(name)}
        </span>
        <span className="hidden text-sm sm:block">{name}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-card p-2 shadow-md">
          <div className="flex items-center gap-3 border-b border-border px-2 pb-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{name}</div>
              <div className="truncate text-xs text-muted-foreground">{session.userId}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('actions.logout')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppShell() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const theme = useTheme()
  const location = useLocation()
  // Desktop: collapsed hides the sidebar (a REAL collapse — the Angular prototype's
  // desktop hamburger was inert; do-not-copy list). Mobile: overlay open/closed.
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  // Permission-aware nav: gated items the user can't open are hidden (issue 429).
  const { items: menu } = useVisibleMenu(MENU)

  // Mobile overlay: Esc closes, body scroll locks, focus moves in, auto-close on nav/resize.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('blocked-scroll')
    sidebarRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('blocked-scroll')
    }
  }, [mobileOpen])
  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  const sidebarVisible = isMobile ? mobileOpen : !collapsed

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-border/60 bg-background px-3">
        <button
          type="button"
          onClick={() => (isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed))}
          aria-label={t('topbar.toggleMenu')}
          aria-controls="layout-sidebar"
          aria-expanded={sidebarVisible}
          className="rounded-md p-1.5 hover:bg-accent"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <NavLink to="/" className="flex items-center gap-2" aria-label={t('brand')}>
          <BrandMark size={26} />
          <span className="text-sm font-semibold tracking-tight">{t('brandName')}</span>
        </NavLink>
        <div className="flex-1" />
        {/* Notification Center bell — status cluster, left of the theme/account
            controls (spec 031). Hides itself when the feature is off (404 poll). */}
        <NotificationBell />
        <button
          type="button"
          onClick={theme.toggle}
          aria-label={t('topbar.darkMode')}
          aria-pressed={theme.dark}
          className="rounded-md p-1.5 hover:bg-accent"
        >
          {theme.dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
        </button>
        <AccountPopup />
      </header>

      <div className="flex flex-1">
        {isMobile && mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside
          id="layout-sidebar"
          ref={sidebarRef}
          tabIndex={-1}
          inert={!sidebarVisible ? true : undefined}
          className={
            'w-60 shrink-0 border-e border-border/60 bg-sidebar text-sidebar-foreground transition-transform ' +
            (isMobile
              ? 'fixed inset-y-0 start-0 z-50 pt-12 ' + (mobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full')
              : collapsed
                ? 'hidden'
                : '')
          }
        >
          <nav className="flex flex-col gap-1 p-2">
            {menu.map((item) =>
              item.items ? (
                <MenuGroup key={item.labelKey} item={item} onNavigate={() => setMobileOpen(false)} />
              ) : (
                <MenuLeaf key={item.labelKey} item={item} onNavigate={() => setMobileOpen(false)} />
              ),
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4">
          <Outlet />
        </main>
      </div>

      {/* Build stamp (issue 435): which build is live, at a glance. Machine-readable
          counterpart is /version.json. */}
      <footer className="border-t border-border px-3 py-1 text-end text-[11px] text-muted-foreground">
        {t('brand')} · {buildTag}
      </footer>
    </div>
  )
}
