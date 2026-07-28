/* PROTOTYPE — throwaway. Ticket 175, variant 3.
 *
 * THE CLAIM: the console already has the right idea — extend it rather than
 * replace it. 135's chip row IS the header; it just needs two more chips
 * (fulfilment, payment) and a way to OPEN. Each chip toggles a focused panel
 * directly beneath the row, and in the opening state the chips read as the
 * sequence themselves: ordered, unmet ones on attention ground, the first unmet
 * one already open. Settled sections cost one chip of vertical space, forever.
 *
 * WHERE IT COSTS: the chips must carry their own state legibly at 12px, and an
 * agent who never clicks a chip never learns the section exists — discoverability
 * is bought entirely by the attention ground. It is also the only variant where
 * the capture surface COVERS part of the basket while it is open.
 *
 * Nearest real-world kin: filter/summary bars in modern SaaS consoles, and this
 * repo's own built console (`header-chips.ts`), which is where the shape came from.
 */
import { FulfilmentChoice, PaymentChoice, SlotPicker, SourceCapture, StorePicker } from './header-parts'
import type { HeaderState, OpenSurface } from './header-mock'

export const NAME = '3 · Chip bar + panel'

type ChipDef = { id: OpenSurface; label: string; value: string | null; note?: string; blocked: boolean; hidden?: boolean }

export default function Variant3Chips({ s, storeShape }: { s: HeaderState; storeShape: 'grouped' | 'palette' | 'drill' }) {
  const chosen = s.plant.source !== 'seededAtOpen'
  const delivery = s.mode === 'Delivery'
  const blocked = new Set(s.submitBlockers)

  const chips: ChipDef[] = [
    { id: 'fulfilment', label: 'Fulfilment', value: delivery ? 'Delivery' : 'Collection', blocked: false },
    {
      id: 'where',
      label: 'Store',
      value: `${s.plant.name} (${s.plant.code})`,
      // 175: the chip SHOWS the store and still says it needs attention. Hollowing
      // it out would read as "no store", which is the one thing that is not true —
      // the engine bound one at open and every price depends on it.
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
          const isOpen = s.open === c.id
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
                isOpen ? 'ring-2 ring-primary-border' : ''
              }`}
            >
              <span className="opacity-60">{c.label}</span>
              <span className="font-medium">{c.value ?? 'not set'}</span>
              {c.note && <span className="opacity-70">({c.note})</span>}
            </button>
          )
        })}

        {!s.canAddItem && (
          <span className="ms-auto text-[11px] font-medium text-attention-800">
            {!s.customer ? 'Start with the caller on the left' : 'Choose the store to start adding items'}
          </span>
        )}
      </div>

      {open && (
        <div className="border-t border-divider bg-card px-4 py-3">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">{TITLES[open.id]}</h3>
            <button type="button" className="text-xs text-muted-foreground hover:underline">
              Close
            </button>
          </div>
          {open.id === 'fulfilment' && <FulfilmentChoice mode={s.mode} />}
          {open.id === 'where' && <StorePicker shape={storeShape} seeded="1001" chosen={chosen ? s.plant.code : undefined} />}
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
      )}
    </div>
  )
}

const TITLES: Record<string, string> = {
  fulfilment: 'Delivering, or collecting?',
  where: 'Which store are they collecting from?',
  when: 'When do they want it?',
  reference: 'Where did this order come from?',
  payment: 'How are they paying?',
}
