/* PROTOTYPE — throwaway. Ticket 138, variant 3.
 *
 * "THE LEDGER." No cards at all. One row per offer in a fixed column grammar —
 * marker · what it gives · what it needs · action — so the three classes are
 * told apart by READING DOWN A COLUMN rather than by comparing tinted blocks.
 * Expanding a row inserts its qualifying items as sub-rows, in place, without
 * moving anything above it.
 *
 * The claim: a card is a poster and a poster does not scale. At seven offers
 * the strip is a wall and the focus view has hidden six; a ledger is still a
 * ledger. It is also the only shape where "out of reach" can sit in the same
 * list without shouting or being buried.
 */
import { useState } from 'react'
import type { GuidanceState, NearMiss } from './guidance-mock'
import { sorted, SKIP_COPY } from './guidance-mock'
import { AddButton, Estimate, Meter, MoreRoute } from './guidance-parts'
import { AtpPill } from '../parts'

export const NAME = 'The ledger'

export default function Variant3Ledger({ s }: { s: GuidanceState }) {
  const list = sorted(s.nearMisses)
  // Same rule as the strip: the top-ranked actionable row is expanded on
  // arrival, so the ledger opens with a set on screen rather than a promise.
  const [open, setOpen] = useState<string | null>(list.find((n) => n.klass === 'actionable')?.offerId ?? null)

  return (
    <div className="shrink-0 border-t border-border-strong bg-card-2">
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Offers</span>
        {s.getSideAbsent && (
          <span className="text-[11px] text-ink-3">buy-one-get-one offers aren’t checked yet</span>
        )}
      </div>

      {s.outcome && <Outcome outcome={s.outcome} />}

      {list.length === 0 ? (
        <div className="px-4 pb-2 text-xs text-muted-foreground">No offers within reach of this basket.</div>
      ) : (
        <div className="max-h-[17rem] overflow-auto border-t border-divider">
          {list.map((n) => (
            <Row
              key={n.offerId}
              n={n}
              open={open === n.offerId}
              onToggle={() => setOpen(open === n.offerId ? null : n.offerId)}
              addingItem={s.addingOffer === n.offerId ? s.addingItem : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({
  n,
  open,
  onToggle,
  addingItem,
}: {
  n: NearMiss
  open: boolean
  onToggle: () => void
  addingItem?: string | null
}) {
  const need = n.progress.need - n.progress.have
  const actionable = n.klass === 'actionable'

  return (
    <div className={`border-b border-divider ${n.klass === 'blocked' ? 'bg-transparent' : 'bg-card'}`}>
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_9rem_minmax(0,14rem)_6.5rem] items-center gap-2 px-4 py-1.5">
        {/* The marker column. Glyph AND ground AND the words in the needs column
            — never hue alone, because these are opposite decisions (130). */}
        <span
          className={`text-center text-sm ${
            actionable ? 'text-primary' : n.klass === 'ready' ? 'text-success-800' : 'text-ink-3'
          }`}
          aria-hidden
        >
          {actionable ? '○' : n.klass === 'ready' ? '✓' : '⃠'}
        </span>

        <div className="min-w-0">
          <div className={`truncate text-sm ${n.klass === 'blocked' ? 'text-muted-foreground' : ''}`}>
            {n.description}
          </div>
          {actionable && (
            <div className="truncate text-[11px] text-ink-3">
              any <span data-numeric>{need}</span> from {n.prereq.label} ·{' '}
              <span data-numeric>{n.prereq.eligibleCount}</span> qualify
            </div>
          )}
        </div>

        {/* WHAT IT GIVES — a definition, in its own column, so the eye can scan
            the value of every offer without a savings total ever existing. */}
        <span className={`text-sm font-semibold ${n.klass === 'blocked' ? 'text-muted-foreground' : 'text-primary-800'}`}>
          {n.gives}
        </span>

        {/* WHAT IT NEEDS — the column that separates the three classes in words. */}
        <div className="min-w-0 text-xs">
          {actionable ? (
            <span className="flex items-center gap-2">
              <Meter have={n.progress.have} need={n.progress.need} />
              <span className="text-foreground">
                add <span data-numeric className="font-semibold">{need}</span>
              </span>
            </span>
          ) : n.klass === 'ready' ? (
            <span className="text-success-800">already counted — a better offer applied</span>
          ) : (
            <span className="truncate text-muted-foreground">{SKIP_COPY[n.skipReason ?? ''] ?? 'not evaluated'}</span>
          )}
        </div>

        <div className="flex justify-end">
          {actionable &&
            (n.prereq.kind === 'material' ? (
              <AddButton busy={!!addingItem} />
            ) : (
              <button type="button" onClick={onToggle} className="text-xs font-medium text-primary hover:underline">
                {open ? 'Hide items' : 'Show items'}
              </button>
            ))}
        </div>
      </div>

      {/* Sub-rows, in the same column grammar — the set, not an item. */}
      {open && actionable && n.items && (
        <div className="border-t border-divider bg-card-2 ps-10 pe-4">
          {/* Three, as in the other two — see Variant1Strip. */}
          {n.items.slice(0, 3).map((i) => (
            <div
              key={i.itemNumber}
              className="grid grid-cols-[minmax(0,1fr)_9rem_minmax(0,14rem)_6.5rem] items-center gap-2 border-b border-divider/60 py-1 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-xs">{i.description}</div>
                <bdi dir="ltr" className="block truncate text-[11px] text-ink-3">
                  {i.description2}
                </bdi>
              </div>
              <span data-numeric className="text-[11px] text-muted-foreground">
                {i.itemNumber}
              </span>
              <span className="flex items-center gap-2">
                <Estimate v={i.estimatePriceExVat} />
                <AtpPill atp={i.atp} compact />
              </span>
              <div className="flex justify-end">
                <AddButton busy={addingItem === i.itemNumber} />
              </div>
            </div>
          ))}
          <div className="py-1.5">
            <MoreRoute n={n} />
          </div>
        </div>
      )}
    </div>
  )
}

function Outcome({ outcome }: { outcome: NonNullable<GuidanceState['outcome']> }) {
  if (!outcome) return null
  const tone =
    outcome.kind === 'noFire'
      ? 'border-attention-border bg-attention-050 text-attention-800'
      : 'border-success-border bg-success-050 text-success-800'
  const text =
    outcome.kind === 'noFire'
      ? `${outcome.description} was added — ${outcome.offerId} still needs ${outcome.stillNeeds}.`
      : outcome.kind === 'firedOther'
        ? `A better offer fired instead: ${outcome.description}.`
        : `${outcome.description} applied.`
  return <div className={`border-y px-4 py-1.5 text-xs ${tone}`}>{text}</div>
}

/** Unused export kept off — the ledger has no separate empty card. */
export const _ = null
