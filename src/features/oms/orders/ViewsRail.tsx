import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Cpu, HeartPulse, Layers, PackageOpen, Store, type LucideIcon } from 'lucide-react'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { LENS_IDS, type CountWording, type LensId } from './lenses'

/** One icon per lens: the rail's rows and the palette's "Show: ‹lens›" rows share them. */
export const LENS_ICON: Record<LensId, LucideIcon> = {
  all: Layers,
  bupaCareConnect: HeartPulse,
  noDelivery: PackageOpen,
  channel: Store,
  engine: Cpu,
}

/** The rail's section heading: small caps in secondary ink (Lenses, My views). */
export const RAIL_HEADING =
  'px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

/** A rail row's focus ring, drawn inside the row so the rail's edge never clips it. */
export const RAIL_FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring'

/** A rail row's tone: the active row takes the grid's selected-row ground, the rest go quiet. */
export const railRowTone = (active: boolean) =>
  active ? 'bg-primary-050 font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'

/** The active row's 3px `--cursor` bar on its inline-start edge. */
export function CursorBar({ edge = 'start-0' }: { edge?: 'start-0' | '-start-px' }) {
  return <span className={'absolute inset-y-1 w-[3px] rounded-full bg-cursor ' + edge} aria-hidden />
}

/** A count's wording, "—", "12" or "12+", as one string for the caller to isolate once. */
export function lensCountText(t: TFunction<'orders'>, count: CountWording): string {
  return count.key === 'none' ? t('lens.count.none') : t(`lens.count.${count.key}`, { count: count.count })
}

/**
 * The Order / ERX list's views rail (the Deliveries rail's shape): the **Lenses** — All, Bupa
 * Care Connect, No delivery yet, Channel money, Engine money — each a toggle Chip with its count
 * isolated once, then the operator's saved views as `children`.
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
  const { t } = useTranslation('orders')
  return (
    <nav
      aria-label={t('lens.region')}
      data-views-rail=""
      className={'flex w-[220px] shrink-0 flex-col gap-px border-e border-border bg-card-2 p-2 ' + className}
    >
      <h2 id="orders-lenses" title={t('lens.hint')} className={RAIL_HEADING}>
        {t('lens.heading')}
      </h2>
      <ul aria-labelledby="orders-lenses" className="flex flex-col gap-1">
        {LENS_IDS.map((id) => {
          const Icon = LENS_ICON[id]
          const active = lens === id
          return (
            <li key={id}>
              <Chip
                on={active}
                aria-current={active ? 'true' : undefined}
                data-lens={id}
                onClick={() => onLens(id)}
                className={'relative w-full gap-2 ps-2.5 pe-2 text-start ' + RAIL_FOCUS}
              >
                {active && <CursorBar edge="-start-px" />}
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{t(`lens.name.${id}`)}</span>
                <span data-lens-count="" className="font-mono text-[11px] text-muted-foreground">
                  <Ltr>{lensCountText(t, counts[id])}</Ltr>
                </span>
              </Chip>
            </li>
          )
        })}
      </ul>
      {children}
    </nav>
  )
}
