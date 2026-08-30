import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import type { LoyMember } from '@/core/models/loy'
import ActionsTab from './ActionsTab'
import ActivitiesTab from './ActivitiesTab'
import ProfileTab from './ProfileTab'
import SalesTab from './SalesTab'
import type { MemberAuthority } from './api'
import { MEMBER_TABS, resolveTab, type MemberTab } from './tab-volume'

/**
 * The member's tab shell (ticket 236) — the strip Activities lands in and the two
 * other reads slot into.
 *
 * Three properties, and each is a behaviour rather than an arrangement:
 *
 * - 🚩 **A tab fetches only when it is opened.** That is structural here, not a
 *   flag: only the open tab's panel is mounted, so only its query exists. The
 *   consequence simplifies everything downstream — **only the open tab can be
 *   loading or failed**, so there is no invisible broken tab to signal and no
 *   badge to invent for one.
 * - **`?tab=` is the open tab**, so a link lands where it meant to and a reload
 *   comes back to the same question. An unknown value falls back to Activities
 *   rather than erroring (`resolveTab`, under vitest).
 * - **Switching tabs REPLACES the history entry.** A tab is a question about the
 *   member already on screen, not a place — pushing would put three entries
 *   between the agent and the field they came from, and 227 #3 promised browser
 *   Back from a member lands on the field.
 *
 * 🚩 **Profile is the exception to the fetch-when-opened rule, and it is not an
 * exception to anything else.** It draws the member the route already resolved
 * and the authority the page's own guard already read off the area's ONE probe —
 * no read of its own, and 🚩 **no second reader of the probe either**: the
 * authority arrives as a prop rather than as a fourth `useQuery` on the same key,
 * because "one call" would then depend on three separate sites agreeing about
 * `staleTime` (ticket 302).
 *
 * The strip carries no counts. Only Actions has a real total, and a count on a
 * capped tab would be the completeness lie the captions exist to prevent (227 #7);
 * Actions' own total therefore lives in its caption row, with its pager.
 */
export default function MemberTabs({
  member,
  authority,
}: {
  member: LoyMember
  authority: MemberAuthority
}) {
  const { t } = useTranslation('loy')
  const [searchParams, setSearchParams] = useSearchParams()
  const open = resolveTab(searchParams.get('tab'))
  const loyId = member.loyId

  const select = (tab: MemberTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <div
        role="tablist"
        aria-label={t('tabs.ariaLabel')}
        className="flex gap-1 overflow-x-auto border-b border-border/60 px-3"
      >
        {MEMBER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`loy-tab-${tab}`}
            aria-selected={open === tab}
            aria-controls={TAB_PANEL_ID}
            onClick={() => select(tab)}
            className={
              'border-b-2 px-3 py-2 text-sm transition-colors ' +
              (open === tab
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t(`tabs.label.${tab}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={TAB_PANEL_ID} aria-labelledby={`loy-tab-${open}`} className="p-3">
        {/* Mount-when-open IS the lazy fetch, and it is also how each tab's page
            state is scoped: Actions' page number lives inside the panel, so
            leaving the tab and coming back reopens at page 1 rather than at a
            page an agent no longer remembers choosing. */}
        {open === 'profile' ? (
          <ProfileTab member={member} authority={authority} />
        ) : open === 'activities' ? (
          <ActivitiesTab loyId={loyId} />
        ) : open === 'sales' ? (
          <SalesTab loyId={loyId} />
        ) : (
          <ActionsTab loyId={loyId} />
        )}
      </div>
    </div>
  )
}

/** One panel element, reused by every tab — the strip swaps its contents rather
 *  than its identity, which is what `aria-controls` above names. */
const TAB_PANEL_ID = 'loy-tab-panel'
