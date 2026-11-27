/**
 * The promotions panel (spec 983 D7, ticket 987) — under the basket, in the order column.
 *
 * Two columns side by side where the order column is wide enough, stacked where it is not:
 * - **Applied** — one card per fired promotion: the server's description and amount, the lines
 *   it landed on by D4's numbers, the lines a coupon skipped, and a sentence to say.
 * - **One step away** — the guidance strip (171/172/412–415), moved here with its cards, its
 *   verbs and its order unchanged, each within-reach card carrying a sentence to recommend it.
 * - **Could still use** is absent: nothing the console reads lists coupons the caller holds and
 *   has not applied (`promotions-panel.ts`).
 *
 * Every figure is the server's (`promotions-panel.ts`); this file arranges and words them.
 */
import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { formatMoney } from '@/core/util/number-format'
import GuidanceStrip, { type GuidanceActions } from './GuidanceStrip'
import type { GuidancePhrase } from './guidance-view'
import Money from './Money'
import type { AppliedCard, PromotionsPanel as PanelView } from './promotions-panel'
import SayLine from './SayLine'

export default function PromotionsPanel({
  view,
  transactionId,
  plant,
  actions,
}: {
  view: PanelView
  transactionId: string
  plant: string
  actions: GuidanceActions
}) {
  const { t } = useTranslation('callcenter')
  return (
    <section className="@container shrink-0 border-t border-border-strong bg-muted/30" data-cc-promotions>
      <h2 className="px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        {t('promotions.heading')}
      </h2>
      <div className="grid gap-x-3 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <AppliedColumn cards={view.applied} />
        <GuidanceStrip
          view={view.guidance}
          say={view.say}
          transactionId={transactionId}
          plant={plant}
          actions={actions}
        />
      </div>
    </section>
  )
}

function AppliedColumn({ cards }: { cards: AppliedCard[] }) {
  const { t } = useTranslation('callcenter')
  return (
    <div className="min-w-0 px-4 py-1.5" data-cc-applied>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('promotions.applied.heading')}</div>
      {cards.length === 0 ? (
        <p className="mt-0.5 text-xs text-muted-foreground" data-cc-applied-none>
          {t('promotions.applied.none')}
        </p>
      ) : (
        <ul className="mt-1 max-h-[18rem] space-y-2 overflow-auto">
          {cards.map((card) => (
            <AppliedItem key={card.cardId} card={card} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AppliedItem({ card }: { card: AppliedCard }) {
  const { t, i18n } = useTranslation('callcenter')
  const lines = listText(card.lines.map(String), i18n.language)
  const notOn = listText(card.notOn.map(String), i18n.language)
  // The sentence names the engine's amount as a saving. 🚩 Its sign is presentation only: the
  // figure is the server's, never summed or derived (`noFigureIsComputedHere`).
  const amount = formatMoney(Math.abs(card.amount))
  const currency = t('money.currency')
  const offer = card.description
  const say: GuidancePhrase[] = [
    card.lines.length > 0
      ? { key: 'callcenter:promotions.say.applied', params: { offer, amount, currency, lines, count: card.lines.length } }
      : { key: 'callcenter:promotions.say.appliedOrder', params: { offer, amount, currency } },
    ...(card.notOn.length > 0
      ? [{ key: 'callcenter:promotions.say.notOn', params: { lines: notOn, count: card.notOn.length } }]
      : []),
  ]
  return (
    <li
      className="rounded-md border border-success-border bg-card p-2.5"
      data-cc-applied-card={card.offerId}
      data-cc-applied-lines={card.lines.join(',')}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium" data-cc-server-text>
          {/* Free server text, in either script: `<bdi>`, not `Ltr`. */}
          <bdi>{card.description}</bdi>
        </span>
        <span className="shrink-0" data-cc-applied-amount>
          <Ltr>
            <Money value={card.amount} />
          </Ltr>
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
        {card.coupon && (
          <span data-cc-applied-coupon>{t('promotions.applied.coupon', { code: fsi(card.coupon) })}</span>
        )}
        <span data-cc-applied-on>
          {card.lines.length > 0
            ? t('promotions.applied.lines', { lines: fsi(lines), count: card.lines.length })
            : t('promotions.applied.noLines')}
        </span>
        {card.notOn.length > 0 && (
          <span className="text-attention-800" data-cc-applied-not-on>
            {t('promotions.applied.notOn', { lines: fsi(notOn), count: card.notOn.length })}
          </span>
        )}
      </div>
      <SayLine phrases={say} />
    </li>
  )
}
