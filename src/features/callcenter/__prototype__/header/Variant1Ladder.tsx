/* PROTOTYPE — throwaway. Ticket 175, variant 1.
 *
 * THE CLAIM: the header is a SEQUENCE, so draw it as one. A numbered ladder runs
 * down the centre column; the current rung is open, finished rungs collapse to a
 * one-line summary with an edit affordance, and the rung where items unlock is
 * marked on the ladder itself. 175's "the centre must read as intended sequence,
 * never as everything disabled" is native here rather than bolted on.
 *
 * WHERE IT COSTS: a veteran agent on their nine-hundredth call does not need a
 * ladder, and the rungs occupy centre column that the basket wants back. It also
 * implies an order the caller may not follow — a caller who volunteers their
 * reference number at hello makes the agent climb.
 *
 * Nearest real-world kin: guided order capture in food-delivery call centres,
 * where scripts are the point and agent turnover is high.
 */
import type { ReactNode } from 'react'
import { FulfilmentChoice, PaymentChoice, SlotPicker, SourceCapture, StorePicker } from './header-parts'
import type { HeaderState, OpenSurface } from './header-mock'

export const NAME = '1 · Guided ladder'

type Rung = {
  id: OpenSurface | 'caller' | 'items'
  title: string
  done: boolean
  summary: string | null
  body: ReactNode | null
}

export default function Variant1Ladder({ s, storeShape }: { s: HeaderState; storeShape: 'grouped' | 'palette' | 'drill' }) {
  const chosen = s.plant.source !== 'seededAtOpen'
  const delivery = s.mode === 'Delivery'

  const rungs: Rung[] = [
    {
      id: 'caller',
      title: 'Who is calling?',
      done: !!s.customer,
      summary: s.customer ? `${s.customer.name} · ${s.customer.mobile}` : null,
      body: <p className="text-sm text-muted-foreground">Take the caller&rsquo;s mobile number in the panel on the left.</p>,
    },
    {
      id: 'fulfilment',
      title: 'Delivering, or collecting?',
      done: !!s.customer,
      summary: delivery ? 'Delivery' : 'Collection in store',
      body: <FulfilmentChoice mode={s.mode} />,
    },
    delivery
      ? {
          id: 'where',
          title: 'Where is it going?',
          done: !!s.address,
          summary: s.address ? `${s.address.label} · ${s.address.line}, ${s.address.districtName}` : null,
          body: (
            <p className="text-sm text-muted-foreground">
              Pick an address in the panel on the left. The store is derived from it — you never choose one.
            </p>
          ),
        }
      : {
          id: 'where',
          title: 'Which store are they collecting from?',
          done: chosen,
          summary: chosen ? `${s.plant.name} (${s.plant.code})` : null,
          body: <StorePicker shape={storeShape} seeded="1001" chosen={chosen ? s.plant.code : undefined} />,
        },
    ...(delivery
      ? [
          {
            id: 'when' as const,
            title: 'When do they want it?',
            done: !!s.slot,
            summary: s.slot ? `${s.slot.day} ${s.slot.from}–${s.slot.to}` : null,
            body: <SlotPicker chosen={s.slot ? '2026-07-28#S3' : undefined} />,
          },
        ]
      : []),
    {
      id: 'reference',
      title: 'Where did this order come from?',
      done: !!s.sourceReference,
      summary: s.sourceReference ? `${s.documentSource} · ${s.sourceReference}` : null,
      body: <SourceCapture s={s} />,
    },
    {
      id: 'payment',
      title: 'How are they paying?',
      done: !!s.payment,
      summary: s.payment ? (s.payment === 'CashOnDelivery' ? 'Cash on delivery' : 'Paid online') : null,
      body: (
        <PaymentChoice
          value={s.payment}
          forced={s.paymentForced}
          reason={s.paymentForced ? 'Pay to enter (P2E) orders are settled before dispatch.' : undefined}
        />
      ),
    },
  ]

  return (
    <div className="shrink-0 border-b border-divider px-4 py-3">
      <ol className="space-y-1">
        {rungs.map((r, i) => {
          const open = s.open === r.id || (s.open === 'none' && !r.done && rungs.slice(0, i).every((p) => p.done))
          // The gate lives ON the ladder: everything above this line must be
          // answered before a single item can enter the order.
          const gateHere = r.id === 'where'
          return (
            <li key={r.id}>
              <div
                className={`rounded-md border ${
                  open ? 'border-primary-border bg-card' : r.done ? 'border-transparent' : 'border-transparent'
                }`}
              >
                <div className={`flex items-center gap-2.5 px-2.5 ${open ? 'pt-2.5' : 'py-1.5'}`}>
                  <span
                    data-numeric
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      r.done
                        ? 'bg-success-050 text-success-800'
                        : open
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.done ? '✓' : i + 1}
                  </span>
                  <span className={`flex-1 text-sm ${open ? 'font-semibold' : r.done ? '' : 'text-muted-foreground'}`}>
                    {r.done && r.summary ? r.summary : r.title}
                  </span>
                  {r.done && !open && (
                    <button type="button" className="text-xs text-primary-800 hover:underline">
                      Change
                    </button>
                  )}
                </div>
                {open && r.body && <div className="px-2.5 pb-3 pt-2">{r.body}</div>}
              </div>

              {gateHere && (
                <div className="my-1.5 flex items-center gap-2 ps-2.5">
                  <span className="h-px flex-1 bg-border-strong" />
                  <span
                    className={`text-[11px] font-medium ${
                      s.canAddItem ? 'text-success-800' : 'text-attention-800'
                    }`}
                  >
                    {s.canAddItem ? 'items can be added below' : 'items unlock once the caller and the store are set'}
                  </span>
                  <span className="h-px flex-1 bg-border-strong" />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
