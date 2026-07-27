/* PROTOTYPE — throwaway. Ticket 138.
 *
 * Atoms only — the pieces that must read IDENTICALLY across the three variants
 * so the comparison is about structure, not wording. Deliberately no layout
 * here: each variant is free to throw the arrangement out, which is the point.
 */
import type { ReactNode } from 'react'
import type { NearMiss, PrereqItem } from './guidance-mock'
import { money, SKIP_COPY } from './guidance-mock'
import { AtpPill } from '../parts'

/** 131 + 135 amendment 1: an estimate NEVER carries `SAR` and never lands in a
 *  money column. `SAR` is reserved for engine money. `≈` and the muted register
 *  are the second signal; the position is the first. */
export function Estimate({ v }: { v: number }) {
  return (
    <span data-numeric className="text-xs text-muted-foreground">
      ≈{money(v)}
    </span>
  )
}

/** WHAT THE CARD IS ALLOWED TO PROMISE (130 / spec 574 US26). The discount
 *  DEFINITION, never a savings total — a real one requires firing the promotion.
 *  This is the whole feature's honesty test: it must still read as worth doing. */
export function Gives({ text, size = 'md' }: { text: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={
        size === 'lg'
          ? 'text-lg font-semibold leading-none text-primary-800'
          : 'text-sm font-semibold text-primary-800'
      }
    >
      {text}
    </span>
  )
}

/** 117's ruling carried forward: the hue correction is the METER, not the tile. */
export function Meter({ have, need }: { have: number; need: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${have} of ${need}`}>
      {Array.from({ length: need }).map((_, i) => (
        <span
          key={i}
          className={`inline-block size-2 rounded-full ${i < have ? 'bg-primary' : 'border border-border-strong bg-transparent'}`}
          aria-hidden
        />
      ))}
      <span data-numeric className="ms-1 text-[11px] text-muted-foreground">
        {have}/{need}
      </span>
    </span>
  )
}

/** The delta, in the agent's mouth. `Missing` from spec 574's builder. */
export function Delta({ n }: { n: number }) {
  return (
    <span className="text-xs text-foreground">
      add <span data-numeric className="font-semibold">{n}</span> more
    </span>
  )
}

/** The class marker. Ground + ink + WORDS — 130 says these are three different
 *  decisions, so they may never differ by hue alone. */
export function ClassMark({ klass }: { klass: NearMiss['klass'] }) {
  if (klass === 'ready')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-800">
        <span aria-hidden>✓</span> already counted
      </span>
    )
  if (klass === 'blocked')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <span aria-hidden>⃠</span> out of reach
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-800">
      <span aria-hidden>○</span> within reach
    </span>
  )
}

export function WhyBlocked({ n }: { n: NearMiss }) {
  return (
    <span className="text-xs text-muted-foreground">
      {SKIP_COPY[n.skipReason ?? ''] ?? 'not evaluated for this basket'}
    </span>
  )
}

/** One-click add. Under resume-per-request it is a server round trip, so it has
 *  a real in-flight state — and the row it sits on must not move while it runs. */
export function AddButton({ busy, label = 'Add' }: { busy?: boolean; label?: string }) {
  return (
    <button
      type="button"
      disabled={busy}
      className="shrink-0 rounded-md border border-primary-border bg-primary-050 px-2 py-1 text-xs font-medium text-primary-800 disabled:opacity-60"
    >
      {busy ? 'Adding…' : label}
    </button>
  )
}

/** The eligible-item row: description, Arabic, ATP, estimate OFF the money
 *  column, one action. Same row in all three variants. */
export function ItemRow({ i, busy, dense = false }: { i: PrereqItem; busy?: boolean; dense?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${dense ? 'py-1' : 'py-1.5'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-xs">{i.description}</span>
          {i.rank && <span className="shrink-0 text-[10px] text-ink-3">{i.rank}</span>}
        </div>
        {/* Owner ruling, 2026-07-27: the guidance row carries Arabic, because
            131 put Arabic in the item search for the reason that applies here
            harder — the agent reads the name to the caller. Wrapped in <bdi>:
            an Arabic run inside an LTR row is exactly the case where a trailing
            neutral relocates (121's audit finding), and the row ends in one.
            dir="ltr" is NOT redundant: <bdi> implies dir="auto", which reads the
            Arabic and flips the whole block RTL — the name then aligns to the far
            end, away from the English line it belongs to. We want the isolation
            without the flip: the run renders RTL inside a start-aligned block.
            It rides the META line rather than taking one of its own: variant 1 is
            clamped at 18rem against the drive's 45%-of-centre budget, so a third
            line per row is not paid for in height — it is paid for in hidden
            scroll, and what it pushed below the fold was `Search the other 37`,
            the route to the rest of the set that part 1 requires. */}
        <div className="flex items-baseline gap-2">
          <bdi dir="ltr" className="min-w-0 truncate text-[11px] text-ink-3">
            {i.description2}
          </bdi>
          <span data-numeric className="shrink-0 text-[11px] text-muted-foreground">
            {i.itemNumber}
          </span>
          <Estimate v={i.estimatePriceExVat} />
        </div>
      </div>
      <AtpPill atp={i.atp} compact />
      <AddButton busy={busy} />
    </div>
  )
}

/** "…and 994 more" — the route to the full set that must not become a second
 *  screen. Drawn as a search hand-off: the agent already has an item search. */
export function MoreRoute({ n }: { n: NearMiss }) {
  const shown = n.items?.length ?? 0
  const rest = n.prereq.eligibleCount - shown
  if (rest <= 0) return null
  return (
    <button type="button" className="text-xs text-primary hover:underline">
      Search the other <span data-numeric>{rest}</span> — filtered to this offer
    </button>
  )
}

/** 787-C has not landed: "buy X get Y" near-misses are ABSENT, not empty. The
 *  surface says so once, quietly, rather than implying it showed everything. */
export function PartialCoverage() {
  return (
    <div className="text-[11px] text-ink-3">
      Buy-one-get-one offers aren’t checked yet — this list covers discounts only.
    </div>
  )
}

export function Region({ children }: { children: ReactNode }) {
  return <div className="shrink-0 border-t border-border-strong bg-card-2">{children}</div>
}

export function RegionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  )
}
