/* PROTOTYPE — throwaway. Ticket 135, variant C.
 *
 * "INPUT | TRUTH." One vertical split, and the split MEANS something: everything
 * on the left is what the agent is doing (estimates, guesses, half-typed
 * searches, header sections as an accordion); everything on the right is what
 * the engine says is true (the basket, the money, the order). The line between
 * them is the answer to 131's mis-quote problem — an estimate physically cannot
 * appear on the truth side, and SAR never appears on the input side.
 *
 * Near-misses are a DRAWER tab on the truth edge with a count badge: they can
 * be opened over the truth pane and dismissed, so they never permanently spend
 * screen. Confirmations take over the truth pane rather than floating.
 */
import type { ConsoleState, NearMiss } from './mock-state'
import { money } from './mock-state'
import { AtpPill, Btn, Dot, KeyCap, Money } from './parts'

export const NAME = 'Input | Truth, promo drawer'

export default function VariantC({ s, scenarioKey }: { s: ConsoleState; scenarioKey: string }) {
  const drawerOpen = scenarioKey === 'prereq'
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border-strong bg-card px-4 text-sm">
        <span className="font-semibold">New order</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">CLCN · cash</span>
        {s.busy && (
          <span className="rounded bg-primary-050 px-2 py-0.5 text-[11px] text-primary-800">
            busy — retry {s.busy.attempt}/{s.busy.ceiling}
          </span>
        )}
        <span className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyCap>Ctrl</KeyCap>
          <KeyCap>K</KeyCap> commands · <KeyCap>?</KeyCap> keys
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <InputSide s={s} />
        <div className="relative min-h-0">
          {s.pending ? <TruthTakeover s={s} /> : <TruthSide s={s} />}
          <PromoDrawer s={s} open={drawerOpen} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- input side ------------------------------- */

function InputSide({ s }: { s: ConsoleState }) {
  return (
    <section className="flex min-h-0 flex-col overflow-auto bg-card-2">
      <div className="border-b border-divider px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        What you&apos;re entering
      </div>

      <Accordion
        open={!s.customer}
        title="Caller"
        value={s.customer ? `${s.customer.name} · ${s.customer.mobile}` : null}
      >
        <input
          autoFocus
          placeholder="Mobile number"
          className="w-full rounded-md border-2 border-primary bg-card px-3 py-2 text-sm outline-none"
        />
        <div className="mt-1 text-[11px] text-muted-foreground">
          <KeyCap>Enter</KeyCap> looks the caller up.
        </div>
      </Accordion>

      <Accordion
        open={!!s.customer && !s.address}
        title="Address"
        value={s.address ? `${s.address.label} · ${s.address.districtName}, ${s.address.cityName}` : null}
        locked={!s.customer}
        lockNote="Attach the caller first — their address book opens with them."
      >
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-primary-border bg-primary-050 p-2 text-sm">
            <input type="radio" name="addr-c" defaultChecked /> <span className="font-medium">Home</span>
            <span className="text-xs text-muted-foreground">Villa 22, Al Malqa</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm">
            <input type="radio" name="addr-c" /> <span className="font-medium">Work</span>
            <span className="text-xs text-muted-foreground">Olaya Tower 3, Al Olaya</span>
          </label>
          <button className="text-xs text-primary hover:underline">+ Add a new address</button>
        </div>
      </Accordion>

      <Accordion
        open={false}
        title="Store"
        value={s.plant ? `${s.plant.code} ${s.plant.name} · derived from the address` : null}
        locked={!s.address}
        lockNote="Set by the address."
      />

      <Accordion open={!s.slot && !!s.address} title="Delivery slot" value={s.slot?.label ?? null}>
        <div className="mb-2 flex gap-1.5">
          {['Today', 'Tomorrow', 'Wed 29'].map((d, i) => (
            <button key={d} className={`rounded-md border px-2.5 py-1 text-xs ${i === 0 ? 'border-primary bg-primary-050 text-primary-800' : 'border-border bg-card'}`}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['ASAP', '15:00–18:00', '18:00–21:00', '21:00–23:00'].map((t, i) => (
            <button key={t} className={`rounded-full border px-2.5 py-1 text-xs ${i === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>
              {t}
            </button>
          ))}
        </div>
      </Accordion>

      <Accordion
        open={false}
        title="Source"
        value={s.documentSource ? `${s.documentSource} · ${s.sourceReference ?? 'ref missing'}` : null}
        warn={!!s.documentSource && !s.sourceReference}
      />

      {/* the estimate zone — labelled once, and it is on this side of the line */}
      <div className="mt-2 border-t border-border-strong">
        <div className="flex items-center justify-between px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>Catalogue</span>
          <span className="normal-case">prices here are estimates, before VAT</span>
        </div>
        <div className="px-4 pb-3">
          <input
            defaultValue={s.search?.query ?? ''}
            placeholder="Search items — English, Arabic, or item number"
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {s.search && (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-divider text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 text-start font-medium">Item</th>
                  <th className="py-1 text-end font-medium">At store</th>
                  <th className="py-1 text-end font-medium">est. ex-VAT</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.search.rows.map((r) => (
                  <tr key={r.itemNumber} className="border-b border-divider hover:bg-accent">
                    <td className="py-1.5">
                      <div className="truncate text-sm">{r.description}</div>
                      <div data-numeric className="text-xs text-muted-foreground">
                        {r.itemNumber} · {r.description2}
                      </div>
                    </td>
                    <td className="py-1.5 text-end">
                      <AtpPill atp={r.atp} compact />
                    </td>
                    <td data-numeric className="py-1.5 text-end text-xs italic text-muted-foreground">
                      ≈{money(r.estimatePriceExVat)}
                    </td>
                    <td className="py-1.5 ps-2 text-end">
                      <Btn>Add</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}

function Accordion({
  open,
  title,
  value,
  children,
  locked,
  lockNote,
  warn,
}: {
  open: boolean
  title: string
  value: string | null
  children?: React.ReactNode
  locked?: boolean
  lockNote?: string
  warn?: boolean
}) {
  return (
    <div className="border-b border-divider">
      <button
        type="button"
        className={`flex w-full items-center gap-2 px-4 py-2 text-start ${locked ? 'opacity-55' : 'hover:bg-accent'}`}
      >
        <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{title}</span>
        {value ? (
          <span className={`min-w-0 flex-1 truncate text-sm ${warn ? 'text-attention-800' : ''}`}>{value}</span>
        ) : (
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">{locked ? lockNote : 'not set'}</span>
        )}
        {value && <Dot tone={warn ? 'warn' : 'good'} />}
        <span aria-hidden className="text-xs opacity-40">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && !locked && children && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

/* ------------------------------- truth side ------------------------------- */

function TruthSide({ s }: { s: ConsoleState }) {
  return (
    <section className="flex h-full min-h-0 flex-col border-s-2 border-border-strong bg-card">
      <div className="flex items-center justify-between border-b border-divider px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>The order · what the caller pays</span>
        {s.hasBelowAtp && <span className="text-attention-800">below availability</span>}
      </div>

      {s.refusal && (
        <div className="border-b border-danger-border bg-danger-050 px-4 py-2 text-xs text-danger-800">
          <div className="font-semibold">{s.refusal.message}</div>
          {s.refusal.lines?.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {s.lines.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nothing on the order yet.</div>
        ) : (
          s.lines.map((l) => (
            <div key={l.lineId} className={`border-b border-divider px-4 py-2 ${l.unpriceable ? 'bg-danger-050' : ''}`}>
              <div className="flex items-baseline gap-2">
                <input defaultValue={l.qty} data-numeric className="w-10 rounded border border-input bg-card px-1 py-0.5 text-center text-xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{l.description}</span>
                <Money v={l.lineTotalGross} />
              </div>
              <div className="mt-0.5 flex items-center gap-2 ps-12 text-xs text-muted-foreground">
                <span data-numeric>
                  {l.qty} × {money(l.unitPriceGross)}
                </span>
                <AtpPill atp={l.atpAtScan} compact />
                {l.promo && (
                  <span className="text-success-800">
                    {l.promo.description} <span data-numeric>{money(l.promo.amount)}</span>
                  </span>
                )}
                {l.unpriceable && <span className="font-medium text-danger-800">no price at the new store</span>}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border-strong px-4 py-3">
        {s.totals && (
          <dl className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Items incl. VAT</dt>
              <dd>
                <Money v={s.totals.net + s.totals.vat} tone="muted" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>
                <Money v={s.totals.deliveryFee} tone="muted" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-divider pt-2">
              <dt className="font-semibold">Total</dt>
              <dd>
                <Money v={s.totals.payable} size="lg" />
              </dd>
            </div>
          </dl>
        )}
        {s.capabilities.submitBlockers.length > 0 && (
          <div className="mb-2 text-xs text-attention-800">Still needed: {s.capabilities.submitBlockers.join(' · ')}</div>
        )}
        <button
          disabled={!s.capabilities.canSubmit || s.submitting}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {s.submitting ? 'Placing the order…' : 'Place order'}
        </button>
      </div>
    </section>
  )
}

/** A confirmation replaces the truth pane: the agent decides about the order in
 *  the place the order lives, and the input side keeps working. */
function TruthTakeover({ s }: { s: ConsoleState }) {
  const p = s.pending!
  if (p.kind === 'belowAtp')
    return (
      <section className="flex h-full flex-col border-s-2 border-attention bg-attention-050 p-5">
        <div className="text-[11px] uppercase tracking-wide text-attention-800">Confirm before it goes on the order</div>
        <h2 className="mt-2 text-base font-semibold">{p.detail.description}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-card p-4 text-center">
          <div>
            <div data-numeric className="text-3xl font-semibold">
              {p.detail.requested}
            </div>
            <div className="text-[11px] text-muted-foreground">asked for</div>
          </div>
          <div>
            <div data-numeric className="text-3xl font-semibold text-attention-800">
              {p.detail.available}
            </div>
            <div className="text-[11px] text-muted-foreground">at store {p.detail.plant}</div>
          </div>
          <div>
            <div data-numeric className="text-3xl font-semibold text-danger-800">
              −{p.detail.requested - p.detail.available}
            </div>
            <div className="text-[11px] text-muted-foreground">short</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-attention-800">
          You may add it anyway. The order will carry these exact numbers as your acceptance.
        </p>
        <div className="mt-auto flex gap-2">
          <Btn kind="primary">Add {p.detail.requested} anyway</Btn>
          <Btn>Reduce to {p.detail.available}</Btn>
          <Btn>Cancel</Btn>
        </div>
      </section>
    )

  return (
    <section className="flex h-full flex-col border-s-2 border-primary bg-card p-5">
      <div className="text-[11px] uppercase tracking-wide text-primary-800">Confirm the store change</div>
      <h2 className="mt-1 text-base font-semibold">
        {p.detail.fromName} → {p.detail.toName} ({p.detail.toPlant})
      </h2>
      <div className="mt-3 min-h-0 flex-1 overflow-auto">
        {p.detail.lineDiffs.map((l) => {
          const d = l.toGross - l.fromGross
          return (
            <div key={l.lineId} className="flex items-baseline gap-2 border-b border-divider py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{l.description}</span>
              <span data-numeric className="text-xs text-muted-foreground line-through">
                {money(l.fromGross)}
              </span>
              <span data-numeric className={`font-medium ${d < 0 ? 'text-success-800' : d > 0 ? 'text-danger-800' : 'text-muted-foreground'}`}>
                {money(l.toGross)}
              </span>
            </div>
          )
        })}
        {p.detail.promotionsMoved.map((m) => (
          <div key={m.offerId} className="mt-2 rounded bg-attention-050 p-2 text-xs text-attention-800">
            {m.description} pays <span data-numeric>{money(m.toAmount)}</span> there, not{' '}
            <span data-numeric>{money(m.fromAmount)}</span>.
          </div>
        ))}
        {p.detail.atpReFreeze
          .filter((a) => a.belowAfter)
          .map((a) => (
            <div key={a.lineId} className="mt-2 rounded bg-danger-050 p-2 text-xs text-danger-800">
              {a.lineId} drops to <span data-numeric>{a.toQty}</span> available — below what is on the order.
            </div>
          ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Btn kind="primary">Move and re-price</Btn>
        <Btn>Keep {p.detail.fromName}</Btn>
      </div>
    </section>
  )
}

/* ------------------------------ promo drawer ------------------------------ */

function PromoDrawer({ s, open }: { s: ConsoleState; open: boolean }) {
  const actionable = s.nearMisses.filter((n) => n.klass === 'actionable')
  if (s.nearMisses.length === 0) return null

  if (!open)
    return (
      <button
        type="button"
        className="absolute bottom-24 end-0 flex items-center gap-2 rounded-s-full border border-e-0 border-primary-border bg-primary-050 py-2 pe-3 ps-4 text-xs font-medium text-primary-800 shadow-sm"
      >
        <span data-numeric className="rounded-full bg-primary px-1.5 text-primary-foreground">
          {actionable.length}
        </span>
        offers within reach
      </button>
    )

  return (
    <div className="absolute inset-y-0 end-0 z-20 flex w-[26rem] flex-col border-s-2 border-primary bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-divider px-4 py-2">
        <span className="text-sm font-semibold">Offers within reach</span>
        <button className="text-muted-foreground">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {s.nearMisses.map((n) => (
          <DrawerCard key={n.offerId} n={n} />
        ))}
      </div>
    </div>
  )
}

function DrawerCard({ n }: { n: NearMiss }) {
  if (n.klass === 'ready')
    return (
      <div className="mb-2 flex items-center gap-2 rounded-md border border-success-border bg-success-050 p-2 text-xs text-success-800">
        <Dot tone="good" /> <span className="font-medium">{n.description}</span> already applied
      </div>
    )
  if (n.klass === 'blocked')
    return (
      <div className="mb-2 rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
        <span className="font-medium">{n.description}</span>
        <div>Not evaluated for this basket · {n.skipReason}</div>
      </div>
    )
  return (
    <div className="mb-2 rounded-md border-2 border-primary-border bg-card p-3">
      <div className="text-sm font-medium">{n.description}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        Add <span data-numeric className="font-semibold text-foreground">{n.progress.need - n.progress.have}</span> from{' '}
        {n.prereq.label} · <span data-numeric>{n.prereq.eligibleCount}</span> qualify
      </div>
      <div className="mt-2 space-y-1">
        {n.items?.map((i) => (
          <div key={i.itemNumber} className="flex items-center gap-2 rounded border border-border px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-xs">{i.description}</span>
            <AtpPill atp={i.atp} compact />
            <span data-numeric className="text-[11px] italic text-muted-foreground">
              ≈{money(i.estimatePriceExVat)}
            </span>
            <button className="rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">Add</button>
          </div>
        ))}
        <button className="text-xs text-primary hover:underline">Show all 42</button>
      </div>
    </div>
  )
}
