import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// One boolean flag in the pricing-elements trace: a check when true, a muted dash when
// false. Colour is never a channel here at all — the glyph carries the meaning and the
// `title`/`aria-label` carry the word.
//
// Ticket 121 took the check's `text-success` off. The screen's whole hue budget is TWO:
// `success` on a fired promotion, `attention` on a `W` line. This check paints a flag
// column — *this row is statistical* / *subtotal* / *bonus-buy* — which is neither a
// success nor a severity, so spending `success` on it made the two-hue statement untrue
// of the built screen. It reads `currentColor` now, inheriting the trace's own ink.
//
// Ticket 116 took two things off it. The AG Grid renderer signature went, because the
// trace is a plain table now (the feature's last grid went with `SimBonusBuyPanel`), so
// it takes a plain `value` prop instead of `ICellRendererParams`. And the `mode` prop
// went with it: the `'met'` mode — a red X for an unmet prerequisite — was for the
// bonus-buy prerequisites grid, which dissolved before this slice, leaving the flag
// columns (statistical / subtotal / bonus-buy) as the only callers. A prop with no
// caller is a shape nothing exercises; the red X comes back with a screen that needs it.
interface Props {
  value: boolean
}

export default function BoolCell({ value }: Props) {
  const { t } = useTranslation('simulation')
  const label = value ? t('bonus.yes') : t('bonus.no')

  return (
    <span className="flex h-full items-center justify-center" title={label} aria-label={label}>
      {value ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <span className="text-muted-foreground" aria-hidden>
          –
        </span>
      )}
    </span>
  )
}
