/**
 * The applied card, card D (spec 995 D, ticket 996) — one fired promotion in the *Applied* column.
 *
 * - The engine's amount, verbatim.
 * - The one line it landed on and its quantity (*Line 1 · 4 units*).
 * - The arithmetic, `qty × unit gross = before · caller pays after`: `unit gross` is the line's
 *   `unitPrice.gross` and `after` its `lineTotal.gross`, both the server's. 🚩 The one client
 *   figure is `qty × unit`, the multiplication the line already shows; nothing is subtracted, and
 *   the saving is the engine's amount, never `before − after`.
 * - *Removing one takes the free one away* when the offer had a get side.
 * - A Say line, in the console's language and in Arabic.
 *
 * Where it landed on several lines (or none) it is 987's card: the lines by number, and the
 * coupon's skipped lines.
 */
import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { formatMoney } from '@/core/util/number-format'
import type { GuidancePhrase } from './guidance-view'
import Money from './Money'
import { appliedSay } from './offer-say'
import type { AppliedCard } from './promotions-panel'
import SayLine from './SayLine'

export default function AppliedOfferCard({ card }: { card: AppliedCard }) {
  const { t, i18n } = useTranslation('callcenter')
  const lines = listText(card.lines.map(String), i18n.language)
  const notOn = listText(card.notOn.map(String), i18n.language)
  // The sentence names the engine's amount as a saving. 🚩 Its sign is presentation only: the
  // figure is the server's, never summed or derived (`noFigureIsComputedHere`).
  const amount = formatMoney(Math.abs(card.amount))
  const currency = t('money.currency')
  const offer = card.description
  const landed = card.landed
  const said = appliedSay({
    amount,
    currency,
    landed: landed ? { qty: landed.qty, after: formatMoney(landed.lineGross) } : null,
    keepAll: card.keepAll,
  })
  const say: GuidancePhrase[] =
    said.length > 0
      ? said
      : [
          card.lines.length > 0
            ? {
                key: 'callcenter:promotions.say.applied',
                // `1,2`: SayLine lists them in each language it says the sentence in.
                params: { offer, amount, currency, lines: card.lines.join(','), count: card.lines.length },
              }
            : { key: 'callcenter:promotions.say.appliedOrder', params: { offer, amount, currency } },
          ...(card.notOn.length > 0
            ? [{ key: 'callcenter:promotions.say.notOn', params: { lines: card.notOn.join(','), count: card.notOn.length } }]
            : []),
        ]
  return (
    <li
      className="rounded-md border border-success-border bg-card p-2.5"
      // 997: the offer sheet closes to this card once the offer fires, so it takes focus.
      tabIndex={-1}
      data-cc-applied-card={card.offerId}
      data-cc-applied-lines={card.lines.join(',')}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium" data-cc-server-text>
          {/* Free server text, in either script: `<bdi>`, not `Ltr`. */}
          <bdi>{card.description}</bdi>
        </span>
        <span className="shrink-0 text-base font-semibold tabular-nums text-success-800" data-cc-applied-amount>
          <Ltr>
            <Money value={card.amount} />
          </Ltr>
        </span>
      </div>

      {landed && (
        <div className="mt-1 text-xs tabular-nums text-foreground" data-cc-applied-landed>
          <div data-cc-applied-line>{t('offer.applied.landed', { line: fsi(String(landed.line)), count: landed.qty })}</div>
          <div className="text-muted-foreground" data-cc-applied-sum>
            {/* The arithmetic is one machine value, isolated once and laid out left to right. */}
            <Ltr>
              {t('offer.applied.sum', {
                qty: landed.qty,
                unit: formatMoney(landed.unitGross),
                before: formatMoney(Math.round(landed.qty * landed.unitGross * 100) / 100),
              })}
            </Ltr>
            <span aria-hidden> · </span>
            <span data-cc-applied-pays>{t('offer.applied.pays', { after: fsi(formatMoney(landed.lineGross)) })}</span>
          </div>
        </div>
      )}

      {card.keepAll && (
        <p className="mt-1 text-[11px] font-medium text-attention-800" data-cc-applied-keep>
          {t('offer.applied.removeWarn')}
        </p>
      )}

      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
        {card.coupon && (
          <span data-cc-applied-coupon>{t('promotions.applied.coupon', { code: fsi(card.coupon) })}</span>
        )}
        {!landed && (
          <span data-cc-applied-on>
            {card.lines.length > 0
              ? t('promotions.applied.lines', { lines: fsi(lines), count: card.lines.length })
              : t('promotions.applied.noLines')}
          </span>
        )}
        {card.notOn.length > 0 && (
          <span className="text-attention-800" data-cc-applied-not-on>
            {t('promotions.applied.notOn', { lines: fsi(notOn), count: card.notOn.length })}
          </span>
        )}
      </div>
      <SayLine phrases={say} bilingual />
    </li>
  )
}
