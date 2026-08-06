import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

/**
 * The recent-search chips under the empty lookup field (ticket 239).
 *
 * 🚩 **The empty state only.** 227 rejected variant C's recents *rail* — ~250 px
 * of chrome down the side of an eight-column grid — and this is not that: one row
 * of chips on `/loy/members`, where there is nothing else on screen, and nothing
 * in a resolved member's identity bar, which 227 spent its argument keeping to
 * SEARCHED · Change · New lookup.
 *
 * 🚩 **A chip carries the typed key and nothing else** — no name, no LoyId. What
 * is stored is one string per chip, so no member data is at rest anywhere and no
 * customer's name is on screen before anyone has searched for them.
 *
 * Clicking runs `onPick`, which is the page's ordinary submit path: the same
 * `resolveMember` cascade, the same miss sentence, the same failure surface. A
 * member archived or renumbered since the chip was made behaves exactly as if the
 * key had been retyped, and this component knows nothing about any of it.
 */
export default function RecentSearches({
  keys,
  onPick,
  disabled,
}: {
  keys: string[]
  onPick: (key: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation('loy')
  if (keys.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" aria-hidden />
        {t('recent.label')}
      </span>
      <ul className="flex flex-wrap items-center gap-1.5" aria-label={t('recent.ariaLabel')}>
        {keys.map((key) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onPick(key)}
              disabled={disabled}
              className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium tabular-nums text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {key}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
