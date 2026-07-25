import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ArrowRight } from 'lucide-react'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import type { PromoBlock, PromoGetLine, PromoItemRef } from './promo-view'
import { promoLineList } from './promo-lines'
import { KIND_CHIP, KIND_GLYPH, PROMO_CARD_ROW } from './promo-kind'
import SimBbyDetailsButton from './SimBbyDetailsButton'

// The fired promotions, rendered as plain-language buy→get blocks (ticket 047) — the
// heart of the map-039 rework, replacing the result-level Applied Bonus Buys tab. Each
// block reads `promoView(result).blocks` (ticket 045):
//   • a plain-language TITLE composed from t() templates keyed on kind + item counts
//     (never free text; the server `description` rides through as data);
//   • a Buy box → Get box RELATIONSHIP — trigger lines left, reward lines right; a free
//     reward reads FREE, a discounted one shows its new price with the original struck;
//   • a cross-product reward tagged "reward" (a get line whose material no buy line has);
//   • a header IDENTITY line carrying the BBY key, promo/offer id, remaining usage and
//     total saved — so nothing the old Applied tab showed is lost.
//
// Bidirectional cross-highlight: hovering/focusing a block lights its grid lines and
// vice-versa, keyed on the promotion (bbyNumber) so it works on the degradation path
// too — the conditionKey buy↔get precision (ticket 044) sharpens it with no code change.
// On the degradation path a block has no split: it renders one undivided items box off
// `touchedItems` (never throws).
//
// TICKET 117 — this component lost its FRAME. `SimPromotionsRail` is now the screen's
// third and last frame: it carries the `Promotions` heading, the fired count, the
// empty and promo-off states, and the near-miss cards in the SAME column. What is left
// here is the list of fired cards, so the fires and the near-misses cannot drift into
// two frames again. Each card also now PRINTS the lines it touched (`promoLineList`) —
// the cross-highlight below is the enhancement, not the mechanism.

interface Props {
  blocks: PromoBlock[]
  currency: string
  /** The promotion currently hot anywhere in the surface (null = none). */
  hotBby: string | null
  /** Raise the hot promotion as the pointer/focus enters (bbyNumber) or leaves (null). */
  onHotChange: (bby: string | null) => void
  /** Open the bonus-buy detail modal for a promotion — `null` when the grant is not
   *  CONFIRMED, which is what makes the control absent rather than dead (ticket 118). */
  onOpenBbyDetails: ((bbyNumber: string) => void) | null
}

export default function SimPromoBlocks({
  blocks,
  currency,
  hotBby,
  onHotChange,
  onOpenBbyDetails,
}: Props) {
  const { t } = useTranslation('simulation')

  if (blocks.length === 0) return null

  return (
    // A CARD ROW when the layout STACKS, not a stack of bands (ticket 119). The query
    // is `@max-[900px]/work` — the same breakpoint, on the same named work-area
    // container, that puts the rail above the results in the first place — so the card
    // row is exactly the stacked arrangement rather than an approximation of it from
    // the rail's own width. Beside, the rail is a 34% column and a card fills it,
    // exactly as the flex column this replaced.
    //
    // The `340px` MAXIMUM is what stops one fired promotion from printing as a stripe
    // across the screen when stacked: a fired promotion is one card-sized card, and
    // three of them sit side by side rather than three bands deep pushing the results
    // they explain below the fold.
    <div className={PROMO_CARD_ROW + ' gap-2.5'}>
      {blocks.map((b) => (
        <Block
          key={b.bbyNumber}
          block={b}
          currency={currency}
          hot={hotBby === b.bbyNumber}
          onHotChange={onHotChange}
          onOpenBbyDetails={onOpenBbyDetails}
          t={t}
        />
      ))}
    </div>
  )
}

