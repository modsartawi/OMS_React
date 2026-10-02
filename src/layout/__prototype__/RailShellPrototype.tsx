/* PROTOTYPE 363 — throwaway (branch prototype/363-rail-shell). See ./proto-363.ts.
 *
 * Four rail shells over the REAL menu (`MENU` + `useVisibleMenu`, so permission
 * gating is live) and the REAL bell / store switcher / sign-out. Only the frame
 * differs per variant; the shared bits (top bar, navy tree, flyout) are shared on
 * purpose — the question is the FRAME.
 *
 * Copy that exists only in this prototype is literal (dev chrome); every real
 * label comes from the menu's own i18n keys.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Keyboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu as MenuIcon,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react'
import { MENU, isActive, type ShellMenuItem } from '../menu-model'
import { useVisibleMenu } from '../useVisibleMenu'
import { useTheme } from '../theme'
import { useSession } from '@/core/session'
import { signOut } from '@/core/auth/sign-out'
import { buildTag } from '@/core/build-info'
import BrandMark from '@/core/ui/BrandMark'
import StoreSwitcher from '@/features/auth/StoreSwitcher'
import NotificationBell from '../notifications/NotificationBell'
import { p363 } from './proto-363'

// ---------------------------------------------------------------------------
// model
// ---------------------------------------------------------------------------

function anyActive(items: ShellMenuItem[], path: string): boolean {
  return items.some((i) => isActive(i, path) || (i.items ? anyActive(i.items, path) : false))
}

/** Deepest active leaf, and the sub-group it sits under (if any). */
function findLeaf(items: ShellMenuItem[], path: string): { leaf?: ShellMenuItem; sub?: ShellMenuItem } {
  for (const i of items) {
    if (i.items) {
      const inner = findLeaf(i.items, path)
      if (inner.leaf) return { leaf: inner.leaf, sub: inner.sub ?? (i.routerLink ? i : undefined) }
    } else if (isActive(i, path)) return { leaf: i }
  }
  return {}
}

function useShellModel() {
  const { items: menu } = useVisibleMenu(MENU)
  const { pathname } = useLocation()
  const groups = menu.filter((g) => g.items)
  const activeGroup = groups.find((g) => anyActive(g.items!, pathname))
  const { leaf, sub } = activeGroup ? findLeaf(activeGroup.items!, pathname) : {}
  return { menu: groups, pathname, activeGroup, activeLeaf: leaf, activeSub: sub }
}

function useMedia(query: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = (e: MediaQueryListEvent) => setM(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

/** Persisted boolean — prototype convenience only. */
function useStored(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key)
      return s === null ? initial : s === '1'
    } catch {
      return initial
    }
  })
  return [
    v,
    (nv) => {
      setV(nv)
      try {
        localStorage.setItem(key, nv ? '1' : '0')
      } catch {
        /* prototype */
      }
    },
  ]
}

function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean)
  if (w.length === 0) return 'U'
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase()
  return (w[0][0] + w[1][0]).toUpperCase()
}

