import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Ban, CalendarClock, Layers, TriangleAlert, Zap, type LucideIcon } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { LENS_IDS, type CountWording, type LensId } from './lenses'

/** One icon per lens: the rail's rows and the palette's "Show: ‹lens›" rows share them. */
export const LENS_ICON: Record<LensId, LucideIcon> = {
  all: Layers,
  attention: TriangleAlert,
  cancelRequested: Ban,
  dawaaNow: Zap,
  rescheduled: CalendarClock,
}

/** The rail's section heading: small caps in secondary ink (Lenses, My views). */
export const RAIL_HEADING =
  'px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

/** A rail row's focus ring, drawn inside the row so the rail's edge never clips it. */
export const RAIL_FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring'

/** A rail row's tone: the active row takes the grid's selected-row ground, the rest go quiet. */
export const railRowTone = (active: boolean) =>
  active ? 'bg-primary-050 font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'

/** The active row's 3px `--cursor` bar on its inline-start edge — the pair `railRowTone` grounds. */
export function CursorBar() {
  return <span className="absolute inset-y-1 start-0 w-[3px] rounded-full bg-cursor" aria-hidden />
}

/** A count's wording, "—", "12" or "12+", as one string for the caller to isolate once. */
export function lensCountText(t: TFunction<'deliveries'>, count: CountWording): string {
  return count.key === 'none' ? t('lens.count.none') : t(`lens.count.${count.key}`, { count: count.count })
}

/**
 * The Deliveries list's views rail (ticket 398, spec 380 L7; ruling 368 §1): 220px at the
 * screen's inline-start edge, on `--card-2` with an inline-end border.
 *
 * Its first section is the **Lenses**: an icon, a label and the count in mono, each count one
 * value isolated once ("200+"). The active row takes the `--primary-050` ground and a 3px
 * `--cursor` bar on its inline-start edge, the grid's selected-row pair. Needs attention's
 * count turns danger while it is above 0. The operator's saved views (**My views**, 400) follow
 * as `children`, with + Save current view at the rail's foot.
 */
export default function ViewsRail({
  lens,
  counts,
  onLens,
  className = '',
  children,
}: {
  lens: LensId
  counts: Record<LensId, CountWording>
  onLens: (lens: LensId) => void
  className?: string
  children?: ReactNode
}) {
  const { t } = useTranslation('deliveries')
  return (
    <nav
      aria-label={t('lens.region')}
      data-views-rail=""
      className={'flex w-[220px] shrink-0 flex-col gap-px border-e border-border bg-card-2 p-2 ' + className}
    >
      <h2
        id="deliveries-lenses"
        title={t('lens.hint')}
        className={RAIL_HEADING}
      >
        {t('lens.heading')}
      </h2>
      <ul aria-labelledby="deliveries-lenses" className="flex flex-col gap-px">
        {LENS_IDS.map((id) => (
          <li key={id}>
            <LensRow id={id} active={lens === id} count={counts[id]} onClick={() => onLens(id)} />
          </li>
        ))}
      </ul>
      {children}
    </nav>
  )
}

function LensRow({
  id,
  active,
  count,
  onClick,
}: {
  id: LensId
  active: boolean
  count: CountWording
  onClick: () => void
}) {
  const { t } = useTranslation('deliveries')
  const Icon = LENS_ICON[id]
  const alarm = id === 'attention' && count.key !== 'none' && count.count > 0
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      data-lens={id}
      onClick={onClick}
      className={
        'relative flex h-7 w-full items-center gap-2 rounded-md ps-2.5 pe-2 text-start text-xs ' +
        RAIL_FOCUS +
        ' ' +
        railRowTone(active)
      }
    >
      {active && <CursorBar />}
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{t(`lens.name.${id}`)}</span>
      <span
        data-lens-count=""
        className={'font-mono text-[11px] ' + (alarm ? 'font-semibold text-danger-800' : 'text-muted-foreground')}
      >
        <Ltr>{lensCountText(t, count)}</Ltr>
      </span>
    </button>
  )
}
