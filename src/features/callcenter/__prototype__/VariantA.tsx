/* PROTOTYPE — throwaway. Ticket 135, variant A.
 *
 * "THREE FIXED COLUMNS." The spatial contract of every mature agent desktop:
 * a customer rail that never moves (CC2 finding 2), a working centre, and a
 * sticky live receipt (finding 7). Header capture is a chip row across the top
 * of the centre; the near-miss rail is a horizontal strip UNDER the basket, so
 * it can never steal the basket's width.
 *
 * Ex-VAT treatment (131): the search row's number is rendered in a different
 * typographic register from money — small, muted, `≈`, no SAR — and the panel
 * carries a standing header. Money has SAR; estimates never do.
 */
import type { ConsoleState } from './mock-state'
import { money } from './mock-state'
import { AtpPill, Btn, Dot, KeyCap, Money, Sheet } from './parts'

export const NAME = 'Three fixed columns'

export default function VariantA({ s, scenarioKey }: { s: ConsoleState; scenarioKey: string }) {
  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <TopBar s={s} />
      {s.busy && <BusyStrip attempt={s.busy.attempt} ceiling={s.busy.ceiling} />}
      {s.refusal && <RefusalBar code={s.refusal.code} message={s.refusal.message} lines={s.refusal.lines} />}

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px]">
        <CustomerRail s={s} />

        <main className="flex min-h-0 min-w-0 flex-col border-x border-border">
          <ChipRow s={s} />
          <SearchArea s={s} />
          <Basket s={s} />
          <PromoStrip s={s} expanded={scenarioKey === 'prereq'} />
        </main>

        <Receipt s={s} />
      </div>

      {s.pending?.kind === 'belowAtp' && <BelowAtpSheet d={s.pending.detail} />}
      {s.pending?.kind === 'storeChange' && <RebindSheet d={s.pending.detail} />}
    </div>
  )
}

function TopBar({ s }: { s: ConsoleState }) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border-strong bg-card px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">New order</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">CLCN · cash</span>
        {s.hasBelowAtp && (
          <span className="rounded bg-attention-050 px-1.5 py-0.5 text-[11px] font-medium text-attention-800">below availability</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <KeyCap>Ctrl</KeyCap>
        <KeyCap>K</KeyCap>
        <span>commands</span>
        <span className="mx-1 text-ink-3">·</span>
        <KeyCap>?</KeyCap>
        <span>shortcuts</span>
      </div>
    </header>
  )
}

function BusyStrip({ attempt, ceiling }: { attempt: number; ceiling: number }) {
  return (
    <div className="relative h-7 shrink-0 overflow-hidden border-b border-primary-border bg-primary-050 px-4 text-xs leading-7 text-primary-800">
      Saving — the order is locked by another request. Retrying ({attempt}/{ceiling}). You can keep typing.
      <span className="animate-indeterminate absolute bottom-0 left-0 h-0.5 w-1/4 bg-primary" />
    </div>
  )
}

function RefusalBar({ code, message, lines }: { code: string; message: string; lines?: string[] }) {
  return (
    <div className="shrink-0 border-b border-danger-border bg-danger-050 px-4 py-2">
      <div className="text-sm font-medium text-danger-800">{message}</div>
      {lines?.map((l) => (
        <div key={l} className="mt-0.5 text-xs text-danger-800">
          {l}
        </div>
      ))}
      <div className="mt-0.5 text-[11px] text-danger-800/80">{code} · nothing was changed</div>
    </div>
  )
}