/** Click-outside + Esc for a popover/flyout. */
function useDismiss(open: boolean, close: () => void, refs: RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return
      close()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

// ---------------------------------------------------------------------------
// the active marker — LOGICAL (inset-inline-start), never an inset shadow (362)
// ---------------------------------------------------------------------------

/** Gold bar on the rail's inline-start edge. `edge` = px from the button to the rail edge. */
const railMarker = (edge: 4 | 6 | 10) =>
  'before:absolute before:inset-y-2 before:w-[3px] before:rounded-full before:bg-gold ' +
  (edge === 4 ? 'before:-start-1' : edge === 6 ? 'before:-start-1.5' : 'before:-start-2.5')

const leafMarker =
  'before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-gold'

// ---------------------------------------------------------------------------
// the navy tree — a group's leaves, drawn ON the rail colour (flyout, D, drawer)
// ---------------------------------------------------------------------------

function NavyLeaf({ item, onNavigate, dense }: { item: ShellMenuItem; onNavigate?: () => void; dense?: boolean }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const active = isActive(item, pathname)
  const Icon = item.icon
  return (
    <NavLink
      to={item.routerLink!}
      end={item.exact}
      onClick={onNavigate}
      className={
        'relative flex items-center gap-2 rounded-md ps-3 pe-2 text-[13px] ' +
        (dense ? 'h-7 ' : 'h-8 ') +
        (active
          ? 'bg-sidebar-accent font-medium text-white ' + leafMarker
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white')
      }
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
      <span className="truncate">{t(item.labelKey)}</span>
    </NavLink>
  )
}

function NavyGroupItems({ group, onNavigate, dense }: { group: ShellMenuItem; onNavigate?: () => void; dense?: boolean }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <div className="flex flex-col gap-0.5">
      {(group.items ?? []).map((c) =>
        c.items && c.routerLink ? (
          <div key={c.labelKey} className="flex flex-col gap-0.5">
            <Link
              to={c.routerLink}
              onClick={onNavigate}
              className={
                'flex h-8 items-center gap-2 rounded-md ps-3 pe-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent hover:text-white ' +
                (anyActive(c.items, pathname) ? 'font-medium text-white' : '')
              }
            >
              {c.icon && <c.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
              <span className="truncate">{t(c.labelKey)}</span>
            </Link>
            <div className="ms-5 flex flex-col gap-0.5 border-s border-white/15 ps-1">
              {c.items.map((l) => (
                <NavyLeaf key={l.labelKey} item={l} onNavigate={onNavigate} dense />
              ))}
            </div>
          </div>
        ) : (
          <NavyLeaf key={c.labelKey} item={c} onNavigate={onNavigate} dense={dense} />
        ),
      )}
    </div>
  )
}

/** The flyout: a navy panel continuing the rail, one group's leaves. */
function Flyout({
  group,
  inset,
  onClose,
  panelRef,
}: {
  group: ShellMenuItem
  inset: number
  onClose: () => void
  panelRef: RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('a')?.focus()
  }, [group, panelRef])
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t(group.labelKey)}
      data-flyout
      className="fixed inset-y-0 z-50 flex w-60 flex-col gap-2 overflow-y-auto border-e border-white/10 bg-sidebar p-3 shadow-2xl"
      style={{ insetInlineStart: inset }}
    >
      <div className="flex h-7 items-center justify-between ps-3 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
        {t(group.labelKey)}
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-sidebar-accent hover:text-white">
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <NavyGroupItems group={group} onNavigate={onClose} />
    </div>
  )
}

/** The rail's group buttons + flyout state, shared by A, B, collapsed C and collapsed D. */
function useFlyout() {
  const [open, setOpen] = useState<string | null>(null)
  const { pathname } = useLocation()
  const railRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => setOpen(null), [pathname])
  useDismiss(open !== null, () => setOpen(null), [railRef, panelRef])
  return { open, setOpen, railRef, panelRef }
}

function RailGroupButton({
  group,
  active,
  open,
  labelled,
  edge,
  onToggle,
  onHover,
}: {
  group: ShellMenuItem
  active: boolean
  open: boolean
  labelled?: boolean
  edge: 4 | 6 | 10
  onToggle: () => void
  onHover: () => void
}) {
  const { t } = useTranslation()
  const label = t(group.labelKey)
  const Icon = group.icon!
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={onHover}
      aria-label={labelled ? undefined : label}
      title={labelled ? undefined : label}
      aria-expanded={open}
      aria-haspopup="dialog"
      data-active={active || undefined}
      className={
        'relative flex shrink-0 flex-col items-center justify-center rounded-md ' +
        (labelled ? 'h-14 w-16 gap-1 ' : 'h-9 w-9 ') +
        (active || open ? 'bg-sidebar-accent text-white ' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white ') +
        (active ? railMarker(edge) : '')
      }
    >
      <Icon className={labelled ? 'h-[18px] w-[18px]' : 'h-[18px] w-[18px]'} aria-hidden />
      {labelled && <span className="w-full truncate px-1 text-center text-[10.5px] leading-tight">{label}</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// top bar pieces
// ---------------------------------------------------------------------------

function Crumb() {
  const { t } = useTranslation()
  const { activeGroup, activeLeaf, activeSub, pathname } = useShellModel()
  const parts: { text: string; mono?: boolean }[] = []
  if (activeGroup) parts.push({ text: t(activeGroup.labelKey) })
  if (activeSub && activeSub !== activeLeaf) parts.push({ text: t(activeSub.labelKey) })
  if (activeLeaf) parts.push({ text: t(activeLeaf.labelKey) })
  if (activeLeaf?.routerLink && pathname !== activeLeaf.routerLink) {
    const last = pathname.split('/').filter(Boolean).pop()
    if (last && /\d/.test(last)) parts.push({ text: last, mono: true })
  }
  if (parts.length === 0) parts.push({ text: t('brandName') })
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 shrink items-center gap-1.5 text-[13px] text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-ink-3">/</span>}
          <span
            className={
              'truncate ' +
              (i === parts.length - 1 ? 'font-semibold text-foreground ' : '') +
              (p.mono ? 'font-mono' : '')
            }
          >
            {p.text}
          </span>
        </span>
      ))}
    </nav>
  )
}

