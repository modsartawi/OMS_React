import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import ActivitiesTab from './ActivitiesTab'
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
 * The strip carries no counts. Only Actions has a real total, and a count on a
 * capped tab would be the completeness lie the captions exist to prevent (227 #7);
 * Actions' own total therefore lives in its caption row, with its pager.
 */
export default function MemberTabs({ loyId }: { loyId: string }) {
  const { t } = useTranslation('loy')
  const [searchParams, setSearchParams] = useSearchParams()
  const open = resolveTab(searchParams.get('tab'))

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
        {/* Mount-when-open IS the lazy fetch. The two unbuilt panels say so
            plainly rather than drawing an empty grid that would read as "this
            member has nothing" — empty and absent are never conflated on this
            screen, and that holds for a tab that does not exist yet too. */}
        {open === 'activities' ? (
          <ActivitiesTab loyId={loyId} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('tabs.notYet')}</p>
        )}
      </div>
    </div>
  )
}

/** One panel element, reused by every tab — the strip swaps its contents rather
 *  than its identity, which is what `aria-controls` above names. */
const TAB_PANEL_ID = 'loy-tab-panel'
