import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import type { PricingElement, SimulationResultItem } from '@/core/models/simulation'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import { aggregateConditions } from './aggregate'
import BoolCell from './BoolCell'
import ConditionCard from './ConditionCard'

/**
 * The result line's expansion (ticket 116, spec 110 §Disclosure) — the surface that
 * replaces `SimItemDetail` and `SimBonusBuyPanel`, and the right-hand column they
 * lived in.
 *
 * **The disclosure grammar, in four sentences.** This run's data expands **in place**;
 * anything fetched fresh opens a modal. A disclosure opens inside a frame that already
 * exists and is never wider than it — which here is structural, not a class: it renders
 * in a `colSpan` cell of the results table, so it cannot out-grow the Results frame
 * however long a description runs. Nothing behind a disclosure is a diagnosis; only
 * trace hides. One idiom, exactly one level deep.
 *
 * **One surface, three parts:**
 *
 * 1. **The money foot** — the figures ticket 115 took off the line, footing themselves:
 *    `net + tax = net total`. The line carries the answer; the foot carries the
 *    arithmetic, one click down, so the total stays checkable.
 * 2. **The rules** — the aggregated condition cards. `aggregateConditions` (under test
 *    since ticket 111) is now their SOLE producer, and every group is listed: the
 *    show/hide-statistical toggle is retired and a statistical card wears a neutral
 *    `STAT` key instead.
 * 3. **The elements trace** — a **sibling of the rules, not a nesting**, because the
 *    request flag (`includePricingElements`) was already the opt-in. It appears only
 *    when this run's line actually carries trace rows, and it is a **plain table**:
 *    seven rows do not need thirty rows' worth of grid chrome. This is where the
 *    feature's last AG Grid went.
 *
 * A **`W` line's engine message rides on the LINE**, never here (104's correction from
 * 103, restated in this ticket) — a failure must never be something you go looking for.
 * A priced line's messages, which are advisory rather than a failure, keep the heading
 * they already had.
 */

interface Props {
  item: SimulationResultItem
  currency: string
  /** The line did not price (`lineMoney(item).notPriced`) — its messages are already on
   *  the line, so the expansion must not print them a second time. */
  notPriced: boolean
}

