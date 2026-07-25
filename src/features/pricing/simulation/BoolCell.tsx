import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// One boolean flag in the pricing-elements trace: a green check when true, a muted dash
// when false. Colour is never the only channel — the glyph carries the meaning and the
// `title`/`aria-label` carry the word.
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
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <span className="text-muted-foreground" aria-hidden>
          –
        </span>
      )}
    </span>
  )
}
