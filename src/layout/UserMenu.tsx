import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useSession } from '@/core/session'
import { signOut } from '@/core/auth/sign-out'
import { buildTag } from '@/core/build-info'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { useTheme } from './theme'

// The user menu at the rail foot (spec 380 F12, ticket 386; 363 "User menu"): the
// avatar opens a menu holding name + user id, the theme toggle, sign out and the build
// stamp. Today's footer row is gone — the stamp lives here, and `/version.json` stays
// the machine read. The shortcuts sheet and the single-key switch join it in 393.
//
// It opens from the rail, so it is navy (377 §1); the rail's gold `--ring` reaches it as
// the `aside`'s child. 388 finishes the overlay recipe; this gives it its structure,
// focus and dismissal: a `menu` of `menuitem`s, focus on the first on open, arrows to
// move, Esc back to the avatar, and Tab, a press outside or navigation to close.

const MENU_ID = 'layout-user-menu'
const ITEM = '[role^="menuitem"]'

/** Two letters for the avatar. `name` is never blank: the caller falls back to `t('user')`. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return name.trim().slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

const ITEM_CLASS =
  'flex h-7 w-full items-center gap-2 rounded-md px-2 text-start text-[12.5px] hover:bg-rail-accent hover:text-rail-accent-foreground focus:bg-rail-accent focus:text-rail-accent-foreground'

/**
 * `beside` (the rail): the menu opens against the rail's inline-end edge. `above` (the
 * phone drawer, ticket 387): there is no room beside a drawer on a phone, so it opens
 * over the avatar, inside the drawer — whose foot is its positioned box.
 */
type UserMenuPlacement = 'beside' | 'above'

export default function UserMenu({
  expanded,
  onOpen,
  placement = 'beside',
}: {
  expanded: boolean
  onOpen?: () => void
  placement?: UserMenuPlacement
}) {
  const { t } = useTranslation()
  const session = useSession()
  const theme = useTheme()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Navigating closes it.
  useEffect(() => setOpen(false), [pathname])

  // Focus lands on the first item; Esc closes and hands focus back to the avatar; a
  // press anywhere outside closes without moving it.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>(ITEM)?.focus()
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

  // Arrows move through the items and wrap; Home and End jump; Tab leaves and closes.
  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') return setOpen(false)
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const to =
      e.key === 'ArrowDown' ? (at + 1) % items.length
      : e.key === 'ArrowUp' ? (at - 1 + items.length) % items.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
      : null
    if (to === null || items.length === 0) return
    e.preventDefault()
    items[to].focus()
  }

  const name = session.displayName?.trim() || session.userId?.trim() || t('user')

  return (
    <div ref={ref} className={'mt-1 shrink-0 ' + (expanded ? 'mx-2.5' : 'mx-auto')}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) onOpen?.()
          setOpen(!open)
        }}
        aria-label={t('topbar.account')}
        // A free-text name in a string-only sink takes FSI…PDI (bidi rule).
        title={expanded ? undefined : fsi(name)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? MENU_ID : undefined}
        data-user-menu-button
        className={
          'flex items-center gap-2 rounded-md text-start hover:bg-rail-accent ' +
          (expanded ? 'h-10 w-full px-1.5' : 'h-9 w-9 justify-center') +
          (open ? ' bg-rail-accent' : '')
        }
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-rail-muted bg-rail-accent text-[11px] font-semibold text-rail-accent-foreground">
          {initials(name)}
        </span>
        {expanded && (
          <span className="min-w-0 flex-1">
            <bdi className="block truncate text-xs font-medium text-rail-accent-foreground">{name}</bdi>
            {session.userId && (
              <span className="block truncate font-mono text-[10.5px] text-rail-muted">
                <Ltr>{session.userId}</Ltr>
              </span>
            )}
          </span>
        )}
      </button>

      {open && (
        <div
          data-user-menu
          // Beside: against the rail's inline-end edge, level with its foot. Above: over
          // the avatar, inside the drawer. Logical either way, so both mirror.
          className={
            'absolute z-50 w-64 rounded-lg border border-rail-accent bg-rail p-1.5 text-rail-foreground shadow-lg ' +
            (placement === 'above' ? 'bottom-full start-2.5 mb-1' : 'bottom-2 start-full ms-2')
          }
        >
          <div className="border-b border-rail-accent px-2 pt-1 pb-2">
            <bdi className="block truncate text-[13px] font-medium text-rail-accent-foreground">{name}</bdi>
            {session.userId && (
              <span className="block truncate font-mono text-[11px] text-rail-muted">
                <Ltr>{session.userId}</Ltr>
              </span>
            )}
          </div>
          <div
            ref={menuRef}
            id={MENU_ID}
            role="menu"
            aria-label={t('topbar.account')}
            onKeyDown={onMenuKey}
            className="flex flex-col gap-0.5 py-1"
          >
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={theme.dark}
              tabIndex={-1}
              onClick={theme.toggle}
              className={ITEM_CLASS}
            >
              {theme.dark ? <Sun className="h-4 w-4 shrink-0" aria-hidden /> : <Moon className="h-4 w-4 shrink-0" aria-hidden />}
              {t('topbar.userMenu.darkMode')}
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                void signOut()
              }}
              className={ITEM_CLASS}
            >
              <LogOut className="h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden />
              {t('topbar.userMenu.signOut')}
            </button>
          </div>
          <div data-build-stamp className="border-t border-rail-accent px-2 pt-1.5 pb-0.5 text-[10.5px] text-rail-muted">
            {t('topbar.userMenu.build')}{' '}
            <span className="font-mono">
              <Ltr>{buildTag}</Ltr>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
