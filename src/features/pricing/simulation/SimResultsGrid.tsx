import { useTranslation } from 'react-i18next'
import type { KeyboardEvent } from 'react'
import type { SimulationResultItem } from '@/core/models/simulation'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import type { PromoLineRef } from './promo-view'
import { KIND_CHIP } from './promo-kind'

// The per-line results grid (spec 503, reworked map 053). Replaces the AG Grid table
// with a hand-rolled surface that RESPONDS to the width it is given: above the
// container threshold it is the dense WPF-order table (status · item · material ·
// description · qty · Promotion · subtotal · promo · gross · tax · net); below it —
// the common case, since the grid lives in the 7fr side of the split and never fits
// even a 27" — each line folds into a self-contained card so the eleven fields stack
// instead of spilling into a horizontal scroll. One `@container` query does the swap;
// no JS width-measuring. Selection (drives the detail panel) and the bidirectional
// promo cross-highlight (ticket 047) are preserved on both layouts.

/** The promotion currently hot (hovered/focused anywhere in the surface) — drives the
 *  grid↔block cross-highlight (ticket 047). `conditionKey` narrows the highlight to one
 *  buy↔get application when the projection (044) supplies it; `null` (the degradation
 *  path, or a whole-block hover) lights every line of the `bby`. */
export interface PromoHot {
  bby: string
  conditionKey: string | null
}

interface Props {
  items: SimulationResultItem[]
  /** Per-line promo refs from `promoView(result).lines` (ticket 045). */
  promoByItem: Map<number, PromoLineRef[]>
  hot: PromoHot | null
  selectedItemNumber: number | null
  currency: string
  onSelect: (itemNumber: number) => void
  onHotChange: (hot: PromoHot | null) => void
}

/** A line is lit when the hot promotion touches it — matching the row-class rule the
 *  AG Grid version carried: same bby, and same application when `conditionKey` is set. */
function isLineHot(promos: PromoLineRef[], hot: PromoHot | null): boolean {
  if (!hot) return false
  return promos.some(
    (r) => r.bbyNumber === hot.bby && (hot.conditionKey == null || r.conditionKey === hot.conditionKey),
  )
}

/** The promotion to raise when the pointer/focus enters a line — its first ref, mirroring
 *  the old `onCellMouseOver`; `null` on a plain, un-promoted line. */
function hotForLine(promos: PromoLineRef[]): PromoHot | null {
  const ref = promos[0]
  return ref ? { bby: ref.bbyNumber, conditionKey: ref.conditionKey } : null
}

