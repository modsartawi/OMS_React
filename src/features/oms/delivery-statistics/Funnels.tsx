import { Trans, useTranslation } from 'react-i18next'
import ShareBar from '@/core/charts/ShareBar'
import { CHART_INK, slotColour } from '@/core/charts/slots'
import StageBar from '@/core/charts/StageBar'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { Lane, SlotSegmentId, SlotSplit } from './lanes'
import Tile from './Tile'

/** The slot split's colours: two series slots and the ink grey for No slot — never a status colour. */
const SLOT_COLOUR: Record<SlotSegmentId, string> = {
  inSlot: slotColour(0),
  outOfSlot: slotColour(2),
  noSlot: CHART_INK.other,
}

/**
 * The Delivery and Pick-up funnels (ticket 814, spec 811), side by side from `lg` and stacked below
 * it. Draws exactly the lanes it is given, in order: the page omits the Pick-up lane under a chosen
 * courier (813) by passing the Delivery lane alone, which then takes the full width.
 */
export default function Funnels({ lanes }: { lanes: Lane[] }) {
  return (
    <div className={`grid gap-4 ${lanes.length > 1 ? 'lg:grid-cols-2' : ''}`} data-statistics-funnels="">
      {lanes.map((lane) => (
        <Funnel key={lane.track} lane={lane} />
      ))}
    </div>
  )
}

/**
 * One track's funnel: its stages top to bottom, each with its figure as text (isolated) and a bar of
 * its share of the lane's Came in (geometry from `lanes.ts`, none for an absent figure); the Delivery
 * funnel then its slot split; then the lane's Avg delivery time, set apart — it is not one more stage.
 */
function Funnel({ lane }: { lane: Lane }) {
  const { t } = useTranslation('delivery-statistics')
  const { track } = lane
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      data-statistics-band={track}
      aria-labelledby={`statistics-lane-${track}`}
    >
      <h2 id={`statistics-lane-${track}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t(`lane.${track}`)}
      </h2>
      <ol className="flex flex-col gap-3" data-statistics-stages="">
        {lane.stages.map((stage) => {
          const id = `${track}.${stage.id}`
          return (
            <li key={stage.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1" data-figure-tile={id}>
              <span className="text-sm font-medium text-muted-foreground">{t(`flow.${stage.id}`)}</span>
              <span className="text-xl font-semibold tracking-tight tabular-nums" data-figure={id}>
                <Ltr>{stage.value}</Ltr>
              </span>
              {stage.trips !== undefined && (
                <span className="col-span-2 text-xs text-muted-foreground" data-figure={`${track}.trips`}>
                  <Trans t={t} i18nKey="flow.trips" values={{ n: stage.trips }} components={{ v: <Ltr /> }} />
                </span>
              )}
              <div className="col-span-2">
                <StageBar fraction={stage.bar} />
              </div>
            </li>
          )
        })}
      </ol>
      {lane.slot && <SlotSplitBand slot={lane.slot} />}
      <div className="border-t border-border/60 pt-3" data-statistics-lane-average="">
        <Tile
          id={`${track}.avg`}
          caption={t(`lane.avg.${track}`)}
          value={lane.average.value}
          unit={lane.average.hasUnit ? t('avgHandOver.unit') : undefined}
          accent="border-t-primary"
        >
          <span className="text-xs text-muted-foreground">{t(`lane.avgNote.${track}`)}</span>
        </Tile>
      </div>
    </section>
  )
}

/**
 * The Delivery funnel's slot split: one bar of In slot | Out of slot | No slot, its segments the
 * server's counts, and a key under it with each count and the server's share as text. With nothing to
 * draw (nothing delivered, or no slot figures) the bar is the dash.
 */
function SlotSplitBand({ slot }: { slot: SlotSplit }) {
  const { t } = useTranslation('delivery-statistics')
  const label = t('slot.label', {
    parts: slot.segments.map((s) => t(`slot.part`, { caption: t(`slot.${s.id}`), n: fsi(s.value) })).join(t('slot.joiner')),
  })
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3" data-statistics-slot={slot.drawn ? 'drawn' : 'none'}>
      <h3 className="text-xs font-medium text-muted-foreground">{t('slot.heading')}</h3>
      {slot.drawn ? (
        <ShareBar label={label} segments={slot.segments.map((s) => ({ id: s.id, weight: s.count ?? 0, colour: SLOT_COLOUR[s.id] }))} />
      ) : (
        <span className="text-sm text-muted-foreground" data-slot-bar="none">
          <Ltr>{t('dash')}</Ltr>
        </span>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {slot.segments.map((s) => (
          <li key={s.id} className="inline-flex items-baseline gap-1.5" data-slot-key={s.id}>
            <span className="inline-block size-2.5 shrink-0 self-center rounded-sm" style={{ background: SLOT_COLOUR[s.id] }} aria-hidden />
            <span className="text-muted-foreground">{t(`slot.${s.id}`)}</span>
            <span className="font-semibold tabular-nums" data-figure={`delivery.slot.${s.id}`}>
              <Ltr>{s.value}</Ltr>
            </span>
            {s.share !== null && (
              <span className="text-xs text-muted-foreground tabular-nums" data-figure={`delivery.slot.${s.id}Share`}>
                <Ltr>{s.share}</Ltr>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
