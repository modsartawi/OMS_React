/* PROTOTYPE — throwaway. Ticket 175.
 *
 * THE FURNITURE, NOT THE QUESTION. 135 settled the console: three fixed columns,
 * rails that never move, the centre the only thing that scrolls. Reproduced here
 * so each header-capture variant is judged at its real density budget, against a
 * basket and a receipt competing for the same space.
 *
 * Two things the host owns on purpose, because 175 ruled them and they must read
 * IDENTICALLY across variants or the comparison is unfair:
 *   - the item search panel is ABSENT until `canAddItem`, never disabled
 *   - the receipt lists `submitBlockers` verbatim, in the server's own order
 */
import { useState, type ReactNode } from 'react'
import { BLOCKER_WORDS, money, type Catalogue, type HeaderState, type Line, type OpenSurface } from './header-mock'
import ItemCommandLine, { type Landed } from './ItemCommandLine'

export default function HeaderHost({
  s: base,
  capture,
  onVerb = () => {},
}: {
  s: HeaderState
  capture: ReactNode
  onVerb?: (surface: OpenSurface) => void
}) {
  // The added lines live HERE rather than in the scenario, so the keyboard loop
  // is real: type, Enter, watch the line land in the basket and the money move.
  const [added, setAdded] = useState<Line[]>([])
  const [landed, setLanded] = useState<Landed | null>(null)

  const add = (c: Catalogue, qty: number) => {
    setAdded((ls) => [
      ...ls,
      {
        lineId: `X${ls.length + 1}`,
        itemNumber: c.itemNumber,
        description: c.description,
        qty,
        uom: 'EA',
        // Engine truth in real life. Here: the ex-VAT estimate, VAT applied —
        // which is exactly why the two numbers must never share a column.
        gross: Number((c.estimateExVat * 1.15 * qty).toFixed(2)),
      },
    ])
    setLanded({ itemNumber: c.itemNumber, description: c.description, qty })
  }

  const undo = () => {
    setAdded((ls) => ls.slice(0, -1))
    setLanded(null)
  }

  const s: HeaderState = {
    ...base,
    lines: [...base.lines, ...added],
    submitBlockers:
      base.lines.length + added.length > 0 ? base.submitBlockers.filter((b) => b !== 'NO_LINES') : base.submitBlockers,
  }

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border-strong bg-card px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">New order</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">CLCN · cash</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              s.mode === 'Delivery'
                ? 'border-border bg-card text-muted-foreground'
                : 'border-primary-border bg-primary-050 text-primary-800'
            }`}
          >
            {s.mode === 'Delivery' ? 'Delivery' : 'Collection'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <kbd className="rounded border border-border-strong bg-muted px-1.5 py-0.5 text-[10px] font-medium">Ctrl</kbd>
          <kbd className="rounded border border-border-strong bg-muted px-1.5 py-0.5 text-[10px] font-medium">K</kbd>
          <span>commands</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px]">
        <Rail s={s} />
        <main className="flex min-h-0 min-w-0 flex-col overflow-auto border-x border-border">
          {capture}
          <ItemArea s={s} onAdd={add} onVerb={onVerb} landed={landed} onUndo={undo} />
        </main>
        <Receipt s={s} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ rail --- */

function Rail({ s }: { s: HeaderState }) {
  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-auto bg-sidebar p-4">
      {s.customer ? (
        <>
          <div>
            <div className="text-sm font-semibold leading-tight">{s.customer.name}</div>
            <div data-numeric className="text-xs text-muted-foreground">
              {s.customer.mobile}
            </div>
          </div>
          <dl className="space-y-2 text-xs">
            <Field k="Customer" v={s.customer.customerId} />
            <Field k="Loyalty" v={s.customer.loyalty} />
            <Field k="Orders" v={String(s.customer.orders)} />
          </dl>
        </>
      ) : (
        // 165: the caret is in this field at open. It is the first act of every
        // order, so it is the only live control on the screen.
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Caller
          </label>
          <input
            autoFocus
            placeholder="Mobile number"
            className="w-full rounded-md border-2 border-primary-border bg-card px-3 py-2 text-sm outline-none"
          />
          <p className="mt-2 text-xs text-muted-foreground">Every order starts with the caller.</p>
        </div>
      )}

      {/* 154: under collection there is no shipping address AT ALL — the builder
          discards one, so showing an optional field would make the agent watch
          keyed data vanish. Hidden, not disabled. */}
      {s.mode === 'Delivery' &&
        s.customer &&
        (s.address ? (
          <div className="rounded-md border border-border bg-card p-2.5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Delivering to
            </div>
            <div className="text-xs font-medium">{s.address.label}</div>
            <div className="text-xs text-muted-foreground">{s.address.line}</div>
            <div className="text-xs text-muted-foreground">
              {s.address.districtName} · {s.address.cityName}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border-strong p-2.5 text-center">
            <div className="mb-2 text-xs text-muted-foreground">No address yet</div>
            <button
              type="button"
              className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Pick an address
            </button>
          </div>
        ))}

      {s.mode === 'PickInStore' && s.customer && (
        <div className="rounded-md border border-border bg-card p-2.5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Collecting from
          </div>
          {s.plant.source === 'seededAtOpen' ? (
            <div className="text-xs text-attention-800">Not chosen yet</div>
          ) : (
            <>
              <div className="text-xs font-medium">{s.plant.name}</div>
              <div data-numeric className="text-xs text-muted-foreground">
                {s.plant.code}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd data-numeric className="font-medium">
        {v}
      </dd>
    </div>
  )
}

/* ------------------------------------------------------------- item area --- */

function ItemArea({
  s,
  onAdd,
  onVerb,
  landed,
  onUndo,
}: {
  s: HeaderState
  onAdd: (c: Catalogue, qty: number) => void
  onVerb: (surface: OpenSurface) => void
  landed: Landed | null
  onUndo: () => void
}) {
  // 175: the panel is ABSENT while the gate is shut, not disabled. Two reasons —
  // a control the door refuses is worse than no control, and item search prices
  // its estimate AT THE ORDER'S PLANT, so a search before the store is chosen
  // quotes a number off a store nobody picked (131's mis-quote risk, twice).
  if (!s.canAddItem) return null

  return (
    <>
      <ItemCommandLine onAdd={onAdd} onVerb={onVerb} landed={landed} onUndo={onUndo} />
      <div className="min-h-0 flex-1">
        {s.lines.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Ready for items — type above, or read the caller their offers.
          </p>
        ) : (
          s.lines.map((l) => (
            <div key={l.lineId} className="flex items-center gap-3 border-b border-divider px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{l.description}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span data-numeric>{l.itemNumber}</span>
                  {/* 🚩 THE GS1 DEFECT, drawn as it should be. The CallCenterOrder
                      doctype row does not set IsGs1Required, so it inherits the
                      catalogue default TRUE and the engine demands a scan for a
                      serial-controlled article. There is no physical item in a
                      call centre — nothing to scan, ever. */}
                  <span className="rounded-full border border-success-border bg-success-050 px-2 py-0.5 text-[11px] font-medium text-success-800">
                    no scan needed
                  </span>
                </div>
              </div>
              <span data-numeric className="w-8 text-center text-sm">
                {l.qty}
              </span>
              <span className="w-8 text-xs text-muted-foreground">{l.uom}</span>
              <span data-numeric className="text-sm font-medium">
                {money(l.gross)}
                <span className="ms-1 text-[0.7em] font-normal text-ink-3">SAR</span>
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

/* --------------------------------------------------------------- receipt --- */

function Receipt({ s }: { s: HeaderState }) {
  const net = s.lines.reduce((a, l) => a + l.gross, 0) / 1.15
  const vat = s.lines.reduce((a, l) => a + l.gross, 0) - net
  // 154: the fee is 0 under collection by a predicate that ALREADY exists
  // (`subSourceCarriesFee && isDelivery && underThreshold`) — the mode
  // suppresses it outright, basket or no basket.
  const fee = s.mode === 'PickInStore' ? 0 : 15
  const payable = net + vat + fee

  return (
    <aside className="flex min-h-0 flex-col bg-card">
      <div className="border-b border-divider px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        The caller pays
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <dl className="space-y-1.5 text-sm">
          <Row k="Items" v={money(net)} />
          <Row k="VAT 15%" v={money(vat)} />
          {/* 154: the fee is 0 under collection by a predicate that already
              exists — not by a rule this console invented. */}
          <Row k={s.mode === 'PickInStore' ? 'Collection' : 'Delivery'} v={money(fee)} />
          <div className="!mt-3 flex items-baseline justify-between border-t border-border-strong pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span data-numeric className="text-xl font-semibold">
              {money(payable)}
              <span className="ms-1 text-[0.6em] font-normal text-ink-3">SAR</span>
            </span>
          </div>
        </dl>

        {s.payment && (
          <div className="mt-4 rounded-md border border-border bg-card-2 p-2.5 text-xs">
            <div className="text-muted-foreground">Payment</div>
            <div className="font-medium">{s.payment === 'CashOnDelivery' ? 'Cash on delivery' : 'Paid online'}</div>
          </div>
        )}
      </div>

      <div className="border-t border-divider p-4">
        {/* 173: the receipt words the blockers off the SERVER'S list, in the
            server's order — the same table the chips read. */}
        {s.submitBlockers.length > 0 && (
          <ul className="mb-3 space-y-1 text-xs text-muted-foreground">
            {s.submitBlockers.map((b) => (
              <li key={b} className="flex gap-1.5">
                <span aria-hidden className={b === 'STORE_NOT_CHOSEN' ? 'text-attention-800' : ''}>
                  •
                </span>
                <span className={b === 'STORE_NOT_CHOSEN' ? 'text-attention-800' : ''}>
                  {BLOCKER_WORDS[b] ?? 'something else this order needs'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={s.submitBlockers.length > 0}
          className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Place order
        </button>
      </div>
    </aside>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd data-numeric className="text-muted-foreground">
        {v}
      </dd>
    </div>
  )
}
