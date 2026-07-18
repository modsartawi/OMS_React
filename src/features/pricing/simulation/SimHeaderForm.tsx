import { useTranslation } from 'react-i18next'

// The header inputs feeding SimulateRequest.header. Owner layout (488): a dense
// 4-column grid (NOT the WPF's 2-column) — determination fields on row 1, procedure
// key + loyalty on row 2 — with the Promotion / Pricing Elements checkboxes inline
// on the title row. Empty loyalty fields are coerced to null at the Page on submit.
export interface SimHeaderState {
  plant: string
  pricingDate: string
  salesOrganization: string
  distributionChannel: string
  documentPricingProcedureKey: string
  loyId: string
  loyGroups: string
  loyTier: string
}

export const EMPTY_HEADER: SimHeaderState = {
  plant: '',
  pricingDate: '',
  salesOrganization: '',
  distributionChannel: '',
  documentPricingProcedureKey: '',
  loyId: '',
  loyGroups: '',
  loyTier: '',
}

interface Props {
  value: SimHeaderState
  onChange: (patch: Partial<SimHeaderState>) => void
  promotion: boolean
  pricingElements: boolean
  onPromotionChange: (next: boolean) => void
  onPricingElementsChange: (next: boolean) => void
  disabled?: boolean
}

export default function SimHeaderForm({
  value,
  onChange,
  promotion,
  pricingElements,
  onPromotionChange,
  onPricingElementsChange,
  disabled,
}: Props) {
  const { t } = useTranslation('simulation')

  const field = (
    key: keyof SimHeaderState,
    label: string,
    opts?: { type?: string; hint?: string; placeholder?: string },
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={opts?.type ?? 'text'}
        value={value[key]}
        placeholder={opts?.placeholder}
        disabled={disabled}
        onChange={(e) => onChange({ [key]: e.target.value })}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-60"
      />
      {opts?.hint ? <span className="text-[0.7rem] text-muted-foreground">{opts.hint}</span> : null}
    </label>
  )

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">{t('header.title')}</h2>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={promotion}
              disabled={disabled}
              onChange={(e) => onPromotionChange(e.target.checked)}
            />
            {t('header.promotion')}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={pricingElements}
              disabled={disabled}
              onChange={(e) => onPricingElementsChange(e.target.checked)}
            />
            {t('header.pricingElements')}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {field('plant', t('header.plant'))}
        {field('pricingDate', t('header.pricingDate'), { type: 'date' })}
        {field('salesOrganization', t('header.salesOrg'))}
        {field('distributionChannel', t('header.distChannel'))}
        {field('documentPricingProcedureKey', t('header.procedureKey'), {
          hint: t('header.procedureKeyHint'),
        })}
        {field('loyId', t('header.loyId'))}
        {field('loyGroups', t('header.loyGroup'))}
        {field('loyTier', t('header.loyTier'))}
      </div>
    </div>
  )
}