export default function SimLineExpansion({ item, currency, notPriced }: Props) {
  const { t } = useTranslation('simulation')

  const cards = useMemo(() => aggregateConditions(item.conditions), [item.conditions])
  const elements = item.pricingElements ?? []
  const messages = notPriced ? [] : item.pricingStatusMessages

  return (
    <div data-line-expansion={item.itemNumber} className="flex flex-col gap-3 px-2 py-3">
      {/* ---- 1 · the money foot: net + tax = net total ----
          Absent on a line that did not price. The wire sends `0` for net, tax and total
          on such a line, and 115's ruling is that printing those says *priced at zero*
          when the truth is *did not price* — a foot reading `0.00 + 0.00 = 0.00` would
          reintroduce, one click down, exactly the claim the line suppresses. There is
          no arithmetic to check, so there is nothing to foot. */}
      {notPriced ? null : (
        <div
          data-money-foot
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] tabular-nums"
        >
          <FootTerm label={t('results.expandNet')} value={item.netValue} />
          <span className="text-muted-foreground" aria-hidden>
            +
          </span>
          <FootTerm label={t('results.expandTax')} value={item.taxValue} />
          <span className="text-muted-foreground" aria-hidden>
            =
          </span>
          <FootTerm label={t('results.expandTotal')} value={item.netTotal} emphasis />
          <span className="text-[10px] font-medium text-muted-foreground">{currency}</span>
        </div>
      )}

      {/* ---- 2 · the rules ---- */}
      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">{t('detail.rulesTitle')}</h3>
        {cards.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('detail.noRules')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {cards.map((card) => (
              <ConditionCard
                key={`${card.conditionType}-${card.conditionRate}-${card.conditionRateUnit}-${card.conditionOrigin}`}
                card={card}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- a priced line's advisory messages ---- */}
      {messages.length > 0 ? (
        <div className="rounded-md border border-attention-border bg-attention-050 p-2.5 text-xs text-attention-800">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('detail.messagesTitle')}
          </div>
          <ul className="ms-5 list-disc space-y-0.5">
            {messages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- 3 · the elements trace, a sibling of the rules ---- */}
      {elements.length > 0 ? (
        <div data-elements-trace>
          <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
            {t('results.elementsTitle')}
          </h3>
          <ElementsTable elements={elements} />
        </div>
      ) : null}
    </div>
  )
}

/** One term of the money foot — its label above nothing, beside its figure. */
function FootTerm({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number
  emphasis?: boolean
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      {/* Rendered as authored, NOT `uppercase`: the three foot labels are sentence-case
          in the 123 ledger, and the ledger's uppercase inventory is the list of values
          that carry their own caps — a CSS transform is a no-op on Arabic script. */}
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className={emphasis ? 'font-semibold' : ''}>{formatMoney(value)}</span>
    </span>
  )
}

/** The eleven trace columns, in the pricing procedure's own order. Labels unchanged
 *  from the grid that used to draw them — component churn, zero key churn. */
const ELEMENT_HEAD = 'px-2 py-1 font-semibold'

function ElementsTable({ elements }: { elements: PricingElement[] }) {
  const { t } = useTranslation('simulation')

  return (
    // No scroll region, in either axis. Vertically it is as tall as its rows — no fixed
    // height, no box sized for thirty rows around seven, which is what the AG Grid it
    // replaced did. Horizontally it fills the frame and wraps: spec 110 §66 rules that
    // the trace SHEDS identifier columns rather than scrolling sideways, because a
    // nested scroll region inside a disclosure is the one thing worse than a wide table.
    // The shedding itself is ticket 119's — this slice must simply not foreclose it by
    // installing the scroll box here.
    <div>
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-b border-border/70 text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className={`${ELEMENT_HEAD} text-end`}>{t('bonus.elements.step')}</th>
            <th className={`${ELEMENT_HEAD} text-end`}>{t('bonus.elements.counter')}</th>
            <th className={`${ELEMENT_HEAD} text-start`}>{t('bonus.elements.type')}</th>
            <th className={`${ELEMENT_HEAD} text-start`}>{t('bonus.elements.description')}</th>
            <th className={`${ELEMENT_HEAD} text-end`}>{t('bonus.elements.base')}</th>
            <th className={`${ELEMENT_HEAD} text-end`}>{t('bonus.elements.rate')}</th>
            <th className={`${ELEMENT_HEAD} text-start`}>{t('bonus.elements.unit')}</th>
            <th className={`${ELEMENT_HEAD} text-end`}>{t('bonus.elements.value')}</th>
            <th className={`${ELEMENT_HEAD} text-center`}>{t('bonus.elements.statistical')}</th>
            <th className={`${ELEMENT_HEAD} text-center`}>{t('bonus.elements.subtotal')}</th>
            <th className={`${ELEMENT_HEAD} text-center`}>{t('bonus.elements.bonusBuy')}</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((el, i) => (
            <tr
              key={`${el.stepNumber}-${el.conditionCounter}-${i}`}
              className="border-b border-b-divider last:border-b-0"
            >
              <td className="px-2 py-0.5 text-end tabular-nums">{formatNumber(el.stepNumber)}</td>
              <td className="px-2 py-0.5 text-end tabular-nums">{formatNumber(el.conditionCounter)}</td>
              <td className="px-2 py-0.5 font-medium">{el.conditionType}</td>
              <td className="px-2 py-0.5 text-muted-foreground">{el.description}</td>
              <td className="px-2 py-0.5 text-end tabular-nums">{formatMoney(el.conditionBaseValue)}</td>
              <td className="px-2 py-0.5 text-end tabular-nums">{formatNumber(el.conditionRate)}</td>
              <td className="px-2 py-0.5 text-muted-foreground">{el.conditionRateUnit}</td>
              <td className="px-2 py-0.5 text-end tabular-nums">{formatMoney(el.conditionValue)}</td>
              <td className="px-2 py-0.5">
                <BoolCell value={el.isStatistics} />
              </td>
              <td className="px-2 py-0.5">
                <BoolCell value={el.isSubtotal} />
              </td>
              <td className="px-2 py-0.5">
                <BoolCell value={el.isBonusBuy} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
