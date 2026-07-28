/* PROTOTYPE — throwaway. Ticket 175 (+176, 155).
 *
 * The controls each capture surface needs, drawn ONCE so the three variants are
 * compared on ARRANGEMENT rather than on who drew the nicer date picker — 135's
 * discipline. The one deliberate exception is the store picker, which gets three
 * genuinely different shapes (`StorePicker` `shape` prop), because "how does an
 * agent choose a store out of the whole estate" is itself an open question here.
 */
import { useState, type ReactNode } from 'react'
import {
  DOCUMENT_SOURCES,
  RECENT_STORE_CODES,
  SLOT_DAYS,
  STORES,
  type HeaderState,
  type Mode,
  type Payment,
  type Store,
} from './header-mock'

/* ---------------------------------------------------------------- atoms ---- */

export function Chip({
  label,
  note,
  tone = 'settled',
  onClick,
}: {
  label: string
  note?: string
  tone?: 'settled' | 'attention' | 'unset'
  onClick?: () => void
}) {
  const c =
    tone === 'attention'
      ? 'border-attention-border bg-attention-050 text-attention-800'
      : tone === 'unset'
        ? 'border-dashed border-border-strong bg-card text-muted-foreground'
        : 'border-border bg-card text-foreground'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${c}`}
    >
      <span className="font-medium">{label}</span>
      {note && <span className="opacity-70">({note})</span>}
    </button>
  )
}

export function Btn({
  children,
  kind = 'ghost',
  wide = false,
  disabled = false,
}: {
  children: ReactNode
  kind?: 'primary' | 'ghost' | 'danger'
  wide?: boolean
  disabled?: boolean
}) {
  const c =
    kind === 'primary'
      ? 'bg-primary text-primary-foreground hover:bg-primary-800'
      : kind === 'danger'
        ? 'border border-danger-border bg-danger-050 text-danger-800'
        : 'border border-input bg-card text-foreground hover:bg-accent'
  return (
    <button
      type="button"
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-45 ${c} ${wide ? 'w-full' : ''}`}
    >
      {children}
    </button>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-sm font-semibold">{children}</h3>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

/* ---------------------------------------------------- fulfilment (176) ---- */

/**
 * The mode is a QUESTION THE AGENT ASKS OUT LOUD ("delivering, or collecting?"),
 * so it is drawn as two full-sentence options rather than a toggle switch — a
 * switch has a default, and a default here is a guess about the caller.
 */
