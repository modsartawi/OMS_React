import type { ICellRendererParams } from 'ag-grid-community'
import { useTranslation } from 'react-i18next'
import type { SimulationResultItem } from '@/core/models/simulation'

// Results-grid cell renderer for `pricingStatus`: a red (E) / amber (W) / green ('')
// dot — the at-a-glance line-health signal (spec 503, story 13). The status text is
// exposed via title + aria-label so the colour isn't the only channel.
export default function StatusDot(params: ICellRendererParams<SimulationResultItem>) {
  const { t } = useTranslation('simulation')
  const status = (params.value as string) ?? ''
  const tone = status === 'E' ? 'error' : status === 'W' ? 'warning' : 'ok'
  const color =
    tone === 'error' ? 'bg-red-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
  const label = t(`status.${tone}`)

  return (
    <span className="flex h-full items-center justify-center" title={label} aria-label={label}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  )
}
