/* PROTOTYPE — throwaway. Ticket 175, variant 2.
 *
 * THE CLAIM: the header is a FORM, and a call does not run in order. Everything
 * sits in one always-visible "Order details" card above the basket, laid out in
 * two columns; whatever is missing carries attention ground, and the agent fills
 * it in whatever order the caller volunteers it. Once nothing is missing the
 * whole card collapses to a single chip line and gives the space to the basket.
 *
 * WHERE IT COSTS: the most furniture of the three, and it is furniture the agent
 * stares at all day. The gate has to be STATED ("items unlock once…") because the
 * layout does not imply an order — nothing about a form says which field is next.
 *
 * Nearest real-world kin: CC2's own Logistics group, and NetSuite / SAP CRM order
 * entry — the shape an agent migrating off WPF already knows.
 */
import { FulfilmentChoice, PaymentChoice, SlotPicker, SourceCapture, StorePicker } from './header-parts'
import type { HeaderState } from './header-mock'

export const NAME = '2 · Order details panel'

export default function Variant2Panel({ s, storeShape }: { s: HeaderState; storeShape: 'grouped' | 'palette' | 'drill' }) {
  const chosen = s.plant.source !== 'seededAtOpen'
  const delivery = s.mode === 'Delivery'
  const complete = s.submitBlockers.filter((b) => b !== 'NO_LINES').length === 0

  // Progressive collapse, at CARD granularity rather than per field: a complete
  // header is one line, and the basket takes the rest.
  if (complete) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-divider bg-card-2 px-4 py-2">
        <span className="me-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Order</span>
        <Pill label={delivery ? 'Delivery' : 'Collection'} />
        <Pill label={`${s.plant.name} (${s.plant.code})`} note={delivery ? 'from address' : 'chosen'} />
        {s.slot && <Pill label={`${s.slot.day} ${s.slot.from}–${s.slot.to}`} />}
        <Pill label={`${s.documentSource} · ${s.sourceReference}`} />
        <Pill label={s.payment === 'CashOnDelivery' ? 'Cash on delivery' : 'Paid online'} />
        <button type="button" className="ms-auto text-xs text-primary-800 hover:underline">
          Edit order details
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-b border-divider bg-card-2 px-4 py-3">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Order details</h2>
        <span className={`text-xs ${s.canAddItem ? 'text-success-800' : 'text-attention-800'}`}>
          {s.canAddItem ? 'Items can be added' : 'Items unlock once the caller and the store are set'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Cell title="Fulfilment" filled>
          <FulfilmentChoice mode={s.mode} />
        </Cell>

        <Cell title="Payment" filled={!!s.payment}>
          <PaymentChoice
            value={s.payment}
            forced={s.paymentForced}
            reason={s.paymentForced ? 'Pay to enter (P2E) orders are settled before dispatch.' : undefined}
          />
        </Cell>

        {delivery ? (
          <Cell title="Delivery address" filled={!!s.address} span>
            {s.address ? (
              <p className="text-sm">
                {s.address.label} · {s.address.line}, {s.address.districtName}
                <span className="ms-2 text-xs text-muted-foreground">
                  store {s.plant.name} ({s.plant.code}) derived from it
                </span>
              </p>
            ) : (
              <p className="text-sm text-attention-800">
                Pick an address in the panel on the left — it decides the store, so nothing can be added until it is set.
              </p>
            )}
          </Cell>
        ) : (
          <Cell title="Collection store" filled={chosen} span>
            {chosen ? (
              <p className="text-sm">
                {s.plant.name} <span data-numeric className="text-muted-foreground">({s.plant.code})</span>
              </p>
            ) : (
              <StorePicker shape={storeShape} seeded="1001" />
            )}
          </Cell>
        )}

        {delivery && (
          <Cell title="Delivery slot" filled={!!s.slot} span>
            {s.slot ? (
              <p data-numeric className="text-sm">
                {s.slot.day} {s.slot.from}–{s.slot.to}
              </p>
            ) : (
              <SlotPicker />
            )}
          </Cell>
        )}

        <Cell title="Source and reference" filled={!!s.sourceReference} span>
          <SourceCapture s={s} />
        </Cell>
      </div>
    </div>
  )
}

function Cell({
  title,
  filled,
  span = false,
  children,
}: {
  title: string
  filled: boolean
  span?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-md border p-3 ${span ? 'col-span-2' : ''} ${
        filled ? 'border-border bg-card' : 'border-attention-border bg-attention-050'
      }`}
    >
      <h3
        className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${
          filled ? 'text-muted-foreground' : 'text-attention-800'
        }`}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

function Pill({ label, note }: { label: string; note?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
      <span className="font-medium">{label}</span>
      {note && <span className="text-ink-3">({note})</span>}
    </span>
  )
}
