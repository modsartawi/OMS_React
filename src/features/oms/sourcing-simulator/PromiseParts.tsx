import type { AdvisePlan, AdviseShipment } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { formatPair, formatRange, fsi } from '@/core/util/bidi'
import { promiseBars, wireClock, type PromiseBarView, type PromisePart } from './promise-bar-model'
import SourcePill from './SourcePill'
import { usePlanWords } from './use-plan-words'

/** Each part's ink: chart slot tokens, so the bar reads in both themes (the palette gate). */
const PART_INK: Record<PromisePart, string> = {
  madeReady: 'bg-chart-3',
  courierWait: 'bg-chart-5',
  travel: 'bg-chart-1',
  margin: 'bg-ink-3',
}

/** A wire time with its day, `yyyy-MM-dd HH:mm`, for a slot that may be tomorrow. */
const dayAndClock = (time: string) => time.slice(0, 16)

const PILL = 'inline-block rounded-full border px-1.5 py-px text-[11px] whitespace-nowrap'
const MUTED_PILL = `${PILL} border-border text-muted-foreground`
const ATTENTION_PILL = `${PILL} border-attention-border bg-attention-050 text-attention-800`

/**
 * The promise in parts (ticket 965, spec 4354 §7): per shipment, the server's promise sentence, then a bar of four parts
 * for Dawaa Now (made ready, courier wait, travel, margin — each with its source), the usual time and the pick end, the
 * lengtheners (marked "adds nothing" where so); a slot shipment's slot, the slots skipped and why, the rule that set its
 * pick end and its next two slots; pick-up's target.
 */
export default function PromiseParts({ plan }: { plan: AdvisePlan }) {
  const bars = promiseBars(plan)
  return (
    <ol className="flex flex-col gap-3" data-why-promise="">
      {bars.map((b) => (
        <ShipmentPromise key={b.no} bar={b} shipment={plan.shipments.find((s) => s.no === b.no)} />
      ))}
    </ol>
  )
}

