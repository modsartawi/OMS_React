/* PROTOTYPE — throwaway. Ticket 138.
 *
 * THE FURNITURE, NOT THE QUESTION. 135 already ruled the console: three fixed
 * columns, rails that never move, the centre the only thing that scrolls. This
 * file reproduces enough of variant A — customer rail, chip row, basket,
 * receipt — that the guidance region is judged AT ITS REAL DENSITY BUDGET
 * (135 amendment 2), against a basket competing for the same vertical space.
 *
 * Everything here is settled. The only argument is what `guidance` renders.
 */
import type { ReactNode } from 'react'
import { AtpPill, KeyCap, Money } from '../parts'
import { money } from '../mock-state'
import type { GuidanceState } from './guidance-mock'

const LINES = [
  {
    lineId: 'L1',
    itemNumber: '100001',
    description: 'Panadol Extra 500mg — 24 tabs',
    qty: 2,
    uom: 'EA',
    lineTotalGross: 27.6,
    atp: { qty: 5, known: true },
    promo: { description: '70% off 2nd piece', amount: -8.4 },
  },
  {
    lineId: 'L2',
    itemNumber: '100455',
    description: 'Sensodyne Repair & Protect 75ml',
    qty: 1,
    uom: 'EA',
    lineTotalGross: 32.2,
    atp: { qty: 18, known: true },
    promo: null,
  },
]

const TOTALS = { net: 44.7, vat: 6.7, deliveryFee: 15, payable: 66.4 }

export default function HostConsole({
  s,
  actionableCount,
  guidance,
}: {
  s: GuidanceState
  actionableCount: number
  guidance: ReactNode
}) {
  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* 135 amendment 2: the actionable count is mirrored in the top bar, so an
          offer that arrives while the agent is reading search results still
          announces itself. */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border-strong bg-card px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">New order</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">CLCN · cash</span>
          {actionableCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-primary-border bg-primary-050 px-2 py-0.5 text-[11px] font-medium text-primary-800">
              <span data-numeric>{actionableCount}</span>
              {actionableCount === 1 ? 'offer within reach' : 'offers within reach'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyCap>Ctrl</KeyCap>
          <KeyCap>K</KeyCap>
          <span>commands</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px]">
        <CustomerRail />

        <main className="flex min-h-0 min-w-0 flex-col border-x border-border">
          <ChipRow />
          <SearchBox />
          <Basket />
          {guidance}
        </main>

        <Receipt />
      </div>

      {/* 787-C absence is a property of the whole surface, not of one card, so
          the variants each answer it in their own region — never here. */}
      <span className="sr-only">{s.getSideAbsent ? 'get-side guidance absent' : 'full coverage'}</span>
    </div>
  )
}

function CustomerRail() {
  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-auto bg-sidebar p-4">
      <div>
        <div className="text-sm font-semibold leading-tight">Fatima Al-Harbi</div>
        <div data-numeric className="text-xs text-muted-foreground">
          +966 55 214 8890
        </div>
      </div>
      <dl className="space-y-2 text-xs">
        <Field k="Customer" v="0001234567" />
        <Field k="Loyalty" v="Gold · 4,120 pts" />
        <Field k="Orders" v="11" />
      </dl>
      <div className="rounded-md border border-border bg-card p-2.5">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Delivering to</div>
        <div className="text-xs font-medium">Home</div>
        <div className="text-xs text-muted-foreground">Villa 22, Anas Ibn Malik Rd</div>
        <div className="text-xs text-muted-foreground">Al Malqa · Riyadh</div>
      </div>
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

function ChipRow() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-divider bg-card-2 px-4 py-2">
      <Chip label="Al Malqa (1101)" note="from address" />
      <Chip label="Today 18:00–21:00" />
      <Chip label="CALL CENTER · CRM-889231" />
    </div>
  )
}

function Chip({ label, note }: { label: string; note?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
      <span className="font-medium">{label}</span>
      {note && <span className="text-ink-3">({note})</span>}
    </span>
  )
}

function SearchBox() {
  return (
    <div className="shrink-0 border-b border-divider px-4 py-2">
      <input
        placeholder="Search items — name, Arabic, or item number"
        className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none"
      />
    </div>
  )
}

function Basket() {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {LINES.map((l) => (
        <div key={l.lineId} className="border-b border-divider px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{l.description}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span data-numeric>{l.itemNumber}</span>
                <AtpPill atp={l.atp} compact />
                <span className="text-ink-3">at add</span>
              </div>
            </div>
            <span data-numeric className="w-8 text-center text-sm">
              {l.qty}
            </span>
            <span className="w-8 text-xs text-muted-foreground">{l.uom}</span>
            <Money v={l.lineTotalGross} />
          </div>
          {l.promo && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-success-800">
              <span className="inline-block size-1.5 rounded-full bg-success" aria-hidden /> {l.promo.description}
              <span data-numeric className="font-medium">
                {money(l.promo.amount)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Receipt() {
  return (
    <aside className="flex min-h-0 flex-col bg-card">
      <div className="border-b border-divider px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        The caller pays
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <dl className="space-y-1.5 text-sm">
          <Row k="Items" v={<Money v={TOTALS.net} tone="muted" />} />
          <Row k="VAT 15%" v={<Money v={TOTALS.vat} tone="muted" />} />
          <Row k="Delivery" v={<Money v={TOTALS.deliveryFee} tone="muted" />} />
          <div className="!mt-3 flex items-baseline justify-between border-t border-border-strong pt-3">
            <span className="text-sm font-semibold">Total</span>
            <Money v={TOTALS.payable} size="lg" />
          </div>
        </dl>
      </div>
      <div className="border-t border-divider p-4">
        <button
          type="button"
          className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Place order
        </button>
      </div>
    </aside>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