function CustomerRail({ s }: { s: ConsoleState }) {
  if (!s.customer)
    return (
      <aside className="flex flex-col gap-3 bg-sidebar p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caller</div>
        <label className="text-xs text-muted-foreground" htmlFor="ph-a">
          Mobile number
        </label>
        {/* CC2 finding 1: caret lands here on open. Enter resolves. */}
        <input
          id="ph-a"
          autoFocus
          placeholder="05…"
          className="rounded-md border-2 border-primary bg-card px-3 py-2 text-sm outline-none"
        />
        <div className="text-[11px] text-muted-foreground">
          Press <KeyCap>Enter</KeyCap> to look up. Everything else stays disabled until a caller is attached.
        </div>
      </aside>
    )

  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-auto bg-sidebar p-4">
      <div>
        <div className="text-sm font-semibold leading-tight">{s.customer.name}</div>
        <div data-numeric className="text-xs text-muted-foreground">
          {s.customer.mobile}
        </div>
      </div>
      {/* Salesforce compact-layout discipline: six fields, hard cap (CC2 finding 2). */}
      <dl className="space-y-2 text-xs">
        <Field k="Loyalty" v={s.customer.loyalty} />
        <Field k="Customer" v={s.customer.customerId} />
        <Field k="Past orders" v={String(s.customer.sinceOrders)} />
      </dl>

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</span>
          {s.capabilities.canOpenAddressBook && <button className="text-xs text-primary underline-offset-2 hover:underline">Change</button>}
        </div>
        {s.address ? (
          <div className="rounded-md border border-primary-border bg-primary-050 p-2 text-xs">
            <div className="font-medium">{s.address.label}</div>
            <div className="text-muted-foreground">{s.address.line}</div>
            <div className="text-muted-foreground">
              {s.address.districtName}, {s.address.cityName}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-input p-3 text-center text-xs text-muted-foreground">
            <div className="mb-2">No address yet</div>
            <Btn wide>Pick an address</Btn>
          </div>
        )}
      </div>
    </aside>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd data-numeric className="text-end font-medium">
        {v}
      </dd>
    </div>
  )
}

/** Progressive collapse (CC2 finding 9): a settled section is one chip. */
function ChipRow({ s }: { s: ConsoleState }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-divider bg-card px-4 py-2">
      <Chip
        label="Store"
        value={s.plant ? `${s.plant.code} ${s.plant.name}` : 'from address'}
        settled={!!s.plant}
        hint={s.plant?.source === 'derivedFromAddress' ? 'derived' : 'override'}
      />
      <Chip label="Slot" value={s.slot?.label ?? 'not set'} settled={!!s.slot} warn={!s.slot} />
      <Chip label="Source" value={s.documentSource ?? 'not set'} settled={!!s.documentSource} />
      <Chip label="Ref" value={s.sourceReference ?? 'required'} settled={!!s.sourceReference} warn={!s.sourceReference} />
    </div>
  )
}

