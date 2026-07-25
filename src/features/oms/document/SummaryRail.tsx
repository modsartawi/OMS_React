import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { railCards, type CardRow, type RailCard } from './fields'

/**
 * A card's colour: the accent bar at the start of its title, and the ink its
 * links take so the two read as one card. **One entry per card**, because a bar
 * and a link that disagree is exactly the bug two parallel tables invite.
 *
 * The colours are 082's tokens, never a literal. Prescription and Driver are the
 * two cards an operator looks for by colour — the e-Rx facts must be separable
 * from fulfilment at a glance, and the driver card takes the fulfilment family's
 * own hue because chasing a delivery is what it is for. The other three stay
 * `--primary`: a rail where every card shouts has no signal in it.
 */
const ACCENTS: Record<RailCard['key'], { bar: string; link: string }> = {
  customer: { bar: 'bg-primary', link: 'text-primary' },
  prescription: { bar: 'bg-prescription', link: 'text-prescription' },
  fulfilment: { bar: 'bg-primary', link: 'text-primary' },
  driver: { bar: 'bg-fam-fulfilment', link: 'text-fam-fulfilment' },
  payment: { bar: 'bg-primary', link: 'text-primary' },
}

/**
 * The summary rail (spec 083 D-6, ticket 092) — the context the work area is
 * read with.
 *
 * Five cards, of which Customer, Fulfilment and Payment always render while
 * Prescription and Driver & tracking collapse out of the array entirely
 * (`railCards` decides; this component only draws what it is handed). Inside a
 * card, every row it receives has already survived D-5's emptiness test, so there
 * are **no em dashes here** — a blank text row never arrives.
 *
 * The rail is **340px beside the work area above 900px, and a card grid above it
 * below 900px** — `repeat(auto-fit, minmax(250px, 1fr))`, never a drawer. It is
 * first in the DOM, which is what puts it above the work area when the page grid
 * collapses to one column: hiding the summary behind a toggle on the viewport
 * that most needs orientation is backwards.
 */
export default function SummaryRail({ document }: { document: SdDocumentHeaderModel }) {
  const { t } = useTranslation('document')
  const cards = railCards(document, t)

  return (
    <div
      // `role="group"` is load-bearing exactly as it is on the pill rail and the
      // band: `aria-label` is ignored on a bare div, and the groups this rail
      // replaces are what used to name the region.
      role="group"
      aria-label={t('cards.ariaLabel')}
      className="grid content-start gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))] rail:grid-cols-1"
    >
      {cards.map((card) => (
        <section key={card.key} className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <h3 className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-[0.6875rem] font-bold tracking-wider text-muted-foreground uppercase">
            <span aria-hidden className={`h-3 w-[3px] shrink-0 rounded-sm ${ACCENTS[card.key].bar}`} />
            {card.title}
          </h3>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 px-2.5 py-2 text-[0.8125rem]">
            {card.rows.map((row) => (
              <Row key={row.key} row={row} ink={ACCENTS[card.key].link} />
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

/**
 * One card row: the label at the start, the value at the end. The value carries
 * `tabular-nums` when it is a figure or a code, quieter ink when it is free text
 * an operator scans rather than quotes, and the card's weight when it is the
 * closing total.
 */
function Row({ row, ink }: { row: CardRow; ink: string }) {
  const total = row.total === true
  const pair = (
    <>
      <dt
        className={
          'whitespace-nowrap text-muted-foreground' + (total ? ' font-semibold text-foreground' : '')
        }
      >
        {row.label}
      </dt>
      <dd
        className={
          'm-0 min-w-0 text-end [overflow-wrap:anywhere] font-medium' +
          (row.numeric === true ? ' tabular-nums' : '') +
          (row.soft === true ? ' font-normal text-muted-foreground' : '') +
          (total ? ' text-[0.9375rem] font-bold' : '')
        }
      >
        {row.href ? (
          <a
            href={row.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 font-semibold ${ink}`}
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            {row.value}
          </a>
        ) : (
          row.value
        )}
      </dd>
    </>
  )

  // The closing total takes a rule above it. The wrapper is a **subgrid** row so
  // that one continuous hairline crosses the whole card: a border on each cell
  // would break at the column gap, which reads as two short rules rather than
  // the line under a total.
  if (!total) return pair
  return (
    <div className="col-span-2 mt-1 grid grid-cols-subgrid items-baseline gap-x-3 border-t border-border-strong pt-1.5">
      {pair}
    </div>
  )
}