function ShipmentPromise({ bar, shipment }: { bar: PromiseBarView; shipment: AdviseShipment | undefined }) {
  const w = usePlanWords()
  const { t } = w
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border/70 px-3 py-2 text-xs" data-why-shipment={bar.no} data-why-form={bar.form}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-semibold">
          <Ltr>{bar.no}</Ltr>
        </span>
        <span className={MUTED_PILL}>{w.mode(bar.mode)}</span>
        <span className="font-mono">
          <Ltr>{formatPair(bar.store, bar.storeName)}</Ltr>
        </span>
        {bar.straightLine && (
          <span className={ATTENTION_PILL} data-why-straight-line="">
            {t('why.promise.straightLine')}
          </span>
        )}
      </div>
      {shipment && <bdi className="font-medium">{w.said(shipment.promise)}</bdi>}

      {!bar.hasParts && <p className="text-muted-foreground">{t('why.promise.noParts')}</p>}

      {bar.form === 'bar' && bar.segments.length > 0 && (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-sm" role="img" aria-label={t('why.promise.barLabel')} data-why-bar="">
            {bar.segments.map((s) => (
              <span key={s.part} className={PART_INK[s.part]} style={{ width: `${(s.share * 100).toFixed(2)}%` }} data-why-segment={s.part} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {bar.segments.map((s) => (
              <li key={s.part} className="flex items-center gap-1.5" data-why-part={s.part}>
                <span className={`inline-block size-2.5 rounded-sm ${PART_INK[s.part]}`} aria-hidden />
                <span>{t(`why.promise.part.${s.part}`)}</span>
                <span className="tabular-nums">
                  <span>{t('why.minutes', { n: fsi(s.minutes) })}</span>
                </span>
                <SourcePill source={s.source} />
              </li>
            ))}
          </ul>
        </>
      )}

      {bar.form === 'slot' && bar.slot && (
        <p className="flex flex-wrap items-center gap-1.5" data-why-slot={bar.slot.code}>
          <span className="text-muted-foreground">{t('why.promise.slot')}</span>
          <Ltr>{formatRange(dayAndClock(bar.slot.from), wireClock(bar.slot.to))}</Ltr>
          <SourcePill source={bar.slot.source} />
        </p>
      )}
      {bar.skipped.length > 0 && (
        <ul className="flex flex-col gap-0.5" data-why-skipped="">
          {bar.skipped.map((k) => (
            <li key={k.from} className="flex flex-wrap gap-1.5" data-why-skip={k.why}>
              <span className="text-muted-foreground">{t('why.promise.skipped')}</span>
              <Ltr>{wireClock(k.from)}</Ltr>
              <span>{t(`why.skip.${k.why}`, { defaultValue: t('why.skip.unknown') })}</span>
            </li>
          ))}
        </ul>
      )}

      {bar.form === 'pickUp' && bar.target !== null && (
        <p className="flex flex-wrap gap-1.5" data-why-target="">
          <span className="text-muted-foreground">{t('why.promise.target')}</span>
          <span>{t('why.minutes', { n: fsi(bar.target) })}</span>
        </p>
      )}
      {bar.form !== 'bar' && bar.madeReady && (
        <p className="flex flex-wrap items-center gap-1.5" data-why-made-ready="">
          <span className="text-muted-foreground">{t('why.promise.part.madeReady')}</span>
          <span>{t('why.promise.usual')}</span>
          <span>{t('why.minutes', { n: fsi(bar.madeReady.usual) })}</span>
          <span>{t('why.promise.cautious')}</span>
          <span>{t('why.minutes', { n: fsi(bar.madeReady.cautious) })}</span>
          <SourcePill source={bar.madeReady.source} />
        </p>
      )}
      {bar.form === 'other' && (
        <p>
          <span className={ATTENTION_PILL}>{t('why.promise.assumption')}</span>
        </p>
      )}

      {bar.hasParts && (
        <dl className="flex flex-wrap gap-x-4 gap-y-0.5">
          {bar.usualBy && (
            <div className="flex gap-1" data-why-usual="">
              <dt className="text-muted-foreground">{t('why.promise.usualBy')}</dt>
              <dd>
                <Ltr>{wireClock(bar.usualBy)}</Ltr>
              </dd>
            </div>
          )}
          <div className="flex gap-1" data-why-by="">
            <dt className="text-muted-foreground">{t('why.promise.by')}</dt>
            <dd className="font-medium">
              <Ltr>{wireClock(bar.by)}</Ltr>
            </dd>
          </div>
          {bar.pickEnd && (
            <div className="flex flex-wrap gap-1" data-why-pick-end={bar.pickEndRule ?? ''}>
              <dt className="text-muted-foreground">{t('why.promise.pickEnd')}</dt>
              <dd>
                <Ltr>{wireClock(bar.pickEnd)}</Ltr>
              </dd>
              {bar.pickEndRule && <dd className="text-muted-foreground">{t(`why.pickEndRule.${bar.pickEndRule}`, { defaultValue: bar.pickEndRule })}</dd>}
            </div>
          )}
        </dl>
      )}

      {bar.lengtheners.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-why-lengtheners="">
          <span className="text-muted-foreground">{t('why.promise.lengtheners')}</span>
          {bar.lengtheners.map((l) => (
            <span key={l.name} className="flex flex-wrap items-center gap-1" data-why-lengthener={l.name} data-adds-nothing={l.addsNothing ? 'true' : 'false'}>
              <span>{t(`why.lengthener.${l.name}`, { defaultValue: l.name })}</span>
              {l.value !== null && (
                <span className="text-muted-foreground">
                  <Ltr>{l.value}</Ltr>
                </span>
              )}
              {l.addsNothing ? (
                <span className={MUTED_PILL}>{t('why.promise.addsNothing')}</span>
              ) : (
                <span className="flex gap-1">
                  <span>{t('why.promise.usual')}</span>
                  <span>{t('why.minutes', { n: fsi(`+${l.usual}`) })}</span>
                  <span>{t('why.promise.cautious')}</span>
                  <span>{t('why.minutes', { n: fsi(`+${l.cautious}`) })}</span>
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {bar.next.length > 0 && (
        <div className="flex flex-col gap-0.5" data-why-next-slots="">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">{t('why.promise.nextSlots')}</span>
            {bar.laterCheaper && (
              <span className={ATTENTION_PILL} data-why-later-cheaper="">
                {t('why.promise.laterCheaper')}
              </span>
            )}
          </span>
          <ul className="flex flex-col gap-0.5">
            {bar.next.map((n) => (
              <li key={n.code} className="flex flex-wrap gap-2" data-why-next-slot={n.code}>
                <Ltr>{formatRange(dayAndClock(n.from), wireClock(n.to))}</Ltr>
                <span className="text-muted-foreground">{t('why.promise.slotSum')}</span>
                <span className="tabular-nums">
                  <Ltr>{w.money(n.sum)}</Ltr>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