function CmdSlot() {
  return (
    <button
      type="button"
      className="mx-auto hidden h-7 w-full max-w-[480px] min-w-[200px] flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-xs text-ink-3 hover:border-ink-3 md:flex"
      title="PROTOTYPE: the palette itself is the keyboard step (361 step 2)"
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-start">Search deliveries, documents, orders — or type a command</span>
      <kbd className="rounded border border-border-strong px-1 font-mono text-[10.5px]">Ctrl</kbd>
      <kbd className="rounded bg-gold px-1 font-mono text-[10.5px] text-gold-foreground">K</kbd>
    </button>
  )
}

/** The acting store, promoted out of the account popup into its own chip. */
function StoreChip() {
  const { t } = useTranslation()
  const store = useSession((s) => s.currentStoreCode)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, () => setOpen(false), [ref])
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={
          'flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs ' +
          (store
            ? 'border-border text-muted-foreground hover:bg-accent'
            : 'border-attention-border bg-attention-050 text-attention-800')
        }
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden lg:inline">{t('storeSwitcher.label')}</span>
        <b className="font-mono font-semibold text-foreground">{store || '—'}</b>
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="text-xs font-medium text-muted-foreground">{t('storeSwitcher.label')}</div>
          <StoreSwitcher />
          {!store && <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">{t('storeSwitcher.unset')}</p>}
        </div>
      )}
    </div>
  )
}

/** The broadcast entry as a top-bar action (C only) — shown iff its menu leaf is visible. */
function BroadcastButton() {
  const { t } = useTranslation()
  const { menu } = useShellModel()
  const has = menu.some((g) => g.items?.some((l) => l.routerLink === '/admin/broadcast'))
  if (!has) return null
  return (
    <NavLink
      to="/admin/broadcast"
      title={t('broadcast:menu.sendBroadcast')}
      aria-label={t('broadcast:menu.sendBroadcast')}
      className={({ isActive: a }) => 'rounded-md p-1.5 hover:bg-accent ' + (a ? 'bg-accent text-foreground' : 'text-muted-foreground')}
    >
      <Megaphone className="h-[18px] w-[18px]" aria-hidden />
    </NavLink>
  )
}

/** The account menu — identity, theme, shortcuts (later), build stamp, sign out. */
function UserMenu({ where, railWidth = 48, expanded }: { where: 'rail' | 'top'; railWidth?: number; expanded?: boolean }) {
  const { t } = useTranslation()
  const session = useSession()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  useDismiss(open, () => setOpen(false), [btn, pop])
  const name = session.displayName || session.userId || t('user')
  return (
    <>
      <div ref={btn} className={expanded ? 'w-full' : ''}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={t('topbar.account')}
          title={name}
          className={
            where === 'rail'
              ? 'flex items-center gap-2 rounded-md p-1 text-start hover:bg-sidebar-accent ' + (expanded ? 'w-full' : '')
              : 'flex items-center gap-1.5 rounded-md p-0.5 hover:bg-accent'
          }
        >
          <span
            className={
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ' +
              (where === 'rail' ? 'bg-white/15 text-white' : 'bg-primary text-primary-foreground')
            }
          >
            {initials(name)}
          </span>
          {expanded && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-white">{name}</span>
              <span className="block truncate font-mono text-[10.5px] text-sidebar-muted">{session.currentStoreCode || '—'}</span>
            </span>
          )}
        </button>
      </div>
      {open && (
        <div
          ref={pop}
          className={
            'z-50 w-64 rounded-lg border border-border bg-card p-2 text-foreground shadow-lg ' +
            (where === 'rail' ? 'fixed bottom-2' : 'absolute end-3 top-11')
          }
          style={where === 'rail' ? { insetInlineStart: railWidth + 8 } : undefined}
        >
          <div className="border-b border-border px-2 pb-2">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">{session.userId}</div>
          </div>
          <button type="button" onClick={theme.toggle} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
            {theme.dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            {t('topbar.darkMode')}
          </button>
          <button type="button" disabled className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm opacity-50" title="PROTOTYPE: arrives with the keyboard step">
            <Keyboard className="h-4 w-4" aria-hidden />
            Keyboard shortcuts
          </button>
          <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
            <LogOut className="h-4 w-4" aria-hidden />
            {t('actions.logout')}
          </button>
          <div className="mt-1 border-t border-border px-2 pt-1.5 text-end text-[10.5px] text-muted-foreground">
            {t('brand')} · {buildTag}
          </div>
        </div>
      )}
    </>
  )
}

