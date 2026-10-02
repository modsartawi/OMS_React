import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Folder, Menu, X } from 'lucide-react'
import { MENU, isActive, type ShellMenuItem } from './menu-model'
import { useVisibleMenu } from './useVisibleMenu'
import { useRailPreference } from './rail-preference'
import { railExpanded, type RailMode } from './rail-mode'
import BrandMark from '@/core/ui/BrandMark'
import { RAIL_EDGE, RAIL_POPOVER } from '@/core/ui/overlay'
import UserMenu from './UserMenu'

// The navy rail (spec 380 F10, ticket 385; the owner's shell D, 363 §"The frame").
// Collapsed (56px, the default) it is one icon per visible group, each opening a
// 240px flyout; expanded (240px) it is the labelled accordion tree. The toggle at
// its foot is the user's remembered preference (`rail-preference.ts`).
//
// Below 1280px (F13, ticket 387; `rail-mode.ts`) the rail stays collapsed and its
// toggle lays the tree OVER the page behind the scrim instead; below 640px there is
// no rail, and `RailDrawer` — a hamburger in the top bar — opens the tree in a drawer.

const FLYOUT_ID = 'layout-rail-flyout'
const FLYOUT_LABEL_ID = 'layout-rail-flyout-label'
const DRAWER_ID = 'layout-rail-drawer'

/**
 * An Esc the open user menu inside the rail or the drawer is already handling: it
 * closes the menu, and only a second Esc closes what the menu sits in.
 */
const inUserMenu = (e: KeyboardEvent) => e.target instanceof Element && !!e.target.closest('[data-user-menu]')

/**
 * The active marker: a 3px gold bar drawn by `::before` on the inline-start edge
 * of the row it marks — `start-0`, so it mirrors under RTL by itself, and never an
 * inset shadow, which has no logical form.
 */
const MARKER =
  'before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-rail-active'

/** A group's label, wherever it heads its leaves: the tree, the flyout and the drawer. */
const GROUP_LABEL = 'text-[11px] font-semibold uppercase tracking-wide'

/** Every row that draws one menu item takes exactly these. */
interface RowProps {
  item: ShellMenuItem
  onNavigate?: () => void
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

/** The group holds the screen on view — through a leaf, or a sub-group's prefix. */
function holdsActive(group: ShellMenuItem, pathname: string): boolean {
  return (group.items ?? []).some((c) => isActive(c, pathname))
}

/** A closed row's chevron points forward, so it mirrors; an open one points down. */
function RowChevron({ open }: { open: boolean }) {
  return open ? (
    <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
  ) : (
    <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl:-scale-x-100" aria-hidden />
  )
}

function RailLeaf({ item, onNavigate }: RowProps) {
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
        'relative flex h-8 items-center gap-2 rounded-md ps-3 pe-2 text-[13px] ' +
        (active
          ? 'bg-rail-accent font-medium text-rail-accent-foreground ' + MARKER
          : 'hover:bg-rail-accent hover:text-rail-accent-foreground')
      }
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="truncate">{t(item.labelKey)}</span>
    </NavLink>
  )
}

/**
 * The header of a group's child that has children of its own — one extra level, and
 * only one (ticket 284, spec 282 D2). The node is both a label and a destination (the
 * settlement Overview), so the header is a link.
 *
 * 🚩 A plain `Link`, NOT a `NavLink`, and that is the whole point of the row: the
 * node never claims to be the page you are on. It points at the same address as its
 * Overview child, so a `NavLink` here would put `aria-current="page"` on two elements
 * at once on the Overview — the very two-things-highlighted bug `exact` exists to
 * remove, restated to a screen reader. Its emphasis comes from `hasActiveChild`
 * instead: "you are somewhere in here", never the leaf's selected ground.
 */
function SubGroupLink({ item, onNavigate, hasActiveChild }: RowProps & { hasActiveChild: boolean }) {
  const { t } = useTranslation()
  const Icon = item.icon
  return (
    <Link
      to={item.routerLink!}
      onClick={onNavigate}
      className={
        'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md ps-3 pe-2 text-[13px] hover:bg-rail-accent hover:text-rail-accent-foreground ' +
        (hasActiveChild ? 'font-medium text-rail-accent-foreground' : '')
      }
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  )
}

