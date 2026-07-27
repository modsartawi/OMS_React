/* PROTOTYPE — throwaway. Ticket 135, variant B.
 *
 * "CENTRE STAGE." The opposite bet from A: there are no rails. Everything the
 * agent has settled — caller, address, store, slot, source — collapses into a
 * single chip bar at the top (CC2 finding 9, taken to its limit), leaving one
 * very wide basket as the whole screen. Near-misses are cards INTERLEAVED in
 * the basket flow, where the eye already is. The receipt is a fixed money bar
 * along the bottom, so it is unmissable without owning a column.
 *
 * Confirmations are INLINE cards at the head of the flow, never modals — the
 * bet being that a modal mid-call is worse than a card the agent can look past.
 *
 * Ex-VAT treatment (131): search rows carry NO bare number. The estimate hides
 * behind a dotted "est." chip that must be read deliberately.
 */
import type { ConsoleState, NearMiss, Pending } from './mock-state'
import { money } from './mock-state'
import { AtpPill, Btn, Dot, KeyCap, Money } from './parts'

export const NAME = 'Centre stage, everything collapses'

export default function VariantB({ s, scenarioKey }: { s: ConsoleState; scenarioKey: string }) {
  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <ChipBar s={s} />
      {s.busy && (
        <div className="shrink-0 bg-primary-050 px-4 py-1 text-center text-xs text-primary-800">
          Locked by another request — retrying {s.busy.attempt}/{s.busy.ceiling}. Keep going.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <IconRail />
        <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-col px-6">
          <SearchBox s={s} />
          <div className="min-h-0 flex-1 overflow-auto py-3">
            {s.refusal && <InlineRefusal code={s.refusal.code} message={s.refusal.message} lines={s.refusal.lines} />}
            {s.pending && <InlineConfirm p={s.pending} />}
            {!s.customer && <FirstStep />}
            {s.customer && !s.address && <NeedAddress />}
            <Flow s={s} expanded={scenarioKey === 'prereq'} />
          </div>
        </main>
      </div>

      <MoneyBar s={s} />
    </div>
  )
}

function ChipBar({ s }: { s: ConsoleState }) {
  return (
    <header className="flex h-12 shrink-0 flex-wrap items-center gap-1.5 border-b border-border-strong bg-card px-4">
      <span className="me-1 text-sm font-semibold">New order</span>
      <Pill v={s.customer ? s.customer.name : 'no caller'} sub={s.customer?.mobile} warn={!s.customer} />
      <Pill v={s.address ? `${s.address.label} · ${s.address.districtName}` : 'no address'} warn={!s.address} />
      <Pill v={s.plant ? `${s.plant.code} ${s.plant.name}` : 'no store'} sub={s.plant ? 'derived' : undefined} warn={!s.plant} />
      <Pill v={s.slot?.label ?? 'no slot'} warn={!s.slot} />
      <Pill v={s.sourceReference ?? 'no ref'} warn={!s.sourceReference} />
      <div className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <KeyCap>Ctrl</KeyCap>
        <KeyCap>K</KeyCap>
      </div>
    </header>
  )
}

function Pill({ v, sub, warn }: { v: string; sub?: string; warn?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        warn ? 'border-dashed border-attention-border bg-attention-050 text-attention-800' : 'border-border bg-muted'
      }`}
    >
      <span className="font-medium">{v}</span>
      {sub && (
        <span data-numeric className="text-[10px] text-muted-foreground">
          {sub}
        </span>
      )}
      <span aria-hidden className="opacity-40">
        ▾
      </span>
    </button>
  )
}

/** Everything that is not the basket lives behind an icon. */
function IconRail() {
  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-e border-border bg-sidebar py-3">
      {['👤', '📍', '🏬', '🕒', '🎟', '?'].map((g, i) => (
        <button
          key={g}
          className={`flex size-9 items-center justify-center rounded-md text-base hover:bg-sidebar-accent ${i === 0 ? 'bg-sidebar-accent' : ''}`}
          aria-label={`panel ${i + 1}`}
        >
          <span aria-hidden>{g}</span>
        </button>
      ))}
    </nav>
  )
}

function SearchBox({ s }: { s: ConsoleState }) {
  return (
    <div className="shrink-0 pt-4">
      <input
        autoFocus={!s.customer}
        defaultValue={s.search?.query ?? ''}
        placeholder={s.customer ? 'Add an item…' : "Caller's mobile number…"}
        className="w-full rounded-lg border-2 border-input bg-card px-4 py-3 text-base outline-none focus:border-primary"
      />
      {s.search && (
        <div className="mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
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
              {/* the estimate is deliberately NOT rendered as a number in the row */}
              <span
                title={`Catalogue estimate ${money(r.estimatePriceExVat)} before VAT — not the price the caller pays`}
                className="cursor-help rounded border border-dashed border-input px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                est. price
              </span>
              <Btn>Add</Btn>
            </div>
          ))}
          <div className="bg-muted px-3 py-1 text-[11px] text-muted-foreground">
            Estimates exclude VAT. Add the item to see what the caller pays.
          </div>
        </div>
      )}
    </div>
  )
}

function FirstStep() {
  return (
    <div className="rounded-lg border border-dashed border-input p-8 text-center">
      <div className="text-sm font-medium">Start with the caller&apos;s mobile number</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Press <KeyCap>Enter</KeyCap> to look them up. Items can be added before the address, but the address sets the
        store — so it is cheaper first.
      </div>
    </div>
  )
}

function NeedAddress() {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary-border bg-primary-050 p-3">
      <div className="flex-1 text-sm text-primary-800">
        <span className="font-medium">Next: pick the delivery address.</span> It decides which store fulfils and prices
        the order.
      </div>
      <Btn kind="primary">Address book</Btn>
    </div>
  )
}

function InlineRefusal({ code, message, lines }: { code: string; message: string; lines?: string[] }) {
  return (
    <div className="mb-3 rounded-lg border-2 border-danger-border bg-danger-050 p-3">
      <div className="text-sm font-semibold text-danger-800">{message}</div>
      {lines?.map((l) => (
        <div key={l} className="mt-1 text-xs text-danger-800">
          {l}
        </div>
      ))}
      <div className="mt-2 flex gap-2">
        <Btn kind="danger">Void that line</Btn>
        <Btn>Dismiss</Btn>
      </div>
      <div className="mt-1 text-[11px] text-danger-800/70">{code}</div>
    </div>
  )
}

/** B's bet: confirmations are cards in the flow, not modals. */
function InlineConfirm({ p }: { p: Pending }) {
  if (p.kind === 'belowAtp')
    return (
      <div className="mb-3 rounded-lg border-2 border-attention-border bg-attention-050 p-3">
        <div className="text-sm font-semibold text-attention-800">
          {p.detail.description}: you asked for <span data-numeric>{p.detail.requested}</span>, store {p.detail.plant}{' '}
          has <span data-numeric>{p.detail.available}</span>
        </div>
        <div className="mt-1 text-xs text-attention-800">
          Adding anyway is allowed and is recorded on the order with these numbers.
        </div>
        <div className="mt-2 flex gap-2">
          <Btn kind="primary">Add {p.detail.requested} anyway</Btn>
          <Btn>Reduce to {p.detail.available}</Btn>
          <Btn>Cancel</Btn>
        </div>
      </div>
    )
  return (
    <div className="mb-3 rounded-lg border-2 border-primary-border bg-card p-3">
      <div className="text-sm font-semibold">
        Move to {p.detail.toName} ({p.detail.toPlant})? Every line re-prices.
      </div>
      <div className="mt-2 space-y-1">
        {p.detail.lineDiffs.map((l) => (
          <div key={l.lineId} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate">{l.description}</span>
            <span data-numeric className="text-muted-foreground line-through">
              {money(l.fromGross)}
            </span>
            <span data-numeric className={`font-medium ${l.toGross < l.fromGross ? 'text-success-800' : ''}`}>
              {money(l.toGross)}
            </span>
          </div>
        ))}
        {p.detail.promotionsMoved.map((m) => (
          <div key={m.offerId} className="text-xs text-attention-800">
            {m.description}: <span data-numeric>{money(m.fromAmount)}</span> → <span data-numeric>{money(m.toAmount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Btn kind="primary">Move and re-price</Btn>
        <Btn>Keep {p.detail.fromName}</Btn>
      </div>
    </div>
  )
}

/** Lines and offer cards share one vertical flow. */
function Flow({ s, expanded }: { s: ConsoleState; expanded: boolean }) {
  const actionable = s.nearMisses.filter((n) => n.klass === 'actionable')
  const other = s.nearMisses.filter((n) => n.klass !== 'actionable')
  return (
    <div>
      {s.lines.map((l) => (
        <div key={l.lineId} className={`mb-1.5 rounded-lg border bg-card p-3 ${l.unpriceable ? 'border-danger-border' : 'border-border'}`}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{l.description}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span data-numeric>{l.itemNumber}</span>
                <AtpPill atp={l.atpAtScan} compact />
                <span className="text-ink-3">frozen at add</span>
              </div>
            </div>
            <input defaultValue={l.qty} data-numeric className="w-14 rounded border border-input bg-card px-2 py-1 text-center text-sm" />
            <Money v={l.lineTotalGross} size="lg" />
            <button className="text-muted-foreground hover:text-danger-800">✕</button>
          </div>
          {l.promo && (
            <div className="mt-1.5 flex items-center gap-1.5 border-t border-divider pt-1.5 text-xs text-success-800">
              <Dot tone="good" /> {l.promo.description} <span data-numeric>{money(l.promo.amount)}</span>
            </div>
          )}
        </div>
      ))}

      {actionable.map((n) => (
        <OfferCard key={n.offerId} n={n} expanded={expanded} />
      ))}

      {other.length > 0 && (
        <div className="mt-2 space-y-1">
          {other.map((n) => (
            <div key={n.offerId} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground">
              {n.klass === 'ready' ? <Dot tone="good" /> : <Dot tone="idle" />}
              <span>{n.description}</span>
              <span className="text-ink-3">
                {n.klass === 'ready' ? 'already applied' : `not evaluated · ${n.skipReason}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OfferCard({ n, expanded }: { n: NearMiss; expanded: boolean }) {
  return (
    <div className="mb-1.5 rounded-lg border-2 border-dashed border-primary-border bg-primary-050/50 p-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">offer</span>
        <span className="text-sm font-medium">{n.description}</span>
        <span className="ms-auto text-xs text-muted-foreground">
          <span data-numeric className="font-semibold text-foreground">
            {n.progress.have}
          </span>
          /<span data-numeric>{n.progress.need}</span>
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        One more from <span className="font-medium text-foreground">{n.prereq.label}</span> and it applies.{' '}
        <span data-numeric>{n.prereq.eligibleCount}</span> items qualify.
      </div>
      {expanded && n.items && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {n.items.map((i) => (
            <button key={i.itemNumber} className="rounded-md border border-border bg-card p-2 text-start hover:border-primary">
              <div className="truncate text-xs font-medium">{i.description}</div>
              <div className="mt-1 flex items-center justify-between">
                <AtpPill atp={i.atp} compact />
                <span className="text-[11px] text-primary">Add</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {!expanded && <button className="mt-1.5 text-xs font-medium text-primary hover:underline">Show the 42 items</button>}
    </div>
  )
}

function MoneyBar({ s }: { s: ConsoleState }) {
  return (
    <footer className="flex h-16 shrink-0 items-center gap-6 border-t-2 border-border-strong bg-card px-6">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">The caller pays</div>
      {s.totals ? (
        <>
          <Money v={s.totals.payable} size="lg" />
          <div className="text-xs text-muted-foreground">
            <span data-numeric>{money(s.totals.net)}</span> items ·{' '}
            <span data-numeric>{money(s.totals.vat)}</span> VAT ·{' '}
            <span data-numeric>{money(s.totals.deliveryFee)}</span> delivery
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">Empty basket</div>
      )}
      <div className="ms-auto flex items-center gap-3">
        {s.capabilities.submitBlockers.length > 0 && (
          <span className="text-xs text-attention-800">{s.capabilities.submitBlockers.join(' · ')}</span>
        )}
        <button
          disabled={!s.capabilities.canSubmit || s.submitting}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {s.submitting ? 'Placing…' : 'Place order'}
        </button>
      </div>
    </footer>
  )
}
