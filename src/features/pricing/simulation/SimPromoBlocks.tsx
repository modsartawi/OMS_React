import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ArrowRight } from 'lucide-react'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import type { PromoBlock, PromoGetLine, PromoItemRef } from './promo-view'
import { KIND_CLASS, KIND_GLYPH } from './promo-kind'

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
// `touchedItems` (never throws). The disclosure ("Pricing detail"), the "Could have
// applied" section and the responsive side/stack/compact layout are follow-on tickets
// (049 / 048 / 050) — this ticket is the blocks and the cross-highlight.

interface Props {
  blocks: PromoBlock[]
  currency: string
  /** The promotion currently hot anywhere in the surface (null = none). */
  hotBby: string | null
  /** Raise the hot promotion as the pointer/focus enters (bbyNumber) or leaves (null). */
  onHotChange: (bby: string | null) => void
}

export default function SimPromoBlocks({ blocks, currency, hotBby, onHotChange }: Props) {
  const { t } = useTranslation('simulation')

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t('promo.paneTitle')}</h2>
        {blocks.length > 0 ? (
          <span className="text-xs font-medium text-primary">{t('promo.firedCount', { count: blocks.length })}</span>
        ) : null}
      </div>

      {blocks.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground">
          {t('promo.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {blocks.map((b) => (
            <Block
              key={b.bbyNumber}
              block={b}
              currency={currency}
              hot={hotBby === b.bbyNumber}
              onHotChange={onHotChange}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Block({
  block,
  currency,
  hot,
  onHotChange,
  t,
}: {
  block: PromoBlock
  currency: string
  hot: boolean
  onHotChange: (bby: string | null) => void
  t: TFunction
}) {
  const kindClass = block.kind ? KIND_CLASS[block.kind] : 'bg-muted text-muted-foreground'
  const glyph = block.kind ? KIND_GLYPH[block.kind] : '•'
  const buyMaterials = new Set(block.buyItems.map((i) => i.materialNumber))
  const title = blockTitle(block, t)

  return (
    <div
      tabIndex={0}
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
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-base font-bold ${kindClass}`}
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
          <div className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
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
    </div>
  )
}

/** The Buy / Get / Items container — a labelled box; the Get box carries the green
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
      ? 'border-emerald-600/40 bg-emerald-500/10'
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
            <span className="text-emerald-700 dark:text-emerald-400">{tag}</span>
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
          <span className="ms-1 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {t('promo.reward')}
          </span>
        ) : null}
      </span>
      {line.free ? (
        <span className="shrink-0 font-bold text-emerald-700 dark:text-emerald-400">{t('promo.free')}</span>
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

/** BBY key · promo no · offer · applied ×N · remaining usage — the old Applied-tab
 *  identity, kept. `applied ×N` = how many times this same promo fired into this one
 *  card (its distinct condition keys, counted in `promoView`). Shown only when it fired
 *  more than once. */
function IdentityLine({ block, t }: { block: PromoBlock; t: TFunction }) {
  const parts = [
    block.bbyNumber || null,
    block.promoNumber ? t('promo.promoNoLabel', { promo: block.promoNumber }) : null,
    block.offerId ? t('promo.offerLabel', { offer: block.offerId }) : null,
    block.appliedCount > 1 ? t('promo.appliedTimes', { count: block.appliedCount }) : null,
    t('promo.usage', { count: block.remainingUsage }),
  ].filter((p): p is string => Boolean(p))

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-x-1.5">
          {i > 0 ? (
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
          ) : null}
          <span>{p}</span>
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
