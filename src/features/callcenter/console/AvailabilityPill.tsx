/**
 * Availability, in the three states that are opposite decisions for the agent —
 * a count, *none at store*, *stock unknown* — differing in ground, ink **and**
 * wording (135's ruling, ticket 168).
 *
 * 🚩 It is ONE component drawn in two registers, which is ticket 169's point.
 * The search row shows availability as it is **now**; a basket line shows it as
 * it was **frozen at add** (§2.1), and the two must never read alike — so the
 * classification and the shape are shared while the wording is not. `keyBase`
 * picks the sentence: `search.atp.*` reads *12 in stock*, `line.atp.*` reads
 * *12 at add*. A pill that said the same thing in both places would be telling
 * the agent that a five-minute-old freeze is live stock.
 *
 * Colour is never the only difference. An agent reading at speed under a headset
 * is exactly who a colour-only distinction fails.
 */
import { useTranslation } from 'react-i18next'
import type { Availability } from './item-search'

export default function AvailabilityPill({
  availability,
  keyBase,
  title,
}: {
  availability: Availability
  /** The namespace of the three sentences — `search.atp` or `line.atp`. */
  keyBase: 'search.atp' | 'line.atp'
  /** An optional hover, where there is more to say than the pill has room for
   *  (when a line's availability was frozen). Server-supplied or composed by the
   *  caller; never a second copy of the label. */
  title?: string
}) {
  const { t } = useTranslation('callcenter')
  const tone =
    availability.tone === 'positive'
      ? 'border-success-border bg-success-050 text-success-800'
      : availability.tone === 'negative'
        ? 'border-danger-border bg-danger-050 text-danger-800'
        : 'border-attention-border bg-attention-050 text-attention-800'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
      data-cc-atp={availability.kind}
      title={title}
    >
      {t(`${keyBase}.${availability.labelKey}`, { qty: availability.quantity })}
    </span>
  )
}
