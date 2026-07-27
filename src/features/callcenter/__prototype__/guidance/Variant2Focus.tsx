/* PROTOTYPE — throwaway. Ticket 138, variant 2.
 *
 * "ONE NEXT BEST ACTION." The opposite bet from the strip: mid-call, an agent
 * can act on exactly one thing, so the surface shows exactly one — the highest-
 * ranked actionable offer, with its handful ALREADY resolved (no click to open
 * a list), and a stepper to walk the rest. Everything non-actionable is one
 * line of text under it.
 *
 * The claim: the strip makes the agent choose between offers while a caller is
 * talking. This makes the choice for them and keeps the region short, which is
 * the density budget the basket actually wants back.
 */
import { useState } from 'react'
import type { GuidanceState } from './guidance-mock'
import { sorted, SKIP_COPY } from './guidance-mock'
import { AddButton, Delta, Gives, ItemRow, Meter, MoreRoute } from './guidance-parts'

export const NAME = 'One next best action'

export default function Variant2Focus({ s }: { s: GuidanceState }) {
  const [i, setI] = useState(0)
  const list = sorted(s.nearMisses)
  const actionable = list.filter((n) => n.klass === 'actionable')
  const ready = list.filter((n) => n.klass === 'ready')
  const blocked = list.filter((n) => n.klass === 'blocked')
  const cur = actionable[Math.min(i, actionable.length - 1)]

  return (
    <div className="shrink-0 border-t border-border-strong bg-card-2">
      {s.outcome && <Outcome outcome={s.outcome} />}

      {cur ? (
        <div className="border-b border-divider px-4 py-2.5">
          <div className="flex items-start gap-4">
            {/* The promise, at headline size. A definition — never a total. */}
            <div className="w-44 shrink-0">
              <Gives text={cur.gives} size="lg" />
              <div className="text-xs leading-tight text-muted-foreground">{cur.description}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <Meter have={cur.progress.have} need={cur.progress.need} />
              </div>
              <div className="mt-1">
                <Delta n={cur.progress.need - cur.progress.have} />
              </div>
              <div className="mt-1 text-[11px] text-ink-3">
                any <span data-numeric>{cur.progress.need - cur.progress.have}</span> from {cur.prereq.label} —{' '}
                <span data-numeric>{cur.prereq.eligibleCount}</span> qualify
              </div>
            </div>

            {/* Resolved up front: the agent reads a name out loud, not a button
                that fetches a list. The cost is one resolvePrereq per offer
                shown — which is exactly one, by construction. */}
            <div className="min-w-0 flex-1">
              {cur.prereq.kind === 'material' ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
                  <span className="truncate text-sm">{cur.prereq.label}</span>
                  <AddButton busy={s.addingOffer === cur.offerId} />
                </div>
              ) : (
                <div className="divide-y divide-divider rounded-md border border-border bg-card px-3">
                  {cur.items?.slice(0, 3).map((it) => (
                    <ItemRow
                      key={it.itemNumber}
                      i={it}
                      busy={s.addingOffer === cur.offerId && s.addingItem === it.itemNumber}
                    />
                  ))}
                  <div className="py-1.5">
                    <MoreRoute n={cur} />
                  </div>
                </div>
              )}
            </div>

            {/* The stepper is the whole answer to "where did the other offers
                go" — they are one keystroke away, not hidden. */}
            <div className="flex w-24 shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <Step onClick={() => setI((i - 1 + actionable.length) % actionable.length)} disabled={actionable.length < 2}>
                  ‹
                </Step>
                <span data-numeric className="text-[11px] text-muted-foreground">
                  {Math.min(i, actionable.length - 1) + 1}/{actionable.length}
                </span>
                <Step onClick={() => setI((i + 1) % actionable.length)} disabled={actionable.length < 2}>
                  ›
                </Step>
              </div>
              <span className="text-[10px] text-ink-3">within reach</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b border-divider px-4 py-2 text-xs text-muted-foreground">
          {list.length === 0 ? 'No offers within reach of this basket.' : 'Nothing to add — no offer is within reach.'}
        </div>
      )}

      {/* Everything the agent cannot act on is one line. Ready is a fact, not an
          opportunity; blocked is a permanent fact (128). Neither gets a card. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-[11px] text-muted-foreground">
        {ready.length > 0 && (
          <span className="text-success-800">
            <span aria-hidden>✓</span> already counted: {ready.map((n) => n.description).join(' · ')}
          </span>
        )}
        {blocked.length > 0 && (
          <span>
            <span aria-hidden>⃠</span> out of reach:{' '}
            {blocked.map((n) => `${n.description} (${SKIP_COPY[n.skipReason ?? ''] ?? 'not evaluated'})`).join(' · ')}
          </span>
        )}
        {s.getSideAbsent && <span className="text-ink-3">buy-one-get-one offers aren’t checked yet</span>}
      </div>
    </div>
  )
}

function Step({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-input bg-card px-1.5 text-xs text-foreground disabled:opacity-40"
    >
      {children}
    </button>
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
      ? `${outcome.description} was added — the offer still needs ${outcome.stillNeeds}.`
      : outcome.kind === 'firedOther'
        ? `A better offer fired instead: ${outcome.description}.`
        : `${outcome.description} applied.`
  return <div className={`border-b px-4 py-1.5 text-xs ${tone}`}>{text}</div>
}