function TopBar({ leading, user, broadcast }: { leading?: ReactNode; user?: boolean; broadcast?: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
      {leading}
      <Crumb />
      {p363.cmd ? <CmdSlot /> : <div className="flex-1" />}
      <div className="flex shrink-0 items-center gap-1.5">
        <StoreChip />
        {broadcast && <BroadcastButton />}
        <NotificationBell />
        {user && <UserMenu where="top" />}
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// phone (<640): every variant hides its rail behind a hamburger drawer
// ---------------------------------------------------------------------------

function PhoneDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { menu } = useShellModel()
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(true, onClose, [ref])
  useEffect(() => {
    document.body.classList.add('blocked-scroll')
    return () => document.body.classList.remove('blocked-scroll')
  }, [])
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden />
      <div ref={ref} className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col gap-3 overflow-y-auto bg-sidebar p-3">
        <div className="flex items-center gap-2 ps-1">
          <BrandMark size={24} />
          <span className="flex-1 text-sm font-semibold text-white">{t('brandName')}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-sidebar-foreground hover:bg-sidebar-accent">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {menu.map((g) => (
          <div key={g.labelKey}>
            <div className="mb-1 ps-3 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">{t(g.labelKey)}</div>
            <NavyGroupItems group={g} onNavigate={onClose} />
          </div>
        ))}
      </div>
    </>
  )
}

function Frame({
  rail,
  overlay,
  topBar,
}: {
  rail: ReactNode
  overlay?: ReactNode
  topBar: (leading: ReactNode) => ReactNode
}) {
  const { t } = useTranslation()
  const phone = useMedia('(max-width: 639px)')
  const [drawer, setDrawer] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setDrawer(false), [pathname])
  const hamburger = phone ? (
    <button type="button" onClick={() => setDrawer(true)} aria-label={t('topbar.toggleMenu')} className="rounded-md p-1.5 hover:bg-accent">
      <MenuIcon className="h-5 w-5" aria-hidden />
    </button>
  ) : null
  return (
    <div className="flex min-h-screen">
      {!phone && rail}
      {!phone && overlay}
      <div className="flex min-w-0 flex-1 flex-col">
        {topBar(hamburger)}
        <main className="min-w-0 flex-1 p-4">
          <Outlet />
        </main>
      </div>
      {phone && drawer && <PhoneDrawer onClose={() => setDrawer(false)} />}
    </div>
  )
}

function RailBrand({ withName }: { withName?: boolean }) {
  const { t } = useTranslation()
  return (
    <NavLink to="/" aria-label={t('brand')} title={t('brand')} className="mb-2 flex h-9 shrink-0 items-center gap-2 rounded-md px-1.5 hover:bg-sidebar-accent">
      <BrandMark size={26} />
      {withName && <span className="truncate text-sm font-semibold tracking-tight text-white">{t('brandName')}</span>}
    </NavLink>
  )
}

// ---------------------------------------------------------------------------
// A — Icon rail + flyout (Far as drawn: 48px)
// B — Labelled rail + flyout (72px)
// ---------------------------------------------------------------------------

