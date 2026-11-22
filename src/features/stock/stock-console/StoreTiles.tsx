import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import type { Severity } from '@/core/ui/severity'
import { formatFigure } from '@/core/util/number-format'
import { STORE_TILES, type StoreTile } from './stores'

/** A tile's accent: the severity of the kind of store it picks, as a top border, from the app tokens. */
const TILE_SEV: Record<StoreTile, Severity> = {
  all: 'mute',
  counted: 'go',
  oldHold: 'warn',
  sapQuiet: 'warn',
  belowZero: 'bad',
}

const TILE_ACCENT: Record<Severity, string> = {
  ok: 'border-t-success',
  go: 'border-t-primary',
  warn: 'border-t-attention',
  bad: 'border-t-danger',
  mute: 'border-t-border',
}

/**
 * The Stores tiles (oms 940, spec 4157 story 7): each counts its stores and, pressed, filters the list to them. One at a
 * time; pressing the one that is on goes back to All. Counts are blank until the list arrives, so the tiles do not reflow.
 */
export default function StoreTiles({
  counts,
  on,
  onPick,
}: {
  counts: Record<StoreTile, number> | undefined
  on: StoreTile
  onPick: (tile: StoreTile) => void
}) {
  const { t } = useTranslation('stock-console')
  return (
    <section aria-label={t('tiles.label')} data-tiles="">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
        {STORE_TILES.map((tile) => (
          // Hand-written (baseline-allowlisted): the sync console's tile picker, copied.
          <button
            key={tile}
            type="button"
            onClick={() => onPick(tile === on && tile !== 'all' ? 'all' : tile)}
            aria-pressed={tile === on}
            data-tile={tile}
            className={
              'flex flex-col items-start gap-0.5 rounded-lg border border-t-4 border-border px-3 py-2 text-start transition-colors hover:bg-accent ' +
              TILE_ACCENT[TILE_SEV[tile]] +
              (tile === on ? ' bg-muted ring-2 ring-primary/60' : ' bg-card')
            }
          >
            <span className="font-mono text-xl font-medium tabular-nums">
              <Ltr>{counts ? formatFigure(counts[tile]) : ''}</Ltr>
            </span>
            <span className="text-xs text-muted-foreground">{t(`tiles.${tile}`)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
