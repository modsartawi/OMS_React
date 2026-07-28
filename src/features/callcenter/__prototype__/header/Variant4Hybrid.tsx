/* PROTOTYPE — throwaway. Ticket 175, variant 4 — THE RECOMMENDATION.
 *
 * v2 and v3 were never rivals. They are the same console in two moods:
 *
 *   v3 is the RESTING state — 8% of the centre column, the basket owns the rest.
 *   v2 is the WORKING state — a section, opened, drawn full width with room to
 *   think, instead of v3's cramped strip.
 *
 * So: v3's chip bar, and what a chip opens is v2's section rather than a
 * squeezed panel. Everything is reachable from the command line (`/store`,
 * `/slot`, `/pay`), which is what makes the chip bar honest — a chip an agent
 * never clicks is a section they never find, and the `/` list is where they
 * find it without lifting their hands.
 *
 * The one thing this variant adds that neither parent had: WHILE THE GATE IS
 * SHUT, the chip bar is not the whole centre. 175 asks for intended sequence,
 * and v3's answer was a chip row over a void. Here the shut gate draws the
 * three steps, and they retire the moment the gate opens — a sequence card that
 * is not permanent furniture, which is the objection to v1's ladder.
 */
import { FulfilmentChoice, PaymentChoice, SlotPicker, SourceCapture, StorePicker } from './header-parts'
import { AddressBook } from './AddressBook'
import type { HeaderState, OpenSurface } from './header-mock'

export const NAME = '4 · Chips + full section (rec.)'

export default function Variant4Hybrid({
  s,
  storeShape,
}: {
  s: HeaderState
  storeShape: 'grouped' | 'palette' | 'drill'
}) {
  const chosen = s.plant.source !== 'seededAtOpen'
  const delivery = s.mode === 'Delivery'
  const blocked = new Set(s.submitBlockers)

  const chips: { id: OpenSurface; label: string; value: string | null; note?: string; blocked: boolean; hidden?: boolean }[] = [
    { id: 'fulfilment', label: 'Fulfilment', value: delivery ? 'Delivery' : 'Collection', blocked: false },
    {
      id: 'where',
      label: 'Store',
      value: `${s.plant.name} (${s.plant.code})`,
      note: chosen ? (delivery ? 'from address' : 'chosen') : 'not chosen yet',
      blocked: blocked.has('STORE_NOT_CHOSEN'),
    },
    {
      id: 'when',
      label: 'Slot',
      value: s.slot ? `${s.slot.day} ${s.slot.from}–${s.slot.to}` : null,
      blocked: blocked.has('MISSING_SLOT'),
      hidden: !delivery,
    },
    {
      id: 'reference',
      label: 'Source',
      value: s.sourceReference ? `${s.documentSource} · ${s.sourceReference}` : null,
      blocked: blocked.has('MISSING_SOURCE_REFERENCE'),
    },
    {
      id: 'payment',
      label: 'Payment',
      value: s.payment ? (s.payment === 'CashOnDelivery' ? 'Cash on delivery' : 'Paid online') : null,
      note: s.paymentForced ? 'locked by source' : undefined,
      blocked: false,
    },
  ]

  const visible = chips.filter((c) => !c.hidden)
  const open = visible.find((c) => c.id === s.open)

  return (
    <div className="shrink-0 border-b border-divider">
      <div className="flex flex-wrap items-center gap-1.5 bg-card-2 px-4 py-2">
        {visible.map((c) => {
          const tone = c.blocked
            ? 'border-attention-border bg-attention-050 text-attention-800'
            : c.value
              ? 'border-border bg-card text-foreground'
              : 'border-dashed border-border-strong bg-card text-muted-foreground'
          return (
            <button
              key={c.id}
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${tone} ${
                s.open === c.id ? 'ring-2 ring-primary-border' : ''
              }`}
            >
              <span className="opacity-60">{c.label}</span>
              <span className="font-medium">{c.value ?? 'not set'}</span>
              {c.note && <span className="opacity-70">({c.note})</span>}
            </button>
          )
        })}
      </div>

      {/* The gate, shut. Three steps, and they RETIRE — this is not furniture. */}
      {!s.canAddItem && !open && (
        <div className="border-t border-divider px-4 py-5">
          <h2 className="mb-3 text-sm font-semibold">This order is ready for its caller.</h2>
          <ol className="space-y-2">
            <Step n={1} done={!!s.customer} label="Take the caller's mobile number" where="in the panel on the left" />
            <Step
              n={2}
              done={chosen}
              label={delivery ? 'Pick their delivery address' : 'Choose the collection store'}
              where={delivery ? 'the store is derived from it' : 'type /store, or use the chip above'}
            />
            <Step n={3} done={false} label="Then add items" where="the search appears once the two above are set" />
          </ol>
        </div>
      )}

      {open && (
        <div className="border-t border-divider bg-card px-4 py-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">{TITLES[open.id]}</h3>
            <button type="button" className="text-xs text-muted-foreground hover:underline">
              Close (esc)
            </button>
          </div>
          {/* v2's section, full width — not v3's strip. */}
          <div className="max-w-3xl">
            {open.id === 'fulfilment' && <FulfilmentChoice mode={s.mode} />}
            {/* 🚩 TWO LISTS, NOT ONE. Delivery opens the ADDRESS GEOGRAPHY
                (the CALLER'S ADDRESS BOOK, city/district only on the add path);
                collection opens the STORE
                ESTATE. Different reads, different models, different populations
                — see `header-mock.ts`. */}
            {open.id === 'where' &&
              (delivery ? (
                <AddressBook />
              ) : (
                <StorePicker shape={storeShape} seeded="1001" chosen={chosen ? s.plant.code : undefined} />
              ))}
            {open.id === 'when' && <SlotPicker chosen={s.slot ? '2026-07-28#S3' : undefined} />}
            {open.id === 'reference' && <SourceCapture s={s} />}
            {open.id === 'payment' && (
              <PaymentChoice
                value={s.payment}
                forced={s.paymentForced}
                reason={s.paymentForced ? 'Pay to enter (P2E) orders are settled before dispatch.' : undefined}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Step({ n, done, label, where }: { n: number; done: boolean; label: string; where: string }) {
  return (
    <li className="flex items-baseline gap-2.5">
      <span
        data-numeric
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done ? 'bg-success-050 text-success-800' : 'bg-muted text-muted-foreground'
        }`}
      >
        {done ? '✓' : n}
      </span>
      <span className={`text-sm ${done ? 'text-muted-foreground line-through' : ''}`}>{label}</span>
      <span className="text-xs text-muted-foreground">— {where}</span>
    </li>
  )
}

const TITLES: Record<string, string> = {
  fulfilment: 'Delivering, or collecting?',
  where: 'Where is it going?',
  when: 'When do they want it?',
  reference: 'Where did this order come from?',
  payment: 'How are they paying?',
}
