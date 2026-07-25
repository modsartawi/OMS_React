import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Boolean flag cell for the pricing-elements trace. Two modes so the colour isn't the
// only channel and the semantics read right:
//   'met'   — a green check when true, a red X when false (a prerequisite is/ isn't met);
//   'check' — a green check when true, a muted dash when false (a neutral flag column:
//             statistical / subtotal / bonus-buy).
//
// Ticket 116 took the AG Grid renderer signature off it: the trace is a plain table now
// (the feature's last grid went with `SimBonusBuyPanel`), so this takes a plain `value`
// prop instead of `ICellRendererParams`. The component itself is otherwise unchanged —
// the trace still has its three flag columns and they still read the same.
interface Props {
  value: boolean
  mode?: 'met' | 'check'
}

export default function BoolCell({ value, mode = 'check' }: Props) {
  const { t } = useTranslation('simulation')
  const label = value ? t('bonus.yes') : t('bonus.no')

  return (
    <span className="flex h-full items-center justify-center" title={label} aria-label={label}>
      {value ? (
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : mode === 'met' ? (
        <X className="h-4 w-4 text-danger" aria-hidden />
      ) : (
        <span className="text-muted-foreground" aria-hidden>
          –
        </span>
      )}
    </span>
  )
}
