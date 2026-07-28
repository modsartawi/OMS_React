/* PROTOTYPE — throwaway. Ticket 175, the keyboard-first add.
 *
 * INTERACTIVE — actually type into it. This is the one part of the prototype a
 * screenshot cannot argue, because the whole claim is about what the agent's
 * hands do while they are talking.
 *
 * THE LOOP: type → the top hit is already selected → Enter → the line lands, the
 * list closes, the query clears, the caret never moves. `↓` exists only for
 * "no, the other one". A line costs one word and one Enter.
 *
 * Five rules that are not decoration:
 *
 *  1. THE TOP HIT IS PRE-SELECTED. Requiring `↓` first taxes every line of every
 *     call to serve the minority case where the top hit is wrong.
 *  2. QUANTITY RIDES THE SAME LINE — `3*panadol` or `panadol*3`. Callers say
 *     "three boxes"; an add-then-change-quantity costs two round trips to the
 *     basket and takes the agent's eyes off the search.
 *  3. 🚩 ENTER IS INERT WHILE THE LIST IS UNSETTLED. An agent types faster than
 *     the server answers, and an Enter landing against a stale list adds the
 *     WRONG MEDICINE to a real order. This is the one failure here that is
 *     expensive, so the affordance is explicit: the hint says "…" and Enter does
 *     nothing rather than something plausible.
 *  4. THE VANISHING LIST IS NOT THE FEEDBACK — THE LANDED LINE IS. Closing the
 *     list only proves the keystroke registered. What landed, at what quantity,
 *     is a separate statement with an undo on it (172's ruling, at keyboard speed).
 *  5. THE SAME LINE IS THE COMMAND LINE. A leading `/` swaps items for header
 *     verbs, so the store, the slot, the source and the payment type are all
 *     reachable without the mouse — 153's grammar with no second surface.
 */
import { useEffect, useRef, useState } from 'react'
import { CATALOGUE, VERBS, type Catalogue, type OpenSurface } from './header-mock'

export type Landed = { itemNumber: string; description: string; qty: number }

/** `3*panadol` and `panadol*3` both mean three. A bare query means one. */
function parse(raw: string): { qty: number; term: string } {
  const lead = raw.match(/^\s*(\d+)\s*\*\s*(.*)$/)
  if (lead) return { qty: Math.max(1, Number(lead[1])), term: lead[2].trim() }
  const trail = raw.match(/^(.*?)\s*\*\s*(\d+)\s*$/)
  if (trail) return { qty: Math.max(1, Number(trail[2])), term: trail[1].trim() }
  return { qty: 1, term: raw.trim() }
}