export function FulfilmentChoice({ mode }: { mode: Mode }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          { k: 'Delivery' as const, title: 'Deliver to the caller', sub: 'Their address decides the store' },
          { k: 'PickInStore' as const, title: 'They collect in store', sub: 'You choose the store · no address, no slot' },
        ]
      ).map((o) => {
        const on = mode === o.k
        return (
          <button
            key={o.k}
            type="button"
            className={`rounded-md border p-3 text-start ${
              on ? 'border-primary-border bg-primary-050 ring-1 ring-primary-border' : 'border-input bg-card hover:bg-accent'
            }`}
          >
            <div className={`text-sm font-medium ${on ? 'text-primary-800' : ''}`}>{o.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{o.sub}</div>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------- the store, 3 shapes ---- */

const byCode = (c: string) => STORES.find((s) => s.code === c)

/**
 * `shape` is the open question:
 *   grouped  — search + city-grouped list, recents pinned. CC2's GetStoreAreas() parity.
 *   palette  — one input, ranked flat results, keyboard-first. Agents type while talking.
 *   drill    — city first, then store. Fewest choices on screen at any moment.
 */
export function StorePicker({
  shape,
  seeded,
  chosen,
}: {
  shape: 'grouped' | 'palette' | 'drill'
  seeded: string
  chosen?: string
}) {
  if (shape === 'grouped') return <StoreGrouped seeded={seeded} chosen={chosen} />
  if (shape === 'palette') return <StorePalette seeded={seeded} chosen={chosen} />
  return <StoreDrill seeded={seeded} chosen={chosen} />
}

/** The one-click confirm 175 rules PICKUP-ONLY: the store the agent is sitting
 *  in is the answer on most collection calls, and re-picking it is a keystroke
 *  that buys nothing. It is `setStore(currentPlant)` — the existing verb. */
function ConfirmSeeded({ seeded }: { seeded: string }) {
  const s = byCode(seeded)
  if (!s) return null
  return (
    <div className="mb-3 rounded-md border border-primary-border bg-primary-050 p-3">
      <div className="mb-2 text-xs text-primary-800">You are signed in at this store</div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{s.name}</div>
          <div data-numeric className="text-xs text-muted-foreground">
            {s.code} · {s.district}, {s.city}
          </div>
        </div>
        <Btn kind="primary">Yes, collect here</Btn>
      </div>
    </div>
  )
}

function StoreRow({ s, on }: { s: Store; on: boolean }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-start ${
        on ? 'bg-primary-050 ring-1 ring-primary-border' : 'hover:bg-accent'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm">{s.name}</span>
        <span data-numeric className="block text-xs text-muted-foreground">
          {s.district}
        </span>
      </span>
      <span data-numeric className="shrink-0 text-xs text-muted-foreground">
        {s.code}
      </span>
    </button>
  )
}

/** One input, three fields: code first, then name, then district. */
function StoreSearch() {
  const [q, setQ] = useState('')
  const digits = /^\d+$/.test(q.trim())
  const hits = q.trim()
    ? STORES.filter(
        (s) =>
          s.code.startsWith(q.trim()) ||
          s.name.toLowerCase().includes(q.trim().toLowerCase()) ||
          s.district.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : []
  return (
    <div className="mb-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Store number, name, or district — e.g. 1204 or Yasmin"
        className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none"
      />
      {q.trim() && (
        <div className="mt-1 rounded-md border border-border-strong bg-card">
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No store matches “{q}”.</p>
          ) : (
            hits.map((h) => (
              <button
                key={h.code}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start hover:bg-accent"
              >
                <span className="text-sm">{h.name}</span>
                <span data-numeric className={`text-xs ${digits ? 'font-semibold text-primary-800' : 'text-muted-foreground'}`}>
                  {h.code}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function StoreGrouped({ seeded, chosen }: { seeded: string; chosen?: string }) {
  const cities = [...new Set(STORES.map((s) => s.city))]
  return (
    <div>
      <ConfirmSeeded seeded={seeded} />
      {/* 🚩 Code search is not a nicety: most agents know their stores by
          NUMBER, so a digit typed here must match the code before it matches
          anything else. `1204` is a faster, surer answer than "Al Yasmin". */}
      <StoreSearch />
      <div className="max-h-64 overflow-auto rounded-md border border-border">
        <div className="border-b border-divider bg-card-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recent
        </div>
        {RECENT_STORE_CODES.map((c) => {
          const s = byCode(c)
          return s ? <StoreRow key={`r-${c}`} s={s} on={chosen === c} /> : null
        })}
        {cities.map((city) => (
          <div key={city}>
            <div className="border-y border-divider bg-card-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {city}
            </div>
            {STORES.filter((s) => s.city === city).map((s) => (
              <StoreRow key={s.code} s={s} on={chosen === s.code} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function StorePalette({ seeded, chosen }: { seeded: string; chosen?: string }) {
  const hits = STORES.filter((s) => s.city === 'Riyadh')
  return (
    <div>
      <ConfirmSeeded seeded={seeded} />
      <div className="rounded-md border border-border-strong bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <span className="text-muted-foreground">⌕</span>
          <input
            defaultValue="riyadh"
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Type a store, district or code"
          />
          <kbd className="rounded border border-border-strong bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ↵
          </kbd>
        </div>
        <div className="max-h-56 overflow-auto py-1">
          {hits.map((s, i) => (
            <div key={s.code} className={`mx-1 rounded-md ${i === 0 ? 'bg-primary-050 ring-1 ring-primary-border' : ''}`}>
              <StoreRow s={s} on={chosen === s.code} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-divider px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>↑↓ move</span>
          <span>↵ choose</span>
          <span data-numeric>{hits.length} of {STORES.length} stores</span>
        </div>
      </div>
    </div>
  )
}

function StoreDrill({ seeded, chosen }: { seeded: string; chosen?: string }) {
  const [city, setCity] = useState<string | null>('Riyadh')
  const cities = [...new Set(STORES.map((s) => s.city))]
  return (
    <div>
      <ConfirmSeeded seeded={seeded} />
      {!city ? (
        <div className="grid grid-cols-3 gap-2">
          {cities.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCity(c)}
              className="rounded-md border border-input bg-card px-3 py-4 text-sm font-medium hover:bg-accent"
            >
              {c}
              <span data-numeric className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {STORES.filter((s) => s.city === c).length} stores
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setCity(null)}
            className="mb-2 text-xs text-primary-800 hover:underline"
          >
            ← All cities
          </button>
          <div className="grid grid-cols-2 gap-2">
            {STORES.filter((s) => s.city === city).map((s) => (
              <button
                key={s.code}
                type="button"
                className={`rounded-md border p-3 text-start ${
                  chosen === s.code ? 'border-primary-border bg-primary-050' : 'border-input bg-card hover:bg-accent'
                }`}
              >
                <div className="text-sm font-medium">{s.name}</div>
                <div data-numeric className="text-xs text-muted-foreground">
                  {s.code} · {s.district}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- slot (when) ---- */

/**
 * Days across, windows down — `SlotsController`'s own two-level shape. An
 * INACTIVE window is shown struck rather than dropped: WPF drops it, but
 * "there is no evening slot today" and "the evening is full" are different
 * sentences to say to a caller, and only one of them is true.
 */
export function SlotPicker({ chosen }: { chosen?: string }) {
  const [day, setDay] = useState(SLOT_DAYS[0].day)
  const active = SLOT_DAYS.find((d) => d.day === day) ?? SLOT_DAYS[0]
  return (
    <div>
      <div className="mb-2 flex gap-1.5">
        {SLOT_DAYS.map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setDay(d.day)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              d.day === day ? 'border-primary-border bg-primary-050 text-primary-800' : 'border-input bg-card hover:bg-accent'
            }`}
          >
            {d.description}
            <span data-numeric className="ms-1.5 opacity-60">
              {d.times.filter((t) => t.isActive).length}
            </span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {active.times.map((t) => (
          <button
            key={t.slotId}
            type="button"
            disabled={!t.isActive}
            className={`rounded-md border px-3 py-2 text-start text-sm ${
              chosen === t.slotId
                ? 'border-primary-border bg-primary-050 text-primary-800'
                : t.isActive
                  ? 'border-input bg-card hover:bg-accent'
                  : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            <span data-numeric className={t.isActive ? 'font-medium' : 'font-medium line-through'}>
              {t.from}–{t.to}
            </span>
            {!t.isActive && <span className="ms-2 text-xs">full</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        A slot is a soft gate on a call-centre order — it can lapse without stopping the order being placed (§7).
      </p>
    </div>
  )
}

/* ------------------------------------------- source + reference (capture) --- */

/** The source DECIDES two other things: whether a reference is mandatory, and
 *  (P2E) whether the payment pair is locked. Drawn together for that reason. */
export function SourceCapture({ s }: { s: HeaderState }) {
  const src = DOCUMENT_SOURCES.find((d) => d.code === s.documentSource)
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Where did this order come from?</label>
        <div className="flex flex-wrap gap-1.5">
          {DOCUMENT_SOURCES.map((d) => (
            <button
              key={d.code}
              type="button"
              className={`rounded-md border px-3 py-1.5 text-sm ${
                d.code === s.documentSource
                  ? 'border-primary-border bg-primary-050 text-primary-800'
                  : 'border-input bg-card hover:bg-accent'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Reference {src?.requiresReference && <span className="text-attention-800">· required for {src.label}</span>}
        </label>
        <input
          defaultValue={s.sourceReference ?? ''}
          placeholder="Case or ticket number"
          className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none"
        />
      </div>
      {src?.forcesOnline && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800">
          {src.label} orders are paid before delivery, so the payment type is locked to <b>Paid online</b>.
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------- payment type (155) ----- */

/** 155 — drawn nowhere in the console today. `Cc2DocumentHeaderBuilder.cs:36-38`
 *  writes it onto the CLCN header, and CC2 locks the pair while a P2E source is
 *  selected (`IsPaymentForced`). A lock that does not say WHY reads as broken. */
export function PaymentChoice({ value, forced, reason }: { value: Payment | null; forced: boolean; reason?: string }) {
  const opts: { k: Payment; title: string; sub: string }[] = [
    { k: 'CashOnDelivery', title: 'Cash on delivery', sub: 'The driver collects on the doorstep' },
    { k: 'PaidOnline', title: 'Paid online', sub: 'A payment link, settled before dispatch' },
  ]
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o) => {
          const on = value === o.k
          const off = forced && !on
          return (
            <button
              key={o.k}
              type="button"
              disabled={off}
              className={`rounded-md border p-3 text-start ${
                on
                  ? 'border-primary-border bg-primary-050 ring-1 ring-primary-border'
                  : off
                    ? 'border-border bg-muted opacity-50'
                    : 'border-input bg-card hover:bg-accent'
              }`}
            >
              <div className={`text-sm font-medium ${on ? 'text-primary-800' : ''}`}>{o.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{o.sub}</div>
            </button>
          )
        })}
      </div>
      {forced && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-attention-800">
          <span aria-hidden>🔒</span> {reason ?? 'Locked by the order source.'}
        </p>
      )}
    </div>
  )
}
