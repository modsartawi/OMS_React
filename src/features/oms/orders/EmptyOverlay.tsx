import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'

/** Why the grid shows no rows: no search yet · the search found none · none in this lens. */
export type EmptyKind = 'before' | 'none' | 'lens'

/** The grid's empty state, drawn OVER the still-mounted grid (its API is needed before rows). */
export default function EmptyOverlay({ kind }: { kind: EmptyKind }) {
  const { t } = useTranslation('orders')
  return (
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
          data-lens-empty={kind === 'lens' ? '' : undefined}
        >
          {t(kind === 'lens' ? 'lens.empty' : 'empty.none')}
        </p>
      )}
    </div>
  )
}
