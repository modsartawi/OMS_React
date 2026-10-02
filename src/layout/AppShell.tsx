import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from './theme'
import { useSession } from '@/core/session'
import { signOut } from '@/core/auth/sign-out'
import { buildTag } from '@/core/build-info'
import StoreSwitcher from '@/features/auth/StoreSwitcher'
import NotificationBell from './notifications/NotificationBell'
import Rail from './Rail'

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'U'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
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
  const theme = useTheme()

  // The navy rail on the inline-start side replaces the top-bar menu (ticket 385).
  // The top bar keeps today's items until 386 redraws it.
  return (
    <div className="flex min-h-screen">
      <Rail />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border/60 bg-background px-3">
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

        <main className="min-w-0 flex-1 p-4">
          <Outlet />
        </main>

        {/* Build stamp (issue 435): which build is live, at a glance. Machine-readable
            counterpart is /version.json. */}
        <footer className="border-t border-border px-3 py-1 text-end text-[11px] text-muted-foreground">
          {t('brand')} · {buildTag}
        </footer>
      </div>
    </div>
  )
}
