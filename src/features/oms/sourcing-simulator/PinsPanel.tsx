import { X } from 'lucide-react'
import { DELIVERY_MODES, type AdvisePin, type DeliveryMode } from '@/core/models/sourcing-run'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { hasPin, type PinChip } from './pins-model'
import Toggle from './Toggle'
import { usePinWords } from './use-pin-words'

const ONE: AdvisePin = { kind: 'ONE_SHIPMENT' }

/**
 * The pins (ticket 963, spec 4354 §3 and §19; the prototype's `cPins`): the pins as chips — a refused pin stays listed
 * with its reason, the code and the rule behind it — "never this store", "never this mode" and "everything in one
 * shipment". Line pins are set from a plan's shipments. Nothing runs on a change: Run plans again.
 */
export default function PinsPanel({
  pins,
  chips,
  stores,
  onAdd,
  onRemove,
}: {
  pins: readonly AdvisePin[]
  chips: readonly PinChip[]
  /** The stores the last run showed; none before a run. */
  stores: readonly string[]
  onAdd: (pin: AdvisePin) => void
  onRemove: (pin: AdvisePin) => void
}) {
  const w = usePinWords()
  const { t } = w
  const one = hasPin(pins, ONE)
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-pins="">
      <h2 className="text-sm font-semibold">{t('pins.title')}</h2>
      {chips.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-pins-none="">
          {t('pins.none')}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" data-pins-chips="">
          {chips.map((c) => (
            <li
              key={c.key}
              className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
                c.refusal ? 'border-attention-border bg-attention-050 text-attention-800' : 'border-border bg-muted'
              }`}
              data-pin-chip={c.key}
              data-pin-refused={c.refusal?.code ?? undefined}
            >
              <span>{w.label(c.pin)}</span>
              {c.refusal && (
                <span className="flex flex-wrap items-center gap-1" data-pin-reason="">
                  <span>{w.reason(c.refusal)}</span>
                  {c.refusal.stepCode && (
                    <code className="font-mono text-[11px]">
                      <Ltr>{c.refusal.stepCode}</Ltr>
                    </code>
                  )}
                  {c.refusal.rule && <bdi data-pin-rule="">{c.refusal.rule}</bdi>}
                  <code className="font-mono text-[11px]">
                    <Ltr>{c.refusal.code}</Ltr>
                  </code>
                </span>
              )}
              <IconButton size="compact" label={t('pins.remove', { pin: w.label(c.pin) })} onClick={() => onRemove(c.pin)} data-pin-remove={c.key}>
                <X className="size-3" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Select
          className="w-full"
          aria-label={t('pins.neverStore')}
          value=""
          disabled={stores.length === 0}
          onChange={(e) => e.target.value && onAdd({ kind: 'NOT_STORE', store: e.target.value })}
          data-pins-never-store=""
        >
          <option value="">{t('pins.neverStorePick')}</option>
          {stores.map((s) => (
            <option key={s} value={s} disabled={hasPin(pins, { kind: 'NOT_STORE', store: s })}>
              {fsi(s)}
            </option>
          ))}
        </Select>
        <Select
          className="w-full"
          aria-label={t('pins.neverMode')}
          value=""
          onChange={(e) => e.target.value && onAdd({ kind: 'NOT_MODE', mode: e.target.value as DeliveryMode })}
          data-pins-never-mode=""
        >
          <option value="">{t('pins.neverModePick')}</option>
          {DELIVERY_MODES.map((m) => (
            <option key={m} value={m} disabled={hasPin(pins, { kind: 'NOT_MODE', mode: m })}>
              {t(`mode.${m}`)}
            </option>
          ))}
        </Select>
      </div>
      <Toggle checked={one} onChange={(on) => (on ? onAdd(ONE) : onRemove(ONE))} label={t('pins.oneShipment')} data-pins-one-shipment="" />
      {pins.length > 0 && <p className="text-xs text-muted-foreground">{t('pins.note')}</p>}
    </section>
  )
}