function FlyoutRail({ labelled }: { labelled: boolean }) {
  const { menu, activeGroup } = useShellModel()
  const f = useFlyout()
  const width = labelled ? 72 : 48
  const openGroup = menu.find((g) => g.labelKey === f.open)
  return (
    <Frame
      rail={
        <nav
          ref={f.railRef}
          aria-label="Main"
          data-rail
          className="sticky top-0 z-40 flex h-screen shrink-0 flex-col items-center gap-1 overflow-y-auto bg-sidebar py-2.5"
          style={{ width }}
        >
          <RailBrand />
          {menu.map((g) => (
            <RailGroupButton
              key={g.labelKey}
              group={g}
              labelled={labelled}
              edge={labelled ? 4 : 6}
              active={g === activeGroup}
              open={f.open === g.labelKey}
              onToggle={() => f.setOpen(f.open === g.labelKey ? null : g.labelKey)}
              onHover={() => f.open && f.setOpen(g.labelKey)}
            />
          ))}
          <div className="flex-1" />
          <UserMenu where="rail" railWidth={width} />
        </nav>
      }
      overlay={openGroup && <Flyout group={openGroup} inset={width} onClose={() => f.setOpen(null)} panelRef={f.panelRef} />}
      topBar={(leading) => <TopBar leading={leading} />}
    />
  )
}

// ---------------------------------------------------------------------------
// C — Rail + docked panel
// ---------------------------------------------------------------------------

