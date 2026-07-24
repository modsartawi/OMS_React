import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ChevronRight } from 'lucide-react'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import type { MissedPrereq, MissedPromo } from './promo-view'
import { KIND_CHIP, KIND_GLYPH } from './promo-kind'

// The "Could have applied" section (ticket 048) — the near-misses beneath the fired
// promotion blocks (SimPromoBlocks, 047). Driven by `promoView(result).missed` (045),
// it surfaces the promotions that COULD apply but did not, so an absent offer is
// diagnosed here rather than two tabs away — this folds in the old Potential Bonus
// Buys tab. Each entry is collapsed by default; expanding reveals:
//   • the driving UNMET prerequisite as a found-vs-required meter (found qty/value vs
//     required qty / min value — the data `potentialBonusBuys[].prerequisites[].isMet`
//     already carries, projected onto `missed[].prereq`);
//   • a short plain-language REASON ("basket has 50.00 of the 100.00 minimum");
//   • the WOULD-SAVE figure — the discount it would have granted had the prereq been met.
// When accumulation (not a prerequisite) blocked it, `prereq` is null and the server
// `skipReason` reads as the reason instead. Absent entirely when nothing was missed
// (the whole section returns null), so a fully-fired basket shows no "Could have applied".

interface Props {
  missed: MissedPromo[]
  currency: string
}

export default function SimMissedPromotions({ missed, currency }: Props) {
  const { t } = useTranslation('simulation')

  // A fully-fired basket has no near-misses — the section is absent, not empty.
  if (missed.length === 0) return null

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t('missed.sectionTitle')}</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {t('missed.count', { count: missed.length })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {missed.map((m) => (
          <MissedRow key={m.bbyNumber} missed={m} currency={currency} t={t} />
        ))}
      </div>
    </div>
  )
}

function MissedRow({ missed, currency, t }: { missed: MissedPromo; currency: string; t: TFunction }) {
  const [expanded, setExpanded] = useState(false)
  const glyph = missed.kind ? KIND_GLYPH[missed.kind] : '•'
  const name = missed.description || t('missed.fallbackName')

  return (
    <div className={'rounded-lg border transition-colors ' + (expanded ? 'border-border' : 'border-border/60')}>
      {/* Collapsed header — the disclosure trigger: kind glyph · name · would-save · chevron. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 rounded-lg p-2.5 text-start hover:bg-muted/40"
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm font-bold ${KIND_CHIP}`}
          aria-hidden
        >
          {glyph}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <IdentitySubLine missed={missed} t={t} />
        </span>
        {missed.wouldSave != null && missed.wouldSave > 0 ? (
          <span className="shrink-0 text-end">
            <span className="block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              {t('missed.wouldSaveLabel')}
            </span>
            <span className="block text-sm font-bold tabular-nums text-muted-foreground">
              {formatMoney(missed.wouldSave)}{' '}
              <span className="text-[10px] font-medium">{currency}</span>
            </span>
          </span>
        ) : null}
        <ChevronRight
          className={'h-4 w-4 shrink-0 text-muted-foreground transition-transform rtl:rotate-180 ' + (expanded ? 'rotate-90 rtl:-rotate-90' : '')}
          aria-hidden
        />
      </button>

      {/* Expanded — the found-vs-required meter + a plain-language reason. */}
      {expanded ? (
        <div className="border-t border-border/60 p-2.5">
          {missed.prereq ? (
            <PrereqMeter prereq={missed.prereq} t={t} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {missed.skipReason ? t('missed.skipReason', { reason: missed.skipReason }) : t('missed.noReason')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** BBY key · promo no — the near-miss identity, as separated spans (not a concatenated
 *  `·`) so the middot never mis-orders between bidi runs under RTL. Empty parts drop. */
function IdentitySubLine({ missed, t }: { missed: MissedPromo; t: TFunction }) {
  const parts = [
    missed.bbyNumber || null,
    missed.promoNumber ? t('promo.promoNoLabel', { promo: missed.promoNumber }) : null,
  ].filter((p): p is string => Boolean(p))

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
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
    </span>
  )
}

/** The driving unmet prerequisite as a found-vs-required meter: value-based when the
 *  prereq carries a minimum value, else quantity-based. The reason line reads the same
 *  numbers in plain language. */
function PrereqMeter({ prereq, t }: { prereq: MissedPrereq; t: TFunction }) {
  // Decide the value-vs-qty axis once, then read found / required / formatter / reason
  // off that single choice — rather than re-deciding `value ? … : …` at each use.
  const value = prereq.minValue > 0
  const found = value ? prereq.foundValue : prereq.foundQty
  const required = value ? prereq.minValue : prereq.requiredQty
  const fmt = value ? formatMoney : formatNumber
  const reasonKey = value ? 'missed.reasonValue' : 'missed.reasonQty'
  // Guard a zero/absent requirement (neither qty nor value drives it) so the bar and
  // reason never divide by zero — fall back to the prereq identity alone.
  const hasTarget = required > 0
  const pct = hasTarget ? Math.min(100, Math.max(0, (found / required) * 100)) : 0

  const subject = prereq.materialNumber
    ? t('missed.prereqMaterial', { material: prereq.materialNumber })
    : prereq.matGrouping
      ? t('missed.prereqGrouping', { grouping: prereq.matGrouping })
      : t('missed.prereqAny')

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-medium">{subject}</span>
        {hasTarget ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {t('missed.found', { found: fmt(found), required: fmt(required) })}
          </span>
        ) : null}
      </div>

      {hasTarget ? (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={found}
          aria-valuemin={0}
          aria-valuemax={required}
        >
          <div className="h-full rounded-full bg-attention" style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {hasTarget ? t(reasonKey, { found: fmt(found), required: fmt(required) }) : t('missed.noReason')}
      </p>
    </div>
  )
}
