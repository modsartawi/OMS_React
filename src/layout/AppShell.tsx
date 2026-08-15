import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { MENU, isActive, type ShellMenuItem } from './menu-model'
import { useVisibleMenu } from './useVisibleMenu'
import { useTheme } from './theme'
import { useSession } from '@/core/session'
import { signOut } from '@/core/auth/sign-out'
import { buildTag } from '@/core/build-info'
import BrandMark from '@/core/ui/BrandMark'
import StoreSwitcher from '@/features/auth/StoreSwitcher'
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

/** Every component in the nav that draws one menu item takes exactly these. */
interface MenuItemProps {
  item: ShellMenuItem
  onNavigate: () => void
}

/**
 * Whether an expandable row is open: **auto-expand for an active descendant, manual
 * override until the URL changes.**
 *
 * Spelled once because since ticket 284 two levels expand — the group and the
 * sub-group — and the rule is the same rule. A second copy would drift, and the way
 * it would drift is silent: a node that stopped re-opening on the screen you just
 * navigated to.
 */
function useExpanded(hasActiveChild: boolean): [boolean, () => void] {
  const { pathname } = useLocation()
  const [manual, setManual] = useState<boolean | null>(null)
  useEffect(() => setManual(null), [pathname])
  const expanded = manual ?? hasActiveChild
  return [expanded, () => setManual(!expanded)]
}

function MenuLeaf({ item, onNavigate }: MenuItemProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const active = isActive(item, pathname)
  const Icon = item.icon
  return (
    <NavLink
      to={item.routerLink!}
      // 🚩 `end` keeps react-router's OWN `aria-current` in step with `isActive`
      // (ticket 284). NavLink prefix-matches `to` by default, so without this the
      // Overview leaf would announce itself as the current page on all four
      // settlement screens even while it drew unhighlighted — the same two-leaves
      // bug `exact` fixes, one layer down where nobody would see it.
      end={item.exact}
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

/**
 * A group's child that has children of its own — one extra level, and only one
 * (ticket 284, spec 282 D2).
 *
 * Its header is a **link beside a chevron**: the node is both a label and a
 * destination (the settlement Overview), so clicking the label navigates while the
 * chevron expands. Everything else matches {@link MenuGroup} — auto-expand on an
 * active descendant, manual override until the URL changes.
 *
 * 🚩 **Bounded to one extra level on purpose, not generically recursive.** There is
 * no visual design for a fourth: the group header is uppercase and muted, a leaf is
 * sentence case, and there is no third type. So this component renders {@link MenuLeaf}
 * for its children unconditionally rather than dispatching on `c.items` again. When a
 * fourth level is genuinely wanted, promoting the dispatch is a visible diff argued at
 * that time.
 */
function MenuSubGroup({ item, onNavigate }: MenuItemProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const children = item.items ?? []
  const hasActiveChild = children.some((c) => isActive(c, pathname))
  const [expanded, toggle] = useExpanded(hasActiveChild)
  const Icon = item.icon
  const label = t(item.labelKey)
  return (
    <div>
      <div className="flex items-center gap-0.5">
        {/* 🚩 A plain `Link`, NOT a `NavLink`, and that is the whole point of the
            row: the node never claims to be the page you are on. It points at the
            same address as its Overview child, so a `NavLink` here would put
            `aria-current="page"` on two elements at once on the Overview — the very
            two-things-highlighted bug `exact` exists to remove, restated to a screen
            reader. Its emphasis comes from `hasActiveChild` instead. */}
        <Link
          to={item.routerLink!}
          onClick={onNavigate}
          className={
            'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-sidebar-accent/60 ' +
            // 🚩 Emphasis, never the leaf's selected background: the node says "you
            // are somewhere in here", the leaf below says where.
            (hasActiveChild ? 'font-medium' : '')
          }
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="truncate">{label}</span>
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={t('topbar.toggleSection', { label })}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent/60"
        >
          <ChevronDown
            className={'h-3.5 w-3.5 transition-transform ' + (expanded ? '' : '-rotate-90')}
            aria-hidden
          />
        </button>
      </div>
      {expanded && (
        <div
          data-region="menu-subgroup"
          className="ms-4 mt-0.5 flex flex-col gap-0.5 border-s border-border/60 ps-1"
        >
          {children.map((c) => (
            <MenuLeaf key={c.labelKey} item={c} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

function MenuGroup({ item, onNavigate }: MenuItemProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const hasActiveChild = (item.items ?? []).some((c) => isActive(c, pathname))
  const [expanded, toggle] = useExpanded(hasActiveChild)
  const Icon = item.icon
  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-sidebar-accent/60"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="flex-1 text-start">{t(item.labelKey)}</span>
        <ChevronDown className={'h-3.5 w-3.5 transition-transform ' + (expanded ? '' : '-rotate-90')} aria-hidden />
      </button>
      {expanded && (
        <div className="ms-2 mt-0.5 flex flex-col gap-0.5">
          {/* One dispatch line, one extra level (284): a child with children of its
              own draws as a sub-group; everything else is a leaf, as before.
              🚩 BOTH conditions, because the sub-group's header IS a link — a node
              with children but nowhere of its own to go has no honest header to
              draw, and would render `<Link to={undefined}>`. Nothing in `MENU` is
              that shape and the ticket's framing says nothing should be ("both a
              label and a destination"); this is what keeps a future one visible
              rather than broken. */}
          {(item.items ?? []).map((c) =>
            c.items && c.routerLink ? (
              <MenuSubGroup key={c.labelKey} item={c} onNavigate={onNavigate} />
            ) : (
              <MenuLeaf key={c.labelKey} item={c} onNavigate={onNavigate} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function AccountPopup() {
  const { t } = useTranslation()
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
          {/* 🚩 The acting store IS the pricing plant (Nphies contract law 8), and
              it is bound immutably when an authorization session opens. Without
              this control the Nphies form's "your acting store is not resolved
              yet" blocker is a DEAD END — it names the problem and offers nowhere
              to fix it, which is exactly what a live `Auth/Me` returning
              `currentStoreCode: ""` produced on 2026-08-02. `layout` → a feature
              is an allowed import, and `.claude/rules/feature-structure.md` names
              this very one. */}
          <div className="mt-1 border-b border-border px-2 pb-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t('storeSwitcher.label')}
            </div>
            <StoreSwitcher />
            {!session.currentStoreCode && (
              <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">
                {t('storeSwitcher.unset')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
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