export default function SimResultsGrid({
  items,
  promoByItem,
  hot,
  selectedItemNumber,
  currency,
  onSelect,
  onHotChange,
}: Props) {
  const { t } = useTranslation('simulation')

  // onMouseLeave clears the cross-highlight once — per-line mouse-out would flicker as
  // the pointer crosses lines.
  return (
    <div
      className="@container max-h-[32rem] overflow-y-auto"
      onMouseLeave={() => onHotChange(null)}
    >
      {/* ===== WIDE: the dense table (shown only when the container is wide enough). ===== */}
      <table className="hidden w-full border-collapse @[820px]:table">
        <thead>
          <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2.5 py-2 text-start font-semibold">{t('results.status')}</th>
            <th className="px-2.5 py-2 text-end font-semibold">{t('results.item')}</th>
            <th className="px-2.5 py-2 text-start font-semibold">{t('results.material')}</th>
            <th className="px-2.5 py-2 text-start font-semibold">{t('results.description')}</th>
            <th className="px-2.5 py-2 text-end font-semibold">{t('results.qty')}</th>
            <th className="px-2.5 py-2 text-start font-semibold">{t('results.promotion')}</th>
            <th className="px-2.5 py-2 text-end font-semibold">{t('results.subtotal')}</th>
            <th className="px-2.5 py-2 text-end font-semibold">{t('results.promo')}</th>
            <th className="px-2.5 py-2 text-end font-semibold">{t('results.gross')}</th>
            <th className="px-2.5 py-2 text-end font-semibold">{t('results.tax')}</th>
            <th className="px-2.5 py-2 text-end font-semibold">{t('results.net')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const promos = promoByItem.get(item.itemNumber) ?? []
            const selected = item.itemNumber === selectedItemNumber
            const lit = isLineHot(promos, hot)
            return (
              <tr
                key={item.itemNumber}
                tabIndex={0}
                role="button"
                aria-pressed={selected}
                onClick={() => onSelect(item.itemNumber)}
                onKeyDown={(e) => onRowKey(e, () => onSelect(item.itemNumber))}
                onMouseEnter={() => onHotChange(hotForLine(promos))}
                onFocus={() => onHotChange(hotForLine(promos))}
                className={`cursor-pointer border-b border-border/50 text-sm outline-none last:border-b-0 focus-visible:ring-1 focus-visible:ring-ring ${
                  selected
                    ? 'bg-primary/10'
                    : lit
                      ? 'bg-primary/5'
                      : 'hover:bg-accent/60'
                }`}
              >
                <td className="px-2.5 py-2">
                  <StatusDot status={item.pricingStatus} t={t} />
                </td>
                <td className="px-2.5 py-2 text-end tabular-nums">{item.itemNumber}</td>
                <td className="px-2.5 py-2 tabular-nums text-muted-foreground">{item.materialNumber}</td>
                <td className="px-2.5 py-2">{item.materialDescription}</td>
                <td className="px-2.5 py-2 text-end tabular-nums">
                  {`${formatNumber(item.quantity)} ${item.unitOfMeasure ?? ''}`.trim()}
                </td>
                <td className="px-2.5 py-2">
                  <PromoTags promos={promos} t={t} />
                </td>
                <td className="px-2.5 py-2 text-end tabular-nums">{formatMoney(item.netValue)}</td>
                <td className={`px-2.5 py-2 text-end tabular-nums ${item.promotionDiscount < 0 ? 'text-destructive' : ''}`}>
                  {formatMoney(item.promotionDiscount)}
                </td>
                <td className="px-2.5 py-2 text-end tabular-nums">{formatMoney(item.grossValue)}</td>
                <td className="px-2.5 py-2 text-end tabular-nums">{formatMoney(item.taxValue)}</td>
                <td className="px-2.5 py-2 text-end font-semibold tabular-nums text-success-800">
                  {formatMoney(item.netTotal)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ===== NARROW: one card per line (the default; hidden once the table fits). ===== */}
      <div className="flex flex-col gap-2 @[820px]:hidden">
        {items.map((item) => {
          const promos = promoByItem.get(item.itemNumber) ?? []
          const selected = item.itemNumber === selectedItemNumber
          const lit = isLineHot(promos, hot)
          return (
            <div
              key={item.itemNumber}
              tabIndex={0}
              role="button"
              aria-pressed={selected}
              onClick={() => onSelect(item.itemNumber)}
              onKeyDown={(e) => onRowKey(e, () => onSelect(item.itemNumber))}
              onMouseEnter={() => onHotChange(hotForLine(promos))}
              onFocus={() => onHotChange(hotForLine(promos))}
              className={`cursor-pointer rounded-lg border bg-card p-3 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring ${
                selected
                  ? 'border-s-[3px] border-s-primary border-border/60'
                  : lit
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/60 hover:border-border'
              }`}
            >
              {/* Header — who is this line. */}
              <div className="flex items-baseline gap-2">
                <StatusDot status={item.pricingStatus} t={t} />
                <span className="text-xs font-bold tabular-nums text-muted-foreground">#{item.itemNumber}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold tracking-tight">{item.materialDescription}</div>
                  <div className="text-xs tabular-nums text-muted-foreground">{item.materialNumber}</div>
                </div>
              </div>

              {/* Context band — qty + promotion. */}
              <div className="my-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-y border-dashed border-border/60 py-2 text-sm">
                <span className="text-muted-foreground">
                  {t('results.qty')}{' '}
                  <span className="font-semibold tabular-nums text-foreground">{formatNumber(item.quantity)}</span>{' '}
                  {item.unitOfMeasure}
                </span>
                <PromoTags promos={promos} t={t} />
              </div>

              {/* Money block — the aligned breakdown, net emphasized. */}
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
                <MoneyRow label={t('results.subtotal')} value={item.netValue} currency={currency} />
                <MoneyRow
                  label={t('results.promo')}
                  value={item.promotionDiscount}
                  currency={currency}
                  tone={item.promotionDiscount < 0 ? 'text-destructive' : ''}
                />
                <MoneyRow label={t('results.gross')} value={item.grossValue} currency={currency} />
                <MoneyRow label={t('results.tax')} value={item.taxValue} currency={currency} />
                <div className="col-span-2 mt-1 flex items-baseline justify-between border-t border-border/60 pt-1.5">
                  <span className="text-sm font-semibold">{t('results.net')}</span>
                  <span className="text-[15px] font-bold text-success-800">
                    {formatMoney(item.netTotal)}
                    <span className="ms-1 text-[10px] font-medium text-muted-foreground">{currency}</span>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Enter / Space selects, mirroring a native button. */
function onRowKey(e: KeyboardEvent, select: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    select()
  }
}

function MoneyRow({
  label,
  value,
  currency,
  tone,
}: {
  label: string
  value: number
  currency: string
  tone?: string
}) {
  return (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-end text-sm ${tone ?? ''}`}>
        {formatMoney(value)}
        <span className="ms-1 text-[10px] text-muted-foreground">{currency}</span>
      </span>
    </>
  )
}

/** Red (E) / amber (W) / green (ok) line-health dot — the status text is title + aria so
 *  the colour isn't the only channel. Inline (not an AG Grid renderer). */
function StatusDot({ status, t }: { status: string; t: ReturnType<typeof useTranslation>[0] }) {
  const tone = status === 'E' ? 'error' : status === 'W' ? 'warning' : 'ok'
  const color = tone === 'error' ? 'bg-danger' : tone === 'warning' ? 'bg-attention' : 'bg-success'
  const label = t(`status.${tone}`)
  return (
    <span className="inline-flex items-center" title={label} aria-label={label}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  )
}

/** The promotion(s) touching a line — a neutral KIND chip (hue is reserved for
 *  severity, ticket 088) plus a ROLE tag; a plain em-dash when none, so promoted and
 *  un-promoted lines read distinct. Lifted from the retired `PromoCell` (ticket 046). */
function PromoTags({ promos, t }: { promos: PromoLineRef[]; t: ReturnType<typeof useTranslation>[0] }) {
  if (promos.length === 0) {
    return (
      <span className="text-muted-foreground" aria-label={t('results.promoNone.label')}>
        {t('results.promoNone.mark')}
      </span>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {promos.map((p, i) => {
        return (
          <span key={`${p.bbyNumber}-${p.conditionKey ?? i}`} className="inline-flex items-center gap-1">
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${KIND_CHIP}`}>
              {t(`results.promoKind.${p.kind ?? 'unknown'}`)}
            </span>
            {p.role ? (
              <span className="inline-flex items-center rounded border border-border px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`results.promoRole.${p.role}`)}
              </span>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}
