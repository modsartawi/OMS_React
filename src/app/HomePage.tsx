import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MENU } from '@/layout/menu-model'
import { useVisibleMenu } from '@/layout/useVisibleMenu'
import { useSession } from '@/core/session'
import BrandMark from '@/core/ui/BrandMark'

// The BackOffice landing (map 478) — the default route in place of Deliveries.
// Lives in `app/` (the composition root), not `features/`: it reaches into the
// layout's menu model to render itself, which a feature is not allowed to do.
// An Editorial-Split hero (navy ground + gold mark watermark) over section cards
// built from the SAME permission-filtered menu as the sidebar — a gated area the
// user can't open never appears here either.
const BRAND_NAVY = '#002554'

export default function HomePage() {
  const { t } = useTranslation('home')
  const menu = useVisibleMenu(MENU)
  const name = useSession((s) => s.displayName || s.userId)

  return (
    <section className="flex flex-col gap-6">
      {/* Hero — the chosen Editorial Split direction, scoped to a banner. */}
      <div
        className="relative overflow-hidden rounded-2xl p-8 text-white"
        style={{ backgroundColor: BRAND_NAVY }}
      >
        <BrandMark
          size={360}
          className="pointer-events-none absolute -bottom-20 -end-16 opacity-[0.10]"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark size={44} />
          <div className="flex flex-col leading-none">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FDC801]">
              {t('common:brandKicker')}
            </span>
            <span className="text-2xl font-semibold tracking-tight">{t('common:brandName')}</span>
          </div>
        </div>
        <h1 className="relative mt-6 text-2xl font-semibold tracking-tight">
          {name ? t('welcomeNamed', { name }) : t('welcome')}
        </h1>
        <p className="relative mt-1 max-w-xl text-sm text-white/70">{t('subtitle')}</p>
      </div>

      {/* Section cards — one per visible nav group, its leaves as quick links. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {menu.map((group) => {
          const GroupIcon = group.icon
          return (
            <div key={group.labelKey} className="rounded-xl border border-border/60 bg-card p-5">
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
                          <LeafIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
    </section>
  )
}
