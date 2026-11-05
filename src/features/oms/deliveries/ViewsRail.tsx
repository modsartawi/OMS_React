import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Ban, CalendarClock, Layers, PackageX, TriangleAlert, Zap, type LucideIcon } from 'lucide-react'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { CursorBar, RAIL_FOCUS, RAIL_HEADING } from '@/core/list/rail'
import { LENS_IDS, type CountWording, type LensId } from './lenses'

/** One icon per lens: the rail's rows and the palette's "Show: ‹lens›" rows share them. */
export const LENS_ICON: Record<LensId, LucideIcon> = {
  all: Layers,
  attention: TriangleAlert,
  cancelRequested: Ban,
  dawaaNow: Zap,
  rescheduled: CalendarClock,
}

/** The LF returns queue's icon (764): its rail row and its palette row share it. */
export const LF_RETURNS_ICON: LucideIcon = PackageX

/** A count's wording, "—", "12" or "12+", as one string for the caller to isolate once. */
export function lensCountText(t: TFunction<'deliveries'>, count: CountWording): string {
  return count.key === 'none' ? t('lens.count.none') : t(`lens.count.${count.key}`, { count: count.count })
}

/**
 * The Deliveries list's views rail (ticket 398, spec 380 L7; ruling 368 §1): 220px at the
 * screen's inline-start edge, on `--card-2` with an inline-end border.
 *
 * Its first section is the **Lenses**: an icon, a label and the count in mono, each count one
 * value isolated once ("200+"). Each lens is a toggle Chip (594); the pressed one takes the
 * Chip on look (`--primary-050` ground, primary border) and a 3px
 * `--cursor` bar on its inline-start edge, the grid's selected-row pair. Needs attention's
 * count turns danger while it is above 0. The operator's saved views (**My views**, 400) follow
 * as `children`, with + Save current view at the rail's foot.
 *
 * Between them, for a session holding `LocalFulfillmentReturn,03` (ticket 764), a **Queues**
 * section with "LF returns needing action". It is NOT a lens: a lens narrows the loaded rows, and
 * this queue is its own server read, shown in its own grid in place of the results. While it is on,
 * no lens row is pressed; picking a lens leaves it. Its count is the queue's last answer, "—" until
 * one has come back.
 */
export default function ViewsRail({
  lens,
  counts,
  onLens,
  queue = null,
  className = '',
  children,
}: {
  lens: LensId
  counts: Record<LensId, CountWording>
  onLens: (lens: LensId) => void
  /** The LF returns queue's row; `null` (no 03) draws no Queues section at all. */
  queue?: { active: boolean; count: CountWording; onOpen: () => void } | null
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
      <ul aria-labelledby="deliveries-lenses" className="flex flex-col gap-1">
        {LENS_IDS.map((id) => (
          <li key={id}>
            <LensRow id={id} active={!queue?.active && lens === id} count={counts[id]} onClick={() => onLens(id)} />
          </li>
        ))}
      </ul>
      {queue && <QueueSection {...queue} />}
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
    // A lens is a Chip (594): pressed while it is the active lens. `aria-current` stays beside
    // `aria-pressed`, naming the one lens the grid is narrowed by.
    <Chip
      on={active}
      aria-current={active ? 'true' : undefined}
      data-lens={id}
      onClick={onClick}
      className={'relative w-full gap-2 ps-2.5 pe-2 text-start ' + RAIL_FOCUS}
    >
      {active && <CursorBar edge="-start-px" />}
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{t(`lens.name.${id}`)}</span>
      <span
        data-lens-count=""
        className={'font-mono text-[11px] ' + (alarm ? 'font-semibold text-danger-800' : 'text-muted-foreground')}
      >
        <Ltr>{lensCountText(t, count)}</Ltr>
      </span>
    </Chip>
  )
}

/** The Queues section (764): one row, the LF returns needing action. */
function QueueSection({ active, count, onOpen }: { active: boolean; count: CountWording; onOpen: () => void }) {
  const { t } = useTranslation('deliveries')
  const Icon = LF_RETURNS_ICON
  return (
    <>
      <h2 id="deliveries-queues" title={t('lfReturns.hint')} className={RAIL_HEADING + ' mt-3'}>
        {t('lfReturns.heading')}
      </h2>
      <ul aria-labelledby="deliveries-queues" className="flex flex-col gap-1">
        <li>
          <Chip
            on={active}
            aria-current={active ? 'true' : undefined}
            data-queue="lfReturns"
            title={t('lfReturns.hint')}
            onClick={onOpen}
            className={'relative w-full gap-2 ps-2.5 pe-2 text-start ' + RAIL_FOCUS}
          >
            {active && <CursorBar edge="-start-px" />}
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{t('lfReturns.name')}</span>
            <span data-queue-count="" className="font-mono text-[11px] text-muted-foreground">
              <Ltr>{lensCountText(t, count)}</Ltr>
            </span>
          </Chip>
        </li>
      </ul>
    </>
  )
}
