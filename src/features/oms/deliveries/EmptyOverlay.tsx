import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'

/**
 * Why the grid shows no rows (spec 380 L10; ruling 368 §1):
 * - `before` — no search has run yet;
 * - `none` — the search came back with no rows;
 * - `lens` — rows came back, but none match the active lens (398).
 */
export type EmptyKind = 'before' | 'none' | 'lens'

/**
 * The grid's empty state, drawn OVER the still-mounted grid (ticket 401): layout restore, a
 * saved view's columns and J/K all need the grid's API before there are rows to show.
 */
export default function EmptyOverlay({ kind }: { kind: EmptyKind }) {
  const { t } = useTranslation('deliveries')
  return (
    // Under the header and the floating filters, which stay usable.
    <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center px-4" data-grid-empty={kind}>
      {kind === 'before' ? (
        <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
          <Search className="size-5" aria-hidden />
          <p className="font-semibold text-foreground">{t('empty.before.title')}</p>
          <p>{t('empty.before.hint')}</p>
        </div>
      ) : (
        <p
          className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
          // The lens's own empty state keeps the hook 398's drive reads.
          data-lens-empty={kind === 'lens' ? '' : undefined}
        >
          {t(kind === 'lens' ? 'lens.empty' : 'empty.none')}
        </p>
      )}
    </div>
  )
}
