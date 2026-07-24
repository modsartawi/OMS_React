import type { ICellRendererParams } from 'ag-grid-community'
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Boolean flag cell renderer for the bonus-buy / pricing-elements grids (ticket 015).
// Two modes so the colour isn't the only channel and the semantics read right:
//   'met'   — a green check when true, a red X when false (a prerequisite is/ isn't met);
//   'check' — a green check when true, a muted dash when false (a neutral flag column:
//             statistical / subtotal / bonus-buy). `mode` arrives via cellRendererParams.
interface BoolCellParams extends ICellRendererParams {
  mode?: 'met' | 'check'
}

export default function BoolCell(params: BoolCellParams) {
  const { t } = useTranslation('simulation')
  const value = Boolean(params.value)
  const mode = params.mode ?? 'check'
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