function Block({
  block,
  currency,
  hot,
  onHotChange,
  onOpenBbyDetails,
  t,
}: {
  block: PromoBlock
  currency: string
  hot: boolean
  onHotChange: (bby: string | null) => void
  onOpenBbyDetails: ((bbyNumber: string) => void) | null
  t: TFunction
}) {
  const glyph = block.kind ? KIND_GLYPH[block.kind] : '•'
  const buyMaterials = new Set(block.buyItems.map((i) => i.materialNumber))
  const title = blockTitle(block, t)

  return (
    <div
      tabIndex={0}
      data-promo-card="fired"
      data-bby={block.bbyNumber}
      onMouseEnter={() => onHotChange(block.bbyNumber)}
      onMouseLeave={() => onHotChange(null)}
      onFocus={() => onHotChange(block.bbyNumber)}
      onBlur={() => onHotChange(null)}
      className={
        'rounded-lg border bg-card transition-colors ' +
        (hot ? 'border-ring ring-1 ring-ring' : 'border-border/60')
      }
    >
      {/* Header — kind glyph · plain-language title · identity line · total saved. */}
      <div className="flex items-start gap-2.5 p-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-base font-bold ${KIND_CHIP}`}
          aria-hidden
        >
          {glyph}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          {/* The server's promo name — a field the old Applied tab carried; shown unless
              it already IS the (degraded/unclassified) title, to avoid echoing it. */}
          {block.description && block.description !== title ? (
            <div className="truncate text-xs text-muted-foreground">{block.description}</div>
          ) : null}
          <IdentityLine block={block} t={t} />
        </div>
        <div className="shrink-0 text-end">
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            {t('promo.savedLabel')}
          </div>
          <div className="text-sm font-bold tabular-nums text-success-800">
            {formatMoney(block.totalSaved)}{' '}
            <span className="text-[10px] font-medium text-muted-foreground">{currency}</span>
          </div>
        </div>
      </div>

      {/* Buy → Get, or one undivided items box on the degradation path. */}
      {block.degraded ? (
        <div className="px-3 pb-3">
          <ItemBox label={t('promo.itemsLabel')} tone="neutral">
            {block.touchedItems.length > 0 ? (
              block.touchedItems.map((it) => <ItemLine key={it.itemNumber} item={it} t={t} />)
            ) : (
              <span className="text-xs text-muted-foreground">{t('promo.noItems')}</span>
            )}
          </ItemBox>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 px-3 pb-3">
          <ItemBox label={t('promo.buyLabel')} tone="neutral">
            {block.buyItems.map((it) => (
              <ItemLine key={it.itemNumber} item={it} t={t} />
            ))}
          </ItemBox>
          <div className="grid place-items-center text-primary" aria-hidden>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </div>
          <ItemBox
            label={t('promo.getLabel')}
            tone="get"
            tag={block.kind ? t(`promo.kindTag.${block.kind}`) : null}
          >
            {block.getLines.map((l) => (
              <GetLine key={l.itemNumber} line={l} reward={!buyMaterials.has(l.materialNumber)} t={t} />
            ))}
          </ItemBox>
        </div>
      )}

      {/* Last on the card, below the amount and the buy→get relationship (ticket 118).
          Absent unless the grant is CONFIRMED, and absent for a block the wire gave no
          bonus-buy key — there would be no record to open. */}
      {onOpenBbyDetails && block.bbyNumber ? (
        <SimBbyDetailsButton bbyNumber={block.bbyNumber} onOpen={onOpenBbyDetails} />
      ) : null}
    </div>
  )
}

/** The Buy / Get / Items container — a labelled box; the Get box carries the success
 *  reward treatment and its discount-kind tag. */
function ItemBox({
  label,
  tone,
  tag,
  children,
}: {
  label: string
  tone: 'neutral' | 'get'
  tag?: string | null
  children: React.ReactNode
}) {
  const boxClass =
    tone === 'get'
      ? 'border-success-border bg-success-050'
      : 'border-border/60 bg-muted/40'
  return (
    <div className={`rounded-md border p-2 ${boxClass}`}>
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {tag ? (
          <>
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
            <span className="text-success-800">{tag}</span>
          </>
        ) : null}
      </div>
      <div className="mt-1 flex flex-col gap-1">{children}</div>
    </div>
  )
}