function Chip({ label, value, settled, warn, hint }: { label: string; value: string; settled: boolean; warn?: boolean; hint?: string }) {
  const tone = warn
    ? 'border-attention-border bg-attention-050 text-attention-800'
    : settled
      ? 'border-border bg-muted text-foreground'
      : 'border-dashed border-input bg-card text-muted-foreground'
  return (
    <button type="button" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${tone}`}>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-medium">{value}</span>
      {hint && <span className="text-[10px] opacity-60">({hint})</span>}
      <span aria-hidden className="opacity-50">
        ▾
      </span>
    </button>
  )
}

function SearchArea({ s }: { s: ConsoleState }) {
  return (
    <div className="shrink-0 border-b border-divider bg-card-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          defaultValue={s.search?.query ?? ''}
          placeholder="Search items — name, Arabic name, or item number"
          className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <KeyCap>/</KeyCap>
      </div>

      {s.search && (
        <div className="mt-2 overflow-hidden rounded-md border border-border bg-card">
          {/* The mis-quote guard, stated once at the top of the panel. */}
          <div className="flex items-center justify-between border-b border-divider bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              Catalogue prices are <span className="font-semibold text-foreground">estimates before VAT</span> — the basket
              price is what the caller pays.
            </span>
            {s.search.truncated && <span>showing 4 · narrow your search</span>}
          </div>
          {s.search.rows.map((r) => (
            <div key={r.itemNumber} className="flex items-center gap-3 border-b border-divider px-3 py-2 last:border-0 hover:bg-accent">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{r.description}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span data-numeric>{r.itemNumber}</span>
                  <span>{r.description2}</span>
                </div>
              </div>
              <AtpPill atp={r.atp} />
              {/* register: muted, ≈, no SAR, smaller than money */}
              <span data-numeric className="w-24 text-end text-xs text-muted-foreground">
                ≈{money(r.estimatePriceExVat)} <span className="text-ink-3">ex-VAT</span>
              </span>
              <Btn>Add</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Basket({ s }: { s: ConsoleState }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex items-center justify-between border-b border-divider px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>Basket · prices include VAT</span>
        <span data-numeric>{s.lines.length} lines</span>
      </div>
      {s.lines.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          Nothing added yet. Search above, or press <KeyCap>/</KeyCap>.
        </div>
      ) : (
        s.lines.map((l) => (
          <div key={l.lineId} className={`border-b border-divider px-4 py-2.5 ${l.unpriceable ? 'bg-danger-050' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{l.description}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span data-numeric>{l.itemNumber}</span>
                  <AtpPill atp={l.atpAtScan} compact />
                  <span className="text-ink-3">at add</span>
                  {l.unpriceable && <span className="font-medium text-danger-800">no price at 1204</span>}
                </div>
              </div>
              <input
                defaultValue={l.qty}
                data-numeric
                className="w-14 rounded border border-input bg-card px-2 py-1 text-center text-sm"
              />
              <span className="w-10 text-xs text-muted-foreground">{l.uom}</span>
              <Money v={l.lineTotalGross} />
              <button className="text-xs text-muted-foreground hover:text-danger-800">✕</button>
            </div>
            {l.promo && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-success-800">
                <Dot tone="good" /> {l.promo.description}
                <span data-numeric className="font-medium">
                  {money(l.promo.amount)}
                </span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

/** 138's region. A horizontal strip: it can grow taller, never wider — so it
 *  cannot steal the basket. Three classes, visually distinct. */
function PromoStrip({ s, expanded }: { s: ConsoleState; expanded: boolean }) {
  if (s.nearMisses.length === 0) return null
  const actionable = s.nearMisses.filter((n) => n.klass === 'actionable')
  return (
    <div className="max-h-64 shrink-0 overflow-auto border-t border-border-strong bg-card-2 px-4 py-2">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>Offers within reach</span>
        <span className="rounded-full bg-primary-050 px-1.5 text-primary-800" data-numeric>
          {actionable.length}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {s.nearMisses.map((n) => (
          <div
            key={n.offerId}
            className={`w-72 shrink-0 rounded-md border p-2.5 ${
              n.klass === 'actionable'
                ? 'border-primary-border bg-card'
                : n.klass === 'ready'
                  ? 'border-success-border bg-success-050'
                  : 'border-border bg-muted opacity-70'
            }`}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <span className="text-sm font-medium leading-tight">{n.description}</span>
              {n.klass === 'ready' && <span className="shrink-0 text-[10px] font-semibold uppercase text-success-800">applied</span>}
            </div>
            {n.klass === 'actionable' && (
              <>
                <div className="text-xs text-muted-foreground">
                  Add <span data-numeric className="font-semibold text-foreground">{n.progress.need - n.progress.have}</span> more
                  from {n.prereq.label} — <span data-numeric>{n.prereq.eligibleCount}</span> qualify
                </div>
                {expanded && n.items && (
                  <div className="mt-2 space-y-1 border-t border-divider pt-2">
                    {n.items.map((i) => (
                      <div key={i.itemNumber} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate">{i.description}</span>
                        <AtpPill atp={i.atp} compact />
                        <span data-numeric className="text-muted-foreground">
                          ≈{money(i.estimatePriceExVat)}
                        </span>
                        <button className="rounded border border-input px-1.5 py-0.5 hover:bg-accent">Add</button>
                      </div>
                    ))}
                    <button className="text-xs text-primary hover:underline">…and 39 more</button>
                  </div>
                )}
                {!expanded && (
                  <button className="mt-1.5 text-xs font-medium text-primary hover:underline">Show qualifying items</button>
                )}
              </>
            )}
            {n.klass === 'blocked' && (
              <div className="text-xs text-muted-foreground">
                Not evaluated for this basket ({n.skipReason}). Nothing you add here will fire it.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** CC2 finding 7 — the live receipt never goes below the fold. */
function Receipt({ s }: { s: ConsoleState }) {
  return (
    <aside className="flex min-h-0 flex-col bg-card">
      <div className="border-b border-divider px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        The caller pays
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {s.totals ? (
          <dl className="space-y-1.5 text-sm">
            <Row k="Items" v={<Money v={s.totals.net} tone="muted" />} />
            <Row k="VAT 15%" v={<Money v={s.totals.vat} tone="muted" />} />
            <Row
              k="Delivery"
              v={s.totals.feeWaived ? <span className="text-xs text-success-800">waived</span> : <Money v={s.totals.deliveryFee} tone="muted" />}
            />
            <div className="!mt-3 flex items-baseline justify-between border-t border-border-strong pt-3">
              <span className="text-sm font-semibold">Total</span>
              <Money v={s.totals.payable} size="lg" />
            </div>
          </dl>
        ) : (
          <div className="text-sm text-muted-foreground">No items yet.</div>
        )}
      </div>
      <div className="space-y-2 border-t border-divider p-4">
        {s.capabilities.submitBlockers.length > 0 && (
          <div className="text-xs text-attention-800">Needed first: {s.capabilities.submitBlockers.join(' · ')}</div>
        )}
        <button
          type="button"
          disabled={!s.capabilities.canSubmit || s.submitting}
          className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {s.submitting ? 'Placing the order…' : 'Place order'}
        </button>
        {s.submitting && (
          <div className="text-center text-[11px] text-muted-foreground">Don&apos;t close this window — the order number is on its way.</div>
        )}
      </div>
    </aside>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function BelowAtpSheet({ d }: { d: { itemNumber: string; description: string; requested: number; available: number; plant: string } }) {
  return (
    <Sheet
      tone="attention"
      title="More than the store has"
      footer={
        <>
          <Btn>Change the quantity</Btn>
          <Btn kind="primary">Add {d.requested} anyway</Btn>
        </>
      }
    >
      <p className="mb-3 text-sm">{d.description}</p>
      <div className="flex items-center gap-6 rounded-md bg-attention-050 p-4">
        <Num label="Asked for" v={d.requested} />
        <Num label={`At store ${d.plant}`} v={d.available} tone="attention" />
        <Num label="Short by" v={d.requested - d.available} tone="attention" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Accepting is recorded against this order with the numbers shown here.
      </p>
    </Sheet>
  )
}

function Num({ label, v, tone }: { label: string; v: number; tone?: 'attention' }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div data-numeric className={`text-2xl font-semibold ${tone ? 'text-attention-800' : ''}`}>
        {v}
      </div>
    </div>
  )
}

function RebindSheet({
  d,
}: {
  d: {
    fromPlant: string
    fromName: string
    toPlant: string
    toName: string
    lineDiffs: { lineId: string; description: string; fromGross: number; toGross: number }[]
    promotionsMoved: { offerId: string; description: string; fromAmount: number; toAmount: number }[]
    atpReFreeze: { lineId: string; fromQty: number; toQty: number; belowAfter: boolean }[]
  }
}) {
  return (
    <Sheet
      title={`Moving the order to ${d.toName} (${d.toPlant}) re-prices it`}
      footer={
        <>
          <Btn>Keep {d.fromName}</Btn>
          <Btn kind="primary">Move and re-price</Btn>
        </>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider text-start text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1 text-start font-medium">Line</th>
            <th className="py-1 text-end font-medium">{d.fromName}</th>
            <th className="py-1 text-end font-medium">{d.toName}</th>
          </tr>
        </thead>
        <tbody>
          {d.lineDiffs.map((l) => {
            const delta = l.toGross - l.fromGross
            return (
              <tr key={l.lineId} className="border-b border-divider">
                <td className="py-1.5">{l.description}</td>
                <td data-numeric className="py-1.5 text-end text-muted-foreground line-through">
                  {money(l.fromGross)}
                </td>
                <td data-numeric className={`py-1.5 text-end font-medium ${delta < 0 ? 'text-success-800' : delta > 0 ? 'text-danger-800' : ''}`}>
                  {money(l.toGross)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {d.promotionsMoved.map((p) => (
        <div key={p.offerId} className="mt-3 rounded-md bg-attention-050 p-2 text-xs text-attention-800">
          {p.description} is worth <span data-numeric>{money(p.toAmount)}</span> there instead of{' '}
          <span data-numeric>{money(p.fromAmount)}</span>.
        </div>
      ))}
      {d.atpReFreeze
        .filter((a) => a.belowAfter)
        .map((a) => (
          <div key={a.lineId} className="mt-2 rounded-md bg-danger-050 p-2 text-xs text-danger-800">
            {a.lineId}: only <span data-numeric>{a.toQty}</span> at {d.toName} (was {a.fromQty}) — the line will be below
            availability.
          </div>
        ))}
    </Sheet>
  )
}