function SubGroupLeaves({ item, onNavigate }: RowProps) {
  return (
    <div data-region="menu-subgroup" className="ms-5 flex flex-col gap-0.5 border-s border-rail-accent ps-1">
      {(item.items ?? []).map((c) => (
        <RailLeaf key={c.labelKey} item={c} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

/**
 * The sub-group in the expanded tree: today's accordion row — the link beside a
 * chevron that expands it, auto-expanded on an active descendant.
 *
 * 🚩 **Bounded to one extra level on purpose, not generically recursive.** There is
 * no visual design for a fourth: the group header is uppercase and muted, a leaf is
 * sentence case, and there is no third type. So its children render as leaves
 * unconditionally rather than dispatching on `c.items` again.
 */
function TreeSubGroup({ item, onNavigate }: RowProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const hasActiveChild = holdsActive(item, pathname)
  const [expanded, toggle] = useExpanded(hasActiveChild)
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-0.5">
        <SubGroupLink item={item} onNavigate={onNavigate} hasActiveChild={hasActiveChild} />
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={t('rail.toggleSection', { label: t(item.labelKey) })}
          className="rounded-md p-1.5 text-rail-muted hover:bg-rail-accent hover:text-rail-accent-foreground"
        >
          <RowChevron open={expanded} />
        </button>
      </div>
      {expanded && <SubGroupLeaves item={item} onNavigate={onNavigate} />}
    </div>
  )
}

/** The sub-group in a flyout: the header link over its indented leaves, always open (363). */
function FlyoutSubGroup({ item, onNavigate }: RowProps) {
  const { pathname } = useLocation()
  return (
    <div className="flex flex-col gap-0.5">
      <SubGroupLink item={item} onNavigate={onNavigate} hasActiveChild={holdsActive(item, pathname)} />
      <SubGroupLeaves item={item} onNavigate={onNavigate} />
    </div>
  )
}

/**
 * A group's children. One dispatch line, one extra level (284): a child with children
 * of its own draws as a sub-group; everything else is a leaf.
 *
 * 🚩 BOTH conditions, because the sub-group's header IS a link — a node with children
 * but nowhere of its own to go has no honest header to draw, and would render
 * `<Link to={undefined}>`. Nothing in `MENU` is that shape; this is what keeps a
 * future one visible rather than broken.
 */
function GroupItems({ group, onNavigate, flyout }: { group: ShellMenuItem; onNavigate?: () => void; flyout?: boolean }) {
  const SubGroup = flyout ? FlyoutSubGroup : TreeSubGroup
  return (
    <div className="flex flex-col gap-0.5">
      {(group.items ?? []).map((c) =>
        c.items && c.routerLink ? (
          <SubGroup key={c.labelKey} item={c} onNavigate={onNavigate} />
        ) : (
          <RailLeaf key={c.labelKey} item={c} onNavigate={onNavigate} />
        ),
      )}
    </div>
  )
}

/**
 * A group in the expanded tree: an uppercase header in the rail's muted ink — white
 * while it holds the screen on view — over its leaves, open while it holds the screen.
 */
function TreeGroup({ item, onNavigate }: RowProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const hasActiveChild = holdsActive(item, pathname)
  const [expanded, toggle] = useExpanded(hasActiveChild)
  const Icon = item.icon
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className={
          'flex h-8 items-center gap-2 rounded-md ps-3 pe-2 ' + GROUP_LABEL + ' hover:bg-rail-accent hover:text-rail-accent-foreground ' +
          (hasActiveChild ? 'text-rail-accent-foreground' : 'text-rail-muted')
        }
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="flex-1 truncate text-start">{t(item.labelKey)}</span>
        <RowChevron open={expanded} />
      </button>
      {expanded && (
        <div className="ms-3">
          <GroupItems group={item} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  )
}

/** The ground of a collapsed rail's icon: lit while active or while its flyout is open. */
function iconClass(lit: boolean): string {
  return (
    'grid h-9 w-9 place-items-center rounded-md ' +
    (lit ? 'bg-rail-accent text-rail-accent-foreground' : 'hover:bg-rail-accent hover:text-rail-accent-foreground')
  )
}

/** The flyout: a navy panel continuing the rail, holding one group's leaves. */
function Flyout({ group, onClose }: { group: ShellMenuItem; onClose: (restoreFocus: boolean) => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  // Focus lands on the first link whenever the panel opens or switches group.
  // 🚩 Keyed on the label, not the object: `useVisibleMenu` rebuilds every group on
  // each render, so a probe settling or a query-string change would otherwise pull
  // focus back here from wherever the user had moved it.
  const groupKey = group.labelKey
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('a')?.focus()
  }, [groupKey])
  return (
    <div
      ref={ref}
      id={FLYOUT_ID}
      role="dialog"
      aria-labelledby={FLYOUT_LABEL_ID}
      data-rail-flyout
      // `start-full` puts the panel flush against the rail's inline-end edge, in
      // either direction. It opens from the rail, so it is the rail's navy (388).
      className={'absolute inset-y-0 start-full flex w-60 flex-col gap-2 overflow-y-auto border-e p-3 ' + RAIL_POPOVER}
    >
      <div className="flex h-7 shrink-0 items-center justify-between gap-2 ps-3">
        <div id={FLYOUT_LABEL_ID} className={'truncate text-rail-muted ' + GROUP_LABEL}>
          {t(group.labelKey)}
        </div>
        <button
          type="button"
          onClick={() => onClose(true)}
          aria-label={t('rail.close')}
          title={t('rail.close')}
          className="rounded-md p-1 hover:bg-rail-accent hover:text-rail-accent-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <GroupItems group={group} onNavigate={() => onClose(false)} flyout />
    </div>
  )
}

export default function Rail({ mode }: { mode: Exclude<RailMode, 'drawer'> }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  // The same permission-aware menu the tree has always read (issue 429), so gating is
  // unchanged: a group whose leaves all hide is gone from the rail too.
  const { items: menu } = useVisibleMenu(MENU)
  const preference = useRailPreference((s) => s.expanded)
  const togglePreference = useRailPreference((s) => s.toggle)
  // 640–1279px: the tree laid over the page. Never written to the preference.
  const [overlayOpen, setOverlayOpen] = useState(false)
  const expanded = railExpanded(mode, preference, overlayOpen)
  const overlaid = mode === 'overlay' && expanded
  // The `labelKey` of the group whose flyout is open, if any.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const railRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // Navigating closes the flyout and the overlaid tree (a link to the page already on
  // view closes them too, through the leaves' own `onNavigate`). Crossing a band closes
  // both, so a window widened past 1280px never inherits a transient overlay.
  useEffect(() => {
    setOpenKey(null)
    setOverlayOpen(false)
  }, [pathname, mode])

  // The overlaid tree closes on Esc and hands focus back to its toggle; a click on the
  // scrim closes it too.
  useEffect(() => {
    if (!overlaid) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || inUserMenu(e)) return
      setOverlayOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlaid])

  const closeOverlay = () => setOverlayOpen(false)
  // Overlaid, the tree's links close it; pinned, they have nothing to close.
  const onTreeNavigate = overlaid ? closeOverlay : undefined

  const close = (restoreFocus: boolean) => {
    if (restoreFocus && openKey !== null)
      railRef.current?.querySelector<HTMLElement>(`[data-rail-group="${openKey}"]`)?.focus()
    setOpenKey(null)
  }

  // Esc closes and hands focus back to the group's icon; a press anywhere outside the
  // rail and its flyout closes without moving focus.
  useEffect(() => {
    if (openKey === null) return
    const onDown = (e: MouseEvent) => {
      if (!railRef.current?.contains(e.target as Node)) close(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close(true)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
    // `close` is rebuilt each render but reads only `openKey`, which this effect keys on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey])

  const openGroup = expanded ? undefined : menu.find((g) => g.items && g.labelKey === openKey)

  return (
    <aside
      id="layout-rail"
      ref={railRef}
      data-rail={expanded ? 'expanded' : 'collapsed'}
      data-rail-mode={mode}
      // Navy in both themes (F5), where the light navy ring would vanish: inside it the
      // ring is gold, which is what gold on navy is for. Paper never carries it (F20).
      // Overlaid, the aside keeps its 56px footprint, so the page does not move, and
      // the `nav` stretches over the page from it.
      className={
        'sticky top-0 z-40 h-screen shrink-0 bg-rail text-rail-foreground [--ring:var(--gold)] print:hidden ' +
        (expanded && !overlaid ? 'w-60' : 'w-14')
      }
    >
      {overlaid && <div data-rail-scrim aria-hidden className="fixed inset-0 bg-backdrop" onClick={closeOverlay} />}
      <nav
        className={
          'flex flex-col py-2.5 ' +
          (overlaid ? 'absolute inset-y-0 start-0 w-60 border-e ' + RAIL_POPOVER : 'h-full')
        }
      >
        <Link
          to="/"
          onClick={onTreeNavigate}
          aria-label={t('brand')}
          title={t('brand')}
          className={
            'mb-2 flex h-9 shrink-0 items-center gap-2 rounded-md hover:bg-rail-accent ' +
            (expanded ? 'mx-2.5 px-1.5' : 'mx-auto w-9 justify-center')
          }
        >
          <BrandMark size={26} />
          {expanded && (
            <span className="truncate text-sm font-semibold tracking-tight text-rail-accent-foreground">
              {t('brandName')}
            </span>
          )}
        </Link>

        {/* The scroll lives here, not on the `aside`: the flyout is the aside's
            absolutely placed child and an overflow there would clip it. */}
        <div className={'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1 ' + (expanded ? 'px-2.5' : '')}>
          {expanded
            ? menu.map((item) =>
                item.items ? (
                  <TreeGroup key={item.labelKey} item={item} onNavigate={onTreeNavigate} />
                ) : (
                  <RailLeaf key={item.labelKey} item={item} onNavigate={onTreeNavigate} />
                ),
              )
            : menu.map((item) => {
                const label = t(item.labelKey)
                const Icon = item.icon ?? Folder
                const active = item.items ? holdsActive(item, pathname) : isActive(item, pathname)
                // The row spans the rail, so the marker on its start edge sits flush
                // on the rail's own edge.
                const row = 'relative flex justify-center ' + (active ? MARKER : '')
                if (!item.items)
                  return (
                    <div key={item.labelKey} className={row} data-active={active || undefined}>
                      <NavLink to={item.routerLink!} end={item.exact} aria-label={label} title={label} className={iconClass(active)}>
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </NavLink>
                    </div>
                  )
                const isOpen = openKey === item.labelKey
                return (
                  <div key={item.labelKey} className={row} data-active={active || undefined}>
                    <button
                      type="button"
                      data-rail-group={item.labelKey}
                      onClick={() => setOpenKey(isOpen ? null : item.labelKey)}
                      // Menu-bar behaviour: while one flyout is open, pointing at another
                      // group switches to it.
                      onMouseEnter={() => {
                        if (openKey !== null && !isOpen) setOpenKey(item.labelKey)
                      }}
                      aria-label={label}
                      title={label}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      aria-controls={isOpen ? FLYOUT_ID : undefined}
                      className={iconClass(active || isOpen)}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                  </div>
                )
              })}
        </div>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => {
            setOpenKey(null)
            if (mode === 'pinned') togglePreference()
            else setOverlayOpen(!overlayOpen)
          }}
          // Overlaid, the toggle discloses a transient panel; pinned, it is a setting.
          aria-expanded={mode === 'overlay' ? overlayOpen : undefined}
          aria-label={expanded ? undefined : t('rail.expand')}
          title={expanded ? undefined : t('rail.expand')}
          className={
            'mt-1 flex h-8 shrink-0 items-center gap-2 rounded-md text-xs hover:bg-rail-accent hover:text-rail-accent-foreground ' +
            (expanded ? 'mx-2.5 px-3' : 'mx-auto w-9 justify-center')
          }
        >
          {expanded ? (
            <>
              <ChevronsLeft className="h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden />
              <span className="truncate">{t('rail.collapse')}</span>
            </>
          ) : (
            <ChevronsRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          )}
        </button>

        {/* The avatar under the toggle (363 "The frame"); opening it closes a flyout. */}
        <UserMenu expanded={expanded} onOpen={() => setOpenKey(null)} />

        {/* Inside the `nav`: its links are navigation like the tree's. Placed against
            the `aside`, the nearest positioned box. */}
        {openGroup && <Flyout group={openGroup} onClose={close} />}
      </nav>
    </aside>
  )
}

/** What Tab cycles through inside the drawer: its links and buttons, never a menu's roving items. */
const TABBABLE = 'a[href], button:not([disabled]):not([tabindex="-1"])'

/**
 * Below 640px (F13, ticket 387): there is no rail. A hamburger at the top bar's inline
 * start opens a navy drawer holding the whole labelled tree — the brand, every visible
 * group with every leaf, the Settlement sub-group as header plus indented leaves — and
 * the user menu at its foot, since the rail that carried it is gone.
 *
 * It is modal: the body stops scrolling, Tab stays inside, and Esc, a click on the
 * scrim or navigating closes it — and every close hands focus back to the hamburger.
 * Portalled to `body` so the top bar's own stacking context cannot sink it under the
 * page.
 */
export function RailDrawer() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { items: menu } = useVisibleMenu(MENU)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => setOpen(false), [pathname])

  // Opening moves focus to the first link; closing, however it happens, returns it to
  // the hamburger.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('nav a')?.focus()
    else if (wasOpen.current) buttonRef.current?.focus()
    wasOpen.current = open
  }, [open])

  // The page behind the drawer holds still. The previous value is put back, not
  // cleared, in case anything else had locked it first.
  useEffect(() => {
    if (!open) return
    const body = document.body
    const before = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = before
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !inUserMenu(e)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Tab wraps at either end rather than leaving for the page under the scrim.
  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    // The open user menu's items sit after the avatar but out of the tab order, so
    // focus on one of them is at the drawer's end too (the menu closes itself on Tab).
    const atEnd = document.activeElement === last || !!document.activeElement?.closest('[data-user-menu]')
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && atEnd) {
      e.preventDefault()
      first.focus()
    }
  }

  const close = () => setOpen(false)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('topbar.drawer.open')}
        title={t('topbar.drawer.open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? DRAWER_ID : undefined}
        data-drawer-button
        className="-ms-1 shrink-0 rounded-md p-1.5 hover:bg-accent"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      {open &&
        createPortal(
          <>
            <div data-drawer-scrim aria-hidden className="fixed inset-0 z-40 bg-backdrop print:hidden" onClick={close} />
            <div
              ref={panelRef}
              id={DRAWER_ID}
              role="dialog"
              aria-modal="true"
              aria-label={t('topbar.drawer.label')}
              onKeyDown={onPanelKey}
              data-rail-drawer
              // The rail's own ground, ink and gold ring, at the inline start in either direction.
              className={'fixed inset-y-0 start-0 z-50 flex w-72 max-w-[calc(100vw-3rem)] flex-col border-e print:hidden ' + RAIL_POPOVER}
            >
              <div className="flex h-12 shrink-0 items-center gap-2 px-3">
                <Link
                  to="/"
                  onClick={close}
                  aria-label={t('brand')}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 hover:bg-rail-accent"
                >
                  <BrandMark size={24} />
                  <span className="truncate text-sm font-semibold tracking-tight text-rail-accent-foreground">
                    {t('brandName')}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t('rail.close')}
                  title={t('rail.close')}
                  className="rounded-md p-1 hover:bg-rail-accent hover:text-rail-accent-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2.5 pb-2">
                {menu.map((item) =>
                  item.items ? (
                    <section key={item.labelKey} aria-label={t(item.labelKey)} className="flex flex-col gap-0.5">
                      <div
                        className={
                          'ps-3 ' + GROUP_LABEL + ' ' +
                          (holdsActive(item, pathname) ? 'text-rail-accent-foreground' : 'text-rail-muted')
                        }
                      >
                        {t(item.labelKey)}
                      </div>
                      <GroupItems group={item} onNavigate={close} flyout />
                    </section>
                  ) : (
                    <RailLeaf key={item.labelKey} item={item} onNavigate={close} />
                  ),
                )}
              </nav>
              <div className={'relative shrink-0 border-t py-2 ' + RAIL_EDGE}>
                <UserMenu expanded placement="above" />
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