/** A buy / touched line: qty · description + material · gross value. */
function ItemLine({ item, t }: { item: PromoItemRef; t: TFunction }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {t('promo.qty', { qty: formatNumber(item.quantity) })}
      </span>
      <span className="min-w-0 flex-1 font-medium">
        {item.materialDescription} <span className="text-muted-foreground">{item.materialNumber}</span>
      </span>
      <span className="shrink-0 tabular-nums">{formatMoney(item.grossValue)}</span>
    </div>
  )
}

/** A reward line: FREE when fully free, else the new net with the original struck. A
 *  cross-product reward (a material no buy line carried) gets the "reward" tag. */
function GetLine({ line, reward, t }: { line: PromoGetLine; reward: boolean; t: TFunction }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {t('promo.qty', { qty: formatNumber(line.quantity) })}
      </span>
      <span className="min-w-0 flex-1 font-medium">
        {line.materialDescription} <span className="text-muted-foreground">{line.materialNumber}</span>
        {reward ? (
          <span className="ms-1 text-[9px] font-bold uppercase tracking-wide text-success-800">
            {t('promo.reward')}
          </span>
        ) : null}
      </span>
      {line.free ? (
        <span className="shrink-0 font-bold text-success-800">{t('promo.free')}</span>
      ) : (
        <span className="shrink-0 tabular-nums">
          {formatMoney(line.netValue)}
          {line.netValue < line.grossValue ? (
            <span className="ms-1 text-muted-foreground line-through">{formatMoney(line.grossValue)}</span>
          ) : null}
        </span>
      )}
    </div>
  )
}

/** BBY key · promo no · offer · applied ×N · remaining usage · THE LINE LIST — the old
 *  Applied-tab identity, kept, plus ticket 117's printed linkage. `applied ×N` = how
 *  many times this same promo fired into this one card (its distinct condition keys,
 *  counted in `promoView`). Shown only when it fired more than once.
 *
 *  `lines 10 · 20` is last because it is the part the eye travels BACK from — it names
 *  where in the table to look, and it is the honest degradation of the hover
 *  cross-highlight: it costs one part of an existing line, it survives the rail
 *  stacking above the results (ticket 119), and it survives having no pointer at all.
 *  It is absent when the promotion resolved no basket line, rather than printing an
 *  empty `lines`. */
function IdentityLine({ block, t }: { block: PromoBlock; t: TFunction }) {
  const lines = promoLineList(block)
  const parts: { text: string; mark?: string }[] = [
    block.bbyNumber ? { text: block.bbyNumber } : null,
    block.promoNumber ? { text: t('promo.promoNoLabel', { promo: block.promoNumber }) } : null,
    block.offerId ? { text: t('promo.offerLabel', { offer: block.offerId }) } : null,
    block.appliedCount > 1 ? { text: t('promo.appliedTimes', { count: block.appliedCount }) } : null,
    { text: t('promo.usage', { count: block.remainingUsage }) },
    lines.length > 0
      ? { text: t('promotions.lines', { lines: lines.join(' · ') }), mark: 'lines' }
      : null,
  ].filter((p): p is { text: string; mark?: string } => p !== null)

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-x-1.5">
          {i > 0 ? (
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
          ) : null}
          <span data-promo-part={p.mark}>{p.text}</span>
        </span>
      ))}
    </div>
  )
}

/** The block's plain-language title: a per-kind template keyed on kind + buy/get item
 *  counts. On the degradation path (no split) or an unclassifiable kind it falls back
 *  to the server `description`, then a generic label — never a fabricated buy→get. */
function blockTitle(block: PromoBlock, t: TFunction): string {
  if (!block.degraded && block.kind && (block.buyItems.length > 0 || block.getLines.length > 0)) {
    return t(`promo.title.${block.kind}`, { buy: block.buyItems.length, get: block.getLines.length })
  }
  return block.description || t('promo.title.fallback')
}
