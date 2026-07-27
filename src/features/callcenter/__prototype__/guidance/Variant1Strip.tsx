/* PROTOTYPE — throwaway. Ticket 138, variant 1.
 *
 * "THE WRAPPING STRIP." 135 amendment 2's shape, executed properly: cards that
 * wrap into the basket's dead space, never a sideways scroll. The three classes
 * are separated by RANK AND TREATMENT, not by tint alone — actionable are full
 * cards, ready collapse to a single line of pills, blocked collapse to one
 * muted line behind a disclosure.
 *
 * The claim: the agent scans cards. Everything actionable is a card; nothing
 * that is not actionable is allowed to look like one.
 */
import { useState } from 'react'
import type { GuidanceState, NearMiss } from './guidance-mock'
import { sorted } from './guidance-mock'
import {
  AddButton,
  ClassMark,
  Delta,
  Gives,
  ItemRow,
  Meter,
  MoreRoute,
  PartialCoverage,
  Region,
  RegionHeader,
  WhyBlocked,
} from './guidance-parts'

export const NAME = 'Wrapping strip of cards'

export default function Variant1Strip({ s }: { s: GuidanceState }) {
  const list = sorted(s.nearMisses)
  // The top-ranked actionable offer opens by construction — a card whose items
  // are one click away is a card whose items the agent does not read mid-call.
  const [open, setOpen] = useState<string | null>(list.find((n) => n.klass === 'actionable')?.offerId ?? null)
  const [showBlocked, setShowBlocked] = useState(false)

  const actionable = list.filter((n) => n.klass === 'actionable')
  const ready = list.filter((n) => n.klass === 'ready')
  const blocked = list.filter((n) => n.klass === 'blocked')

  if (list.length === 0)
    return (
      <Region>
        <div className="px-4 py-2 text-xs text-muted-foreground">
          No offers within reach of this basket.
          {s.getSideAbsent && <span className="ms-2 text-ink-3">Buy-one-get-one offers aren’t checked yet.</span>}
        </div>
      </Region>
    )

  return (
    <Region>
      <RegionHeader>
        <span>Offers within reach</span>
        {s.getSideAbsent && <PartialCoverage />}
      </RegionHeader>

      {s.outcome && <Outcome outcome={s.outcome} />}

      {/* The strip grows taller, never wider. Two columns at the centre's real
          width; cards wrap rather than hiding behind a gesture nobody performs. */}
      {/* Measured, not guessed: at 19rem the cards PLUS an outcome banner put the
          region over 135's budget (46% of the centre). The banner is pinned, so
          the scroller is what gives — the strip is the only one of the three
          shapes that needed this correction. */}
      <div className="max-h-[18rem] overflow-auto px-4 pb-2">
        {actionable.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {actionable.map((n) => (
              <Card
                key={n.offerId}
                // An OPEN card carries a set, so it takes the strip's full
                // width; closed cards pair up. Drawn at half width first, which
                // left the item rows squeezed beside 500 px of nothing.
                span={open === n.offerId}
                n={n}
                open={open === n.offerId}
                onToggle={() => setOpen(open === n.offerId ? null : n.offerId)}
                addingItem={s.addingOffer === n.offerId ? s.addingItem : null}
              />
            ))}
          </div>
        )}

        {/* Ready: fully qualified, out-ranked. There is nothing to do, so it gets
            no card, no action, and no space it could steal from one that has. */}
        {ready.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-divider pt-2">
            <span className="text-[11px] text-muted-foreground">Already counted:</span>
            {ready.map((n) => (
              <span
                key={n.offerId}
                className="inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-050 px-2 py-0.5 text-[11px] text-success-800"
              >
                <span aria-hidden>✓</span>
                {n.description}
              </span>
            ))}
          </div>
        )}

        {/* Blocked: no basket change can fix it (128 makes this class permanent
            and common), so it is one line, collapsed, never a card. */}
        {blocked.length > 0 && (
          <div className="mt-2 border-t border-divider pt-2">
            <button
              type="button"
              onClick={() => setShowBlocked(!showBlocked)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              <span data-numeric>{blocked.length}</span> more offer{blocked.length === 1 ? '' : 's'} can’t be reached from
              this basket {showBlocked ? '▴' : '▾'}
            </button>
            {showBlocked && (
              <ul className="mt-1 space-y-0.5">
                {blocked.map((n) => (
                  <li key={n.offerId} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                    <span>{n.description}</span>
                    <span className="text-ink-3">—</span>
                    <WhyBlocked n={n} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Region>
  )
}

function Card({
  n,
  open,
  onToggle,
  addingItem,
  span,
}: {
  n: NearMiss
  open: boolean
  onToggle: () => void
  addingItem?: string | null
  span?: boolean
}) {
  const need = n.progress.need - n.progress.have
  return (
    <div className={`rounded-md border border-primary-border bg-card p-2.5 ${span ? 'col-span-2' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* The promise: a DEFINITION, large; never a savings total. */}
          <Gives text={n.gives} size="lg" />
          <div className="truncate text-xs text-muted-foreground">{n.description}</div>
        </div>
        <ClassMark klass={n.klass} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Meter have={n.progress.have} need={n.progress.need} />
          <Delta n={need} />
        </div>
        {/* A material prereq is a single item — one click, no list to open. */}
        {n.prereq.kind === 'material' ? (
          <AddButton busy={!!addingItem} label={`Add ${n.prereq.label.slice(0, 18)}…`} />
        ) : (
          <button type="button" onClick={onToggle} className="text-xs font-medium text-primary hover:underline">
            {open ? 'Hide' : 'Show'} <span data-numeric>{n.prereq.eligibleCount}</span> qualifying
          </button>
        )}
      </div>

      {/* The honest statement: any N from this SET. */}
      <div className="mt-1 text-[11px] text-ink-3">
        any <span data-numeric>{need}</span> from {n.prereq.label}
      </div>

      {open && n.items && (
        <div className="mt-2 divide-y divide-divider border-t border-divider pt-1">
          {/* THREE, held constant across the variants so the comparison is
              about structure. Five was drawn first and it buries every other
              offer behind a scroll the moment one card is open. */}
          {n.items.slice(0, 3).map((i) => (
            <ItemRow key={i.itemNumber} i={i} busy={addingItem === i.itemNumber} dense />
          ))}
          <div className="pt-1.5">
            <MoreRoute n={n} />
          </div>
        </div>
      )}
    </div>
  )
}

/** What an add that did NOT fire looks like. The offer stays; only its meter
 *  moved. Silence here would read as a broken button. */
function Outcome({ outcome }: { outcome: NonNullable<GuidanceState['outcome']> }) {
  if (!outcome) return null
  if (outcome.kind === 'noFire')
    return (
      <div className="mx-4 mb-2 rounded-md border border-attention-border bg-attention-050 px-3 py-1.5 text-xs text-attention-800">
        {outcome.description} was added — the offer still needs {outcome.stillNeeds}.
      </div>
    )
  if (outcome.kind === 'firedOther')
    return (
      <div className="mx-4 mb-2 rounded-md border border-success-border bg-success-050 px-3 py-1.5 text-xs text-success-800">
        A better offer fired instead: {outcome.description}.
      </div>
    )
  return (
    <div className="mx-4 mb-2 rounded-md border border-success-border bg-success-050 px-3 py-1.5 text-xs text-success-800">
      {outcome.description} applied.
    </div>
  )
}
