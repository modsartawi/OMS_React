import { Pin } from 'lucide-react'
import type { AdvisePin, AdviseShipment, DeliveryMode, PlanGoal } from '@/core/models/sourcing-run'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatMoney3 } from '@/core/util/number-format'
import type { PinsCost } from './pins-model'
import { usePlanWords } from './use-plan-words'

/** What a plan card is handed to pin from it (ticket 963). Absent, the card shows no pin buttons. */
export interface PlanPinning {
  /** Whether the pin is set (its button shows pressed). */
  pressed: (pin: AdvisePin) => boolean
  /** Sets the pin, or takes it off when it is set (review 4354 #10). */
  onPin: (pin: AdvisePin) => void
  /** Per goal, what the pins cost it; empty when the run had no pins. */
  cost: Partial<Record<PlanGoal, PinsCost>>
}

/**
 * The pin buttons on one shipment (ticket 963, spec 4354 story 20; the prototype's `shipHtml`): "never this store" for
 * the shipment, and per line "pin store" and "pin mode". A pin already set shows pressed; pressed again, it comes off.
 * Nothing runs: Run plans again.
 */
export function ShipmentPins({ s, pinning }: { s: AdviseShipment; pinning: PlanPinning }) {
  const w = usePlanWords()
  const { t } = w
  const never: AdvisePin = { kind: 'NOT_STORE', store: s.store }
  return (
    <div className="flex flex-col gap-1 border-t border-border/70 pt-1.5" data-shipment-pins="">
      <Button
        variant="link"
        className="self-start"
        aria-pressed={pinning.pressed(never)}
        onClick={() => pinning.onPin(never)}
        data-pin-never-store={s.store}
      >
        {t('pins.plan.neverStore')}
      </Button>
      <ul className="flex flex-col gap-0.5">
        {s.lines.map((lineNo) => {
          const store: AdvisePin = { kind: 'LINE_STORE', lineNo, store: s.store }
          const mode: AdvisePin = { kind: 'LINE_MODE', lineNo, mode: s.mode as DeliveryMode }
          return (
            <li key={lineNo} className="flex flex-wrap items-center gap-x-2" data-shipment-line={lineNo}>
              <span className="text-muted-foreground">{t('pins.plan.line', { line: fsi(lineNo) })}</span>
              <Button variant="link" aria-pressed={pinning.pressed(store)} onClick={() => pinning.onPin(store)} data-pin-line-store={lineNo}>
                <Pin className="size-3" aria-hidden />
                {t('pins.plan.pinStore')}
              </Button>
              <Button variant="link" aria-pressed={pinning.pressed(mode)} onClick={() => pinning.onPin(mode)} data-pin-line-mode={lineNo}>
                <Pin className="size-3" aria-hidden />
                {t('pins.plan.pinMode')}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const signed = (n: number, text: string) => (n > 0 ? `+${text}` : text)

/**
 * What the pins cost one plan (ticket 963, spec 4354 story 21): minutes, the customer's fee, the company's cost and
 * deliveries, against the same goal of the run without pins. Each figure its own isolate; nothing summed here.
 */
export function PinsCostLine({ cost, titled = true }: { cost: PinsCost | undefined; titled?: boolean }) {
  const w = usePlanWords()
  const { t } = w
  if (!cost) return null
  if (cost.kind !== 'cost')
    return (
      <p className="text-xs text-muted-foreground" data-pins-cost={cost.kind}>
        {t(`pins.cost.${cost.kind}`)}
      </p>
    )
  const parts = [
    { key: 'minutes', label: t('pins.cost.minutes'), value: t('pins.cost.minutesValue', { n: signed(cost.minutes, String(cost.minutes)) }) },
    { key: 'fee', label: t('measure.fee'), value: t('money', { amount: signed(cost.fee, formatMoney3(cost.fee)) }) },
    { key: 'companyCost', label: t('measure.companyCost'), value: t('money', { amount: signed(cost.companyCost, formatMoney3(cost.companyCost)) }) },
    { key: 'deliveries', label: t('measure.deliveries'), value: signed(cost.deliveries, String(cost.deliveries)) },
  ]
  return (
    <div className="flex flex-col gap-0.5 text-xs" data-pins-cost="cost">
      {titled && <span className="font-semibold text-muted-foreground">{t('pins.cost.title')}</span>}
      <dl className="flex flex-wrap gap-x-3 gap-y-0.5">
        {parts.map((p) => (
          <div key={p.key} className="flex gap-1" data-pins-cost-part={p.key}>
            <dt className="text-muted-foreground">{p.label}</dt>
            <dd className="tabular-nums">
              <Ltr>{p.value}</Ltr>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