function LightLeaf({ item }: { item: ShellMenuItem }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const active = isActive(item, pathname)
  const Icon = item.icon
  return (
    <NavLink
      to={item.routerLink!}
      end={item.exact}
      className={
        'relative flex h-8 items-center gap-2 rounded-md ps-3 pe-2 text-[13px] ' +
        (active
          ? 'bg-primary-050 font-medium text-foreground before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-cursor'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground')
      }
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="truncate">{t(item.labelKey)}</span>
    </NavLink>
  )
}

function DockedPanelRail() {
  const { t } = useTranslation()
  const { menu, activeGroup } = useShellModel()
  const narrow = useMedia('(max-width: 1279px)')
  const [pinned, setPinned] = useStored('proto363.c.panel', true)
  const docked = pinned && !narrow
  // Which group the panel shows: the one clicked, else the active one.
  const [shown, setShown] = useState<string | null>(null)
  const { pathname } = useLocation()
  useEffect(() => setShown(null), [pathname])
  const f = useFlyout()
  const panelGroup = menu.find((g) => g.labelKey === shown) ?? activeGroup ?? menu[0]
  const openGroup = menu.find((g) => g.labelKey === f.open)
  return (
    <Frame
      rail={
        <div className="sticky top-0 z-40 flex h-screen shrink-0">
          <nav ref={f.railRef} aria-label="Main" data-rail className="flex w-12 flex-col items-center gap-1 overflow-y-auto bg-sidebar py-2.5">
            <RailBrand />
            {menu.map((g) => (
              <RailGroupButton
                key={g.labelKey}
                group={g}
                edge={6}
                active={g === activeGroup}
                open={docked ? g === panelGroup && g !== activeGroup : f.open === g.labelKey}
                onToggle={() =>
                  docked ? setShown(g.labelKey) : f.setOpen(f.open === g.labelKey ? null : g.labelKey)
                }
                onHover={() => !docked && f.open && f.setOpen(g.labelKey)}
              />
            ))}
            <div className="flex-1" />
            {!narrow && (
              <button
                type="button"
                onClick={() => setPinned(!pinned)}
                aria-label={pinned ? 'Hide panel' : 'Show panel'}
                title={pinned ? 'Hide panel' : 'Show panel'}
                className="grid h-8 w-8 place-items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              >
                {pinned ? <ChevronsLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden /> : <ChevronsRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
              </button>
            )}
          </nav>
          {docked && panelGroup && (
            <aside aria-label={t(panelGroup.labelKey)} className="flex w-[216px] flex-col gap-1 overflow-y-auto border-e border-border bg-card-2 p-2.5">
              <div className="mb-1 flex h-7 items-center ps-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(panelGroup.labelKey)}
              </div>
              {(panelGroup.items ?? []).map((c) =>
                c.items ? (
                  <div key={c.labelKey} className="flex flex-col gap-0.5">
                    <LightLeaf item={{ ...c, items: undefined, exact: true }} />
                    <div className="ms-5 flex flex-col gap-0.5 border-s border-border ps-1">
                      {c.items.map((l) => (
                        <LightLeaf key={l.labelKey} item={l} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <LightLeaf key={c.labelKey} item={c} />
                ),
              )}
            </aside>
          )}
        </div>
      }
      overlay={!docked && openGroup && <Flyout group={openGroup} inset={48} onClose={() => f.setOpen(null)} panelRef={f.panelRef} />}
      topBar={(leading) => <TopBar leading={leading} user broadcast />}
    />
  )
}

// ---------------------------------------------------------------------------
// D — Expanding rail (56px icons ↔ 240px full tree)
// ---------------------------------------------------------------------------

function ExpandingRail() {
  const { t } = useTranslation()
  const { menu, activeGroup, pathname } = useShellModel()
  const narrow = useMedia('(max-width: 1279px)')
  const [pinned, setPinned] = useStored('proto363.d.expanded', true)
  const [peek, setPeek] = useState(false) // narrow: expanding overlays instead of pushing
  useEffect(() => setPeek(false), [pathname])
  const expanded = narrow ? peek : pinned
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  useEffect(() => setOpenGroups(new Set(activeGroup ? [activeGroup.labelKey] : [])), [activeGroup])
  const f = useFlyout()
  const openGroup = menu.find((g) => g.labelKey === f.open)
  const width = expanded ? 240 : 56
  const toggle = () => (narrow ? setPeek(!peek) : setPinned(!pinned))

  const rail = (
    <nav
      ref={f.railRef}
      aria-label="Main"
      data-rail
      className={
        'top-0 z-40 flex h-screen shrink-0 flex-col gap-1 overflow-y-auto bg-sidebar py-2.5 ' +
        (expanded ? 'px-2.5 ' : 'items-center ') +
        (narrow && expanded ? 'fixed start-0 shadow-2xl' : 'sticky')
      }
      style={{ width }}
    >
      <RailBrand withName={expanded} />
      {expanded
        ? menu.map((g) => {
            const open = openGroups.has(g.labelKey)
            const Icon = g.icon!
            return (
              <div key={g.labelKey} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const n = new Set(openGroups)
                    if (open) n.delete(g.labelKey)
                    else n.add(g.labelKey)
                    setOpenGroups(n)
                  }}
                  aria-expanded={open}
                  className={
                    'relative flex h-8 items-center gap-2 rounded-md ps-3 pe-2 text-[11px] font-semibold uppercase tracking-wide hover:bg-sidebar-accent ' +
                    (g === activeGroup ? 'text-white' : 'text-sidebar-muted')
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate text-start">{t(g.labelKey)}</span>
                  <ChevronDown className={'h-3.5 w-3.5 transition-transform ' + (open ? '' : '-rotate-90 rtl:rotate-90')} aria-hidden />
                </button>
                {open && (
                  <div className="ms-3">
                    <NavyGroupItems group={g} dense />
                  </div>
                )}
              </div>
            )
          })
        : menu.map((g) => (
            <RailGroupButton
              key={g.labelKey}
              group={g}
              edge={10}
              active={g === activeGroup}
              open={f.open === g.labelKey}
              onToggle={() => f.setOpen(f.open === g.labelKey ? null : g.labelKey)}
              onHover={() => f.open && f.setOpen(g.labelKey)}
            />
          ))}
      <div className="flex-1" />
      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
        title={expanded ? 'Collapse menu' : 'Expand menu'}
        className={
          'flex h-8 shrink-0 items-center gap-2 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-white ' +
          (expanded ? 'px-3' : 'w-9 justify-center')
        }
      >
        {expanded ? <ChevronsLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden /> : <ChevronsRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
        {expanded && <span>Collapse</span>}
      </button>
      <UserMenu where="rail" railWidth={width} expanded={expanded} />
    </nav>
  )

  return (
    <Frame
      rail={
        narrow && expanded ? (
          <>
            {/* keeps the collapsed footprint so the page doesn't jump */}
            <div className="w-14 shrink-0 bg-sidebar" />
            <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setPeek(false)} aria-hidden />
            {rail}
          </>
        ) : (
          rail
        )
      }
      overlay={!expanded && openGroup && <Flyout group={openGroup} inset={56} onClose={() => f.setOpen(null)} panelRef={f.panelRef} />}
      topBar={(leading) => <TopBar leading={leading} />}
    />
  )
}

// ---------------------------------------------------------------------------

export default function RailShellPrototype() {
  if (p363.shell === 'B') return <FlyoutRail labelled />
  if (p363.shell === 'C') return <DockedPanelRail />
  if (p363.shell === 'D') return <ExpandingRail />
  return <FlyoutRail labelled={false} />
}
