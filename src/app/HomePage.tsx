import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MENU } from '@/layout/menu-model'
import { useVisibleMenu } from '@/layout/useVisibleMenu'
import { useSession } from '@/core/session'
import BrandMark from '@/core/ui/BrandMark'

// The BackOffice landing (map 478) — the default route in place of Deliveries.
// Lives in `app/` (the composition root), not `features/`: it reaches into the
// layout's menu model to render itself, which a feature is not allowed to do.
// Post-auth the hero is a tool, not a marketing surface (D-9): a plain card in
// the app's own language (no brand ground, no gold, no watermark — the lockup
// carries the brand), over section cards built from the SAME permission-filtered
// menu as the sidebar — a gated area the user can't open never appears here.

export default function HomePage() {
  const { t } = useTranslation('home')
  // `settled` (ticket 124) separates "nothing to open" from "not answered yet": a gated
  // item is hidden while its probe is pending, so an unsettled menu is empty for everyone
  // on first paint — reading length alone would flash the empty state on every load.
  const { items: menu, settled } = useVisibleMenu(MENU)
  const name = useSession((s) => s.displayName || s.userId)

  return (
    <section className="flex flex-col gap-6">
      {/* Hero — a card in the app's own language (D-9), hierarchy from type and
          padding. The lockup carries the brand; no brand ground, no watermark. */}
      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <span className="text-2xl font-semibold tracking-tight">{t('common:brandName')}</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          {name ? t('welcomeNamed', { name }) : t('welcome')}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Settled and nothing to open: say so. The user is signed in and entitled to
          nothing (no roles assigned yet) — a diagnosis and one action, no second card
          and no sign-out (the header already carries one). While UNSETTLED neither this
          nor the grid renders: the hero is already on screen and the probes are one
          cached round-trip, so a spinner would out-live nothing. */}
      {settled && menu.length === 0 && (
        <div data-no-access className="rounded-xl border border-border/60 bg-card p-8">
          <h2 className="text-base font-semibold tracking-tight">{t('noAccess.title')}</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t('noAccess.body')}</p>
          <p className="mt-4 max-w-xl text-sm">{t('noAccess.hint')}</p>
        </div>
      )}

      {/* Section cards — one per visible nav group, its leaves as quick links. Held back
          until the menu is SETTLED, so the cards arrive as one set rather than popping in
          probe by probe; and dropped entirely when there are none, so an empty menu never
          leaves a bare column gap above the message. */}
      {settled && menu.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {menu.map((group) => {
            const GroupIcon = group.icon
            return (
              <div
                key={group.labelKey}
                data-section-card={group.labelKey}
                className="rounded-xl border border-border/60 bg-card p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  {GroupIcon && <GroupIcon className="h-4 w-4 text-muted-foreground" aria-hidden />}
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(group.labelKey)}
                  </h2>
                </div>
                <ul className="flex flex-col gap-1">
                  {(group.items ?? []).map((leaf) => {
                    const LeafIcon = leaf.icon
                    return (
                      <li key={leaf.labelKey}>
                        <NavLink
                          to={leaf.routerLink!}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          {LeafIcon && (
                            <LeafIcon
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          )}
                          <span>{t(leaf.labelKey)}</span>
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