export default function ItemCommandLine({
  onAdd,
  onVerb,
  landed,
  onUndo,
}: {
  onAdd: (item: Catalogue, qty: number) => void
  onVerb: (surface: OpenSurface) => void
  landed: Landed | null
  onUndo: () => void
}) {
  const [raw, setRaw] = useState('')
  const [cursor, setCursor] = useState(0)
  // Stands in for the round trip. Real life: `isFetching` on the search query.
  const [settling, setSettling] = useState(false)
  const box = useRef<HTMLInputElement>(null)

  const verbMode = raw.trimStart().startsWith('/')
  const { qty, term } = parse(raw)

  const verbs = VERBS.filter((v) => v.cmd.startsWith(raw.trim().toLowerCase()))
  const items: Catalogue[] = term.length < 2
    ? []
    : CATALOGUE.filter(
        (c) =>
          c.description.toLowerCase().includes(term.toLowerCase()) ||
          c.arabic.includes(term) ||
          c.itemNumber.startsWith(term),
      ).slice(0, 6)

  const rows: number = verbMode ? verbs.length : items.length
  const ready = rows > 0 && !settling

  useEffect(() => {
    setCursor(0)
    if (!raw.trim()) return
    setSettling(true)
    const t = setTimeout(() => setSettling(false), 220)
    return () => clearTimeout(t)
  }, [raw])

  // Ctrl+Z undoes the last add from wherever the hands are (rule 4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && landed) {
        e.preventDefault()
        onUndo()
        box.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [landed, onUndo])

  const commit = () => {
    if (!ready) return
    if (verbMode) {
      onVerb(verbs[cursor].surface as OpenSurface)
    } else {
      onAdd(items[cursor], qty)
    }
    // The caret never moves and the query is gone — the next item can start
    // being typed before the agent has finished saying "and".
    setRaw('')
    setCursor(0)
  }

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (rows ? (c + 1) % rows : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (rows ? (c - 1 + rows) % rows : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setRaw('')
    }
  }

  return (
    <div className="relative shrink-0 border-y border-divider bg-card px-4 py-2">
      <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 focus-within:border-primary-border">
        <span className="text-muted-foreground" aria-hidden>
          {verbMode ? '›' : '⌕'}
        </span>
        <input
          ref={box}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={key}
          placeholder="Item name, Arabic, or number  ·  3*panadol for three  ·  / for commands"
          className="w-full bg-transparent text-sm outline-none"
        />
        {qty > 1 && !verbMode && (
          <span data-numeric className="rounded bg-primary-050 px-1.5 py-0.5 text-xs font-semibold text-primary-800">
            ×{qty}
          </span>
        )}
        {/* Rule 3, made visible. An agent must be able to SEE that Enter is
            currently inert, or an inert Enter reads as a dropped keystroke. */}
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {settling && raw.trim() ? '…' : ready ? '↵ add' : ''}
        </span>
      </div>

      {rows > 0 && (
        <div className="absolute inset-x-4 top-full z-20 -mt-1 overflow-hidden rounded-md border border-border-strong bg-card shadow-lg">
          {verbMode
            ? verbs.map((v, i) => (
                <div
                  key={v.cmd}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${i === cursor ? 'bg-primary-050' : ''}`}
                >
                  <span data-numeric className="font-medium text-primary-800">
                    {v.cmd}
                  </span>
                  <span className="text-muted-foreground">{v.label}</span>
                </div>
              ))
            : items.map((c, i) => (
                <div
                  key={c.itemNumber}
                  className={`flex items-center gap-3 px-3 py-2 ${i === cursor ? 'bg-primary-050' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{c.description}</div>
                    {/* 135 amendment 1: the estimate lives on the SECOND LINE
                        beside the item number, never in a money column, and it
                        never carries a currency word. A number that cannot
                        appear as money cannot be misread as money. */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span data-numeric>{c.itemNumber}</span>
                      <span>{c.arabic}</span>
                      <span data-numeric className="text-ink-3">
                        ≈{c.estimateExVat.toFixed(2)} ex-VAT
                      </span>
                    </div>
                  </div>
                  <Atp qty={c.atp} />
                </div>
              ))}
          <div className="flex items-center gap-3 border-t border-divider bg-card-2 px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>↑↓ choose</span>
            <span>↵ add</span>
            <span>esc clear</span>
          </div>
        </div>
      )}

      {/* Rule 4: what landed, said out loud, with a way back. */}
      {landed && rows === 0 && (
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-success-border bg-success-050 px-3 py-1.5 text-xs text-success-800">
          <span aria-hidden>✓</span>
          <span>
            Added <span data-numeric className="font-semibold">{landed.qty}</span> × {landed.description}
          </span>
          <button type="button" onClick={onUndo} className="ms-auto font-medium underline">
            Undo (Ctrl+Z)
          </button>
        </div>
      )}
    </div>
  )
}

/** Three states, and `unknown` never reads like a zero (135). */
function Atp({ qty }: { qty: number | null }) {
  if (qty === null)
    return (
      <span className="shrink-0 rounded-full border border-attention-border bg-attention-050 px-2 py-0.5 text-[11px] font-medium text-attention-800">
        ? stock unknown
      </span>
    )
  if (qty <= 0)
    return (
      <span className="shrink-0 rounded-full border border-danger-border bg-danger-050 px-2 py-0.5 text-[11px] font-medium text-danger-800">
        none at store
      </span>
    )
  return (
    <span data-numeric className="shrink-0 rounded-full border border-success-border bg-success-050 px-2 py-0.5 text-[11px] font-medium text-success-800">
      {qty} in stock
    </span>
  )
}
