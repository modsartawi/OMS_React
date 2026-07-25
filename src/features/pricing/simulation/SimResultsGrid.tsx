import { useTranslation } from 'react-i18next'
import type { KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import type { SimulationResultItem } from '@/core/models/simulation'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import { lineMoney, type PromoSlot } from './line-money'
import { KIND_CHIP } from './promo-kind'
import type { PromoLineRef } from './promo-view'
import SimLineExpansion from './SimLineExpansion'

/**
 * The per-line results table (ticket 115, spec 110 — the line's anatomy ruled in
 * 104 against the 098 captures).
 *
 *   `# · item · qty ×unit · promotion · was · saved · net total`
 *
 * Seven columns, three of them money, rebuilt around the arithmetic the engine
 * actually performs (`grossValue + promotionDiscount = netValue`, then
 * `netValue + taxValue = netTotal`). The old line printed *subtotal · promo · gross ·
 * tax · net* — the post-discount figure BEFORE the discount, the pre-discount figure
 * AFTER it, under labels that named neither. `netValue`, `taxValue` and the
 * arithmetic move into the line expansion (ticket 116); this slice stops printing
 * them here.
 *
 * What went, and why:
 *
 * - **The status column.** A healthy line carries no mark at all, so a dot column
 *   would spend colour on "nothing is wrong" three times to surface the one case
 *   that matters. The `W` badge takes the promotion slot instead — and the two can
 *   never collide, because a line that failed to price never fires a promotion.
 * - **The `@[820px]` card fallback and the `max-h-[32rem]` scroll box.** The corpus
 *   is 1–3 lines: every line of every captured basket is visible at once and the
 *   frame is as tall as its content. The table never sheds and never scrolls — the
 *   rework's one breakpoint is derived FROM its ~470 px (ticket 119).
 * - **The discount's red.** Every real discount is negative and the old grid painted
 *   it `text-destructive` — a third hue, spent on good news. `saved` is now a neutral
 *   end-aligned magnitude.
 *
 * The figures themselves are not computed here: `lineMoney` (pure, tested against the
 * captures) decides what is blank, what is suppressed and which of the four states
 * the promotion slot resolves to. This component only renders that verdict — a `null`
 * becomes a faint `·`, a token becomes a `t()` call.
 *
 * The bidirectional promo cross-highlight (ticket 047) is preserved.
 *
 * **Ticket 116 turned selection into disclosure.** Selecting a line used to drive a
 * detail panel in a right-hand column; that panel is gone and the line expands in place
 * instead (`SimLineExpansion`, rendered in a `colSpan` cell so it can never be wider
 * than the Results frame). So there is no longer a single "selected" line — there is a
 * SET of open ones: closed at rest, any number open at once, nothing ever auto-opens.
 * The 3 px `primary` inline-start edge now marks *open*, which is the same fact it used
 * to mark; the twisty in the `#` cell states it in a second, colour-free channel.
 */

/** The promotion currently hot (hovered/focused anywhere in the surface) — drives the
 *  line↔card cross-highlight (ticket 047). `conditionKey` narrows the highlight to one
 *  buy↔get application when the projection (044) supplies it; `null` (the degradation
 *  path, or a whole-card hover) lights every line of the `bby`. */
export interface PromoHot {
  bby: string
  conditionKey: string | null
}

interface Props {
  items: SimulationResultItem[]
  /** Per-line promo refs from `promoView(result).lines` (ticket 045) — the
   *  cross-highlight's join. The line's own promotion SLOT is read off the line's
   *  conditions by `lineMoney`, not from here. */
  promoByItem: Map<number, PromoLineRef[]>
  hot: PromoHot | null
  /** The item numbers whose expansion is open. Empty at rest; a re-run empties it. */
  openItemNumbers: ReadonlySet<number>
  currency: string
  onToggle: (itemNumber: number) => void
  onHotChange: (hot: PromoHot | null) => void
}

/** A line is lit when the hot promotion touches it — same bby, and same application
 *  when `conditionKey` is set. */
function isLineHot(promos: PromoLineRef[], hot: PromoHot | null): boolean {
  if (!hot) return false
  return promos.some(
    (r) => r.bbyNumber === hot.bby && (hot.conditionKey == null || r.conditionKey === hot.conditionKey),
  )
}

/** The promotion to raise when the pointer/focus enters a line — its first ref;
 *  `null` on a plain, un-promoted line. */
function hotForLine(promos: PromoLineRef[]): PromoHot | null {
  const ref = promos[0]
  return ref ? { bby: ref.bbyNumber, conditionKey: ref.conditionKey } : null
}

/** One column head's classes, shared so the seven cannot drift apart. */
const HEAD_CELL = 'px-2 py-1.5 font-semibold'

/**
 * The two placeholder glyphs, and why they are not keys.
 *
 * `·` = *nothing happened here* (an undiscounted line) and `—` = *this line did not
 * price*. Both are non-linguistic marks that translate to themselves, and 115's i18n
 * ledger RETIRES the key the em-dash used to carry (`results.promoNone.mark`) without
 * minting a replacement — a deliberate ruling, not an oversight, so 121's key audit
 * finds this note rather than a gap. They are `aria-hidden`: a screen reader reading
 * "middle dot" is noise, and the not-priced line says so in words in its own column.
 */
const BLANK = '·'
const SUPPRESSED = '—'

export default function SimResultsGrid({
  items,
  promoByItem,
  hot,
  openItemNumbers,
  currency,
  onToggle,
  onHotChange,
}: Props) {
  const { t } = useTranslation('simulation')

  // onMouseLeave clears the cross-highlight once — per-line mouse-out would flicker
  // as the pointer crosses lines.
  return (
    <table className="w-full table-fixed border-collapse" onMouseLeave={() => onHotChange(null)}>
      {/* The seven widths of 104's set B: the description takes everything left over
          (it reads first), every money column is fixed so the figures line up down
          the table as well as across it. */}
      {/* The seven columns of 104's set B, the first widened by 14 px to seat the
          twisty beside the position number — the disclosure earns its affordance
          inside the anatomy rather than adding an eighth column to it. */}
      <colgroup>
        <col className="w-[44px]" />
        <col />
        <col className="w-[80px]" />
        <col className="w-[104px]" />
        <col className="w-[80px]" />
        <col className="w-[76px]" />
        <col className="w-[96px]" />
      </colgroup>
      <thead>
        <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className={`${HEAD_CELL} text-start`}>{t('results.pos')}</th>
          <th className={`${HEAD_CELL} text-start`}>{t('results.item')}</th>
          <th className={`${HEAD_CELL} text-end`}>{t('results.qty')}</th>
          <th className={`${HEAD_CELL} text-end`}>{t('results.promotion')}</th>
          <th className={`${HEAD_CELL} text-end`}>{t('results.was')}</th>
          <th className={`${HEAD_CELL} text-end`}>{t('results.saved')}</th>
          <th className={`${HEAD_CELL} text-end`}>{t('results.netTotal')}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const promos = promoByItem.get(item.itemNumber) ?? []
          const money = lineMoney(item)
          const open = openItemNumbers.has(item.itemNumber)
          const lit = isLineHot(promos, hot)
          return [
            <tr
              key={item.itemNumber}
              data-result-line={item.itemNumber}
              tabIndex={0}
              role="button"
              aria-expanded={open}
              onClick={() => onToggle(item.itemNumber)}
              onKeyDown={(e) => onRowKey(e, () => onToggle(item.itemNumber))}
              onMouseEnter={() => onHotChange(hotForLine(promos))}
              onFocus={() => onHotChange(hotForLine(promos))}
              // 34 px at rest, two text rows. The open edge is 3 px of `primary` on the
              // inline start plus a `card-2` fill — transparent when closed so nothing
              // shifts; distinguishable from the cross-highlight's `primary-050` tint,
              // which 104 drew the two together to check. An open line keeps its bottom
              // border: the expansion row below owns the one that closes the pair.
              className={`h-[34px] cursor-pointer border-s-[3px] border-b border-b-divider text-sm outline-none last:border-b-0 focus-visible:ring-1 focus-visible:ring-ring ${
                open
                  ? 'border-s-primary bg-card-2'
                  : lit
                    ? 'border-s-transparent bg-primary-050'
                    : 'border-s-transparent hover:bg-accent/60'
              }`}
            >
              <td className="px-2 align-middle text-[11px] font-bold tabular-nums text-ink-3">
                <span className="flex items-center gap-0.5">
                  <ChevronRight
                    data-line-twisty={open ? 'open' : 'closed'}
                    className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform rtl:-scale-x-100 ${
                      open ? 'rotate-90' : ''
                    }`}
                    aria-hidden
                  />
                  {item.itemNumber}
                </span>
              </td>

              {/* The widest column, and the one that reads first: description over
                  material. A not-priced line carries its engine message HERE, on the
                  line — never behind a disclosure (104's correction from 103). */}
              <td className="min-w-0 px-2 py-[2px]">
                <div
                  className={`truncate text-[13px] font-medium leading-4 ${money.notPriced ? 'text-attention-800' : ''}`}
                >
                  {item.materialDescription}
                </div>
                <div className="truncate text-[11px] leading-[13px] tabular-nums text-muted-foreground">
                  {item.materialNumber}
                </div>
                {money.notPriced
                  ? money.messages.map((message, i) => (
                      <div
                        key={`${item.itemNumber}-${i}`}
                        className="text-[11px] leading-[14px] text-attention-800"
                      >
                        {message}
                      </div>
                    ))
                  : null}
              </td>

              {/* Quantity over unit price — `netPrice` is not on the screen today, it
                  is the cheapest sanity check on a price-master problem, and under the
                  quantity it costs no column. */}
              <td className="px-2 py-[2px] text-end text-[13px] text-muted-foreground">
                <div className="leading-4">
                  {`${formatNumber(item.quantity)} ${item.unitOfMeasure ?? ''}`.trim()}
                </div>
                <div
                  className="text-[11px] leading-[13px] tabular-nums text-ink-3"
                  title={t('results.unitPrice')}
                >
                  {money.unitPrice === null ? (
                    <span aria-hidden>{SUPPRESSED}</span>
                  ) : (
                    <>
                      <span aria-hidden>×</span> {formatMoney(money.unitPrice)}
                    </>
                  )}
                </div>
              </td>

              <td className="px-2 align-middle text-end">
                <PromoMark slot={money.promoSlot} t={t} />
              </td>

              <MoneyCell value={money.was} notPriced={money.notPriced} className="text-muted-foreground" />
              <MoneyCell value={money.saved} notPriced={money.notPriced} />

              <td className="px-2 align-middle text-end">
                {money.netTotal === null ? (
                  <span className="text-[11.5px] italic text-ink-3">{t('results.notPriced')}</span>
                ) : (
                  <span className="text-[14px] font-semibold tabular-nums">
                    {formatMoney(money.netTotal)}
                    <span className="ms-1 text-[10px] font-medium text-muted-foreground">{currency}</span>
                  </span>
                )}
              </td>
            </tr>,

            // The expansion, in place: its own row, one `colSpan` cell, so the surface
            // inside it is bounded by the table's width and can never widen the frame.
            // Rendered only while open — a closed line contributes NOTHING to the
            // frame's height, which is what "resting height depends only on line
            // count" means.
            open ? (
              <tr
                key={`${item.itemNumber}-expansion`}
                className="border-b border-b-divider bg-card-2/40 last:border-b-0"
              >
                <td colSpan={7} className="border-s-[3px] border-s-primary p-0">
                  <SimLineExpansion item={item} currency={currency} notPriced={money.notPriced} />
                </td>
              </tr>
            ) : null,
          ]
        })}
      </tbody>
    </table>
  )
}

/** Enter / Space selects, mirroring a native button. */
function onRowKey(e: KeyboardEvent, select: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    select()
  }
}

/**
 * One money column. Three renderings for three different facts: a figure · a faint
 * `·` for *nothing happened here* (never `0.00`, which would read as *we measured,
 * and it was nothing*) · an em-dash for *this line did not price*.
 */
function MoneyCell({
  value,
  notPriced,
  className,
}: {
  value: number | null
  notPriced: boolean
  className?: string
}) {
  return (
    <td className={`px-2 align-middle text-end text-[13px] tabular-nums ${className ?? ''}`}>
      {value === null ? (
        <span className="text-ink-3" aria-hidden>
          {notPriced ? SUPPRESSED : BLANK}
        </span>
      ) : (
        formatMoney(value)
      )}
    </td>
  )
}

/** The engine's status letter → the severity the badge wears, and the word for it. */
const STATUS_SEVERITY: Record<'E' | 'W', Severity> = { E: 'bad', W: 'warn' }
const STATUS_LABEL: Record<'E' | 'W', string> = { E: 'status.error', W: 'status.warning' }

/**
 * The promotion slot — one slot, exactly one of four states (104 §3): `✔ fired` (the
 * hue budget's first spend), 082's `StatusBadge` carrying the engine's own status
 * letter, a neutral `MANUAL` chip, or an em-dash. Fired and MANUAL stack; fired and
 * the badge cannot co-occur, which is why there is no status column.
 *
 * The badge's label is the wire's own status letter — server-supplied data, not a
 * literal; the human word for it rides the `title`, and the line reads `not priced`
 * in words in its money column regardless.
 */
function PromoMark({ slot, t }: { slot: PromoSlot; t: ReturnType<typeof useTranslation>[0] }) {
  if (slot.state === 'warned') {
    return (
      <span className="inline-flex" title={t(STATUS_LABEL[slot.status])}>
        <StatusBadge sev={STATUS_SEVERITY[slot.status]}>{slot.status}</StatusBadge>
      </span>
    )
  }
  if (slot.state === 'none') {
    return (
      <span className="text-ink-3" aria-hidden>
        {SUPPRESSED}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {slot.state === 'fired' ? (
        <span className="text-[11.5px] font-semibold text-success-800">
          <span aria-hidden>✔</span> {t('results.fired')}
        </span>
      ) : null}
      {slot.state === 'manual' || slot.manual ? <ManualChip t={t} /> : null}
    </span>
  )
}

/** The hand-entered mark. Reuses `detail.badge.manual` — one key, two call sites — on
 *  the same neutral chip ground every non-severity chip on this screen shares. */
function ManualChip({ t }: { t: ReturnType<typeof useTranslation>[0] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${KIND_CHIP}`}
    >
      {t('detail.badge.manual')}
    </span>
  )
}
