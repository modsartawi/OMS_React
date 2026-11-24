import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import LoyGroupPicker from '@/core/loy-groups/LoyGroupPicker'
import { canViewLoyGroups } from '@/core/loy-groups/api'
import { normaliseLoyGroupValue } from '@/core/loy-groups/selection'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import { usePermissions } from '@/core/permissions'
import { fsi } from '@/core/util/bidi'
import { SIM_SEATS, seatOrigin, seatProblem, type SimSeat } from './seat'

// The header inputs feeding SimulateRequest.header. Owner layout (488): a dense
// 4-column grid (NOT the WPF's 2-column) — determination fields on row 1, procedure
// key + loyalty on row 2 — with the Promotion / Pricing Elements checkboxes beneath.
// Empty loyalty fields are coerced to null when the request is built (request.ts).
//
// Ticket 113 turned this from a framed card into **the run strip's expansion**: it
// draws no border and no heading of its own, mounts only while the strip is open,
// and its footer (Process / Clear / Wipe cache) belongs to `SimRunStrip`.
export interface SimHeaderState {
  plant: string
  /** The seat (ticket 957) — the request's origin is derived from it (`seat.ts`). */
  seat: SimSeat
  /** The Custom seat's typed origin; kept while another seat is picked, sent only under Custom. */
  customOrigin: string
  pricingDate: string
  salesOrganization: string
  distributionChannel: string
  documentPricingProcedureKey: string
  loyGroups: string
  loyTier: string
}

// The loyalty-tier codes offered in the header select, in order. An empty selection
// (no tier) is the first option; the Page coerces a blank `loyTier` to null on submit.
const LOY_TIERS = ['S', 'G', 'P'] as const

// Today's date as a `YYYY-MM-DD` string in LOCAL time (not toISOString(), which is
// UTC and can land on the wrong calendar day near midnight).
function todayIso(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// The starting header — sensible defaults for the common Wasfaty basket so an analyst
// can Process without retyping the determination fields. A factory (not a const) so
// the pricing date is re-evaluated to "today" on each mount and on Clear. Loyalty
// fields stay blank (optional). Also drives Clear (SimulationPage.clearAll).
export function defaultHeader(): SimHeaderState {
  return {
    plant: 'P001',
    // A store till: no origin, so the plant is the origin — what the simulator always priced.
    seat: 'store',
    customOrigin: '',
    pricingDate: todayIso(),
    salesOrganization: '1000',
    distributionChannel: '20',
    documentPricingProcedureKey: '',
    loyGroups: '',
    loyTier: '',
  }
}

interface Props {
  value: SimHeaderState
  onChange: (patch: Partial<SimHeaderState>) => void
  promotion: boolean
  pricingElements: boolean
  onPromotionChange: (next: boolean) => void
  unactivated: boolean
  onUnactivatedChange: (next: boolean) => void
  onPricingElementsChange: (next: boolean) => void
  disabled?: boolean
  /** Expanding the run strip focuses the first field — Plant (ticket 113, 102 §6). */
  autoFocusFirstField?: boolean
}

export default function SimHeaderForm({
  value,
  onChange,
  promotion,
  pricingElements,
  onPromotionChange,
  unactivated,
  onUnactivatedChange,
  onPricingElementsChange,
  disabled,
  autoFocusFirstField,
}: Props) {
  const { t } = useTranslation('simulation')
  // Ticket 637: the basket's loyalty groups are picked from the defined groups — but only under the
  // view grant. Without it, and while the probe is out or has failed, the field stays today's free
  // text (D3: a simulation is a test, not a write), never the picker's read-only fallback.
  const permissions = usePermissions()
  const pickLoyGroups = canViewLoyGroups(permissions)
  // When the field turns into the picker (the probe answered after the user typed free text), the
  // picker shows the normalised codes: write them back, so the request carries what is shown.
  useEffect(() => {
    if (!pickLoyGroups) return
    const normalised = normaliseLoyGroupValue(value.loyGroups)
    if (normalised !== value.loyGroups) onChange({ loyGroups: normalised })
  }, [pickLoyGroups, value.loyGroups, onChange])

  const field = (
    key: keyof SimHeaderState,
    label: string,
    opts?: { type?: string; hint?: string; placeholder?: string; autoFocus?: boolean },
  ) => (
    // The label wraps its control (an implicit label): the shared Input inside, the arrangement
    // as it was — the run strip's drive reads a focused field's name off its enclosing label.
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type={opts?.type ?? 'text'}
        value={value[key]}
        placeholder={opts?.placeholder}
        disabled={disabled}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the form only mounts
        // on an explicit Edit ▾, so focusing its first field is the expansion's
        // own choreography, not a page-load focus steal.
        autoFocus={opts?.autoFocus}
        onChange={(e) => onChange({ [key]: e.target.value })}
      />
      {opts?.hint ? <span className="text-[0.7rem] text-muted-foreground">{opts.hint}</span> : null}
    </label>
  )

  const loyGroupsField = pickLoyGroups ? (
    <Field label={t('header.loyGroup')}>
      <LoyGroupPicker
        label={t('header.loyGroup')}
        value={value.loyGroups}
        disabled={disabled}
        data-testid="sim-header-loyGroups"
        onChange={(loyGroups) => onChange({ loyGroups })}
      />
    </Field>
  ) : (
    field('loyGroups', t('header.loyGroup'))
  )

  // The Seat (ticket 957, spec 4190) — beside Plant, because the seat is the origin and a store
  // till's origin IS the plant. The origin it sends reads beneath it, so Mini POS visibly follows a
  // plant edit; Custom opens a free-text origin under the select.
  const origin = seatOrigin(value)
  const seatField = (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t('header.seat')}</span>
        <Select
          value={value.seat}
          disabled={disabled}
          data-testid="sim-header-seat"
          onChange={(e) => onChange({ seat: e.target.value as SimSeat })}
        >
          {SIM_SEATS.map((seat) => (
            <option key={seat} value={seat}>
              {t(`header.seatOptions.${seat}`)}
            </option>
          ))}
        </Select>
      </label>
      {value.seat === 'custom' ? (
        <Input
          value={value.customOrigin}
          disabled={disabled}
          aria-label={t('header.customOrigin')}
          placeholder={t('header.customOrigin')}
          data-testid="sim-header-customOrigin"
          onChange={(e) => onChange({ customOrigin: e.target.value })}
        />
      ) : null}
      <span className="text-[0.7rem] text-muted-foreground">
        {seatProblem(value) !== null
          ? t(`process.refused.${seatProblem(value)}`)
          : origin !== null
            ? t('header.seatOrigin', { origin: fsi(origin) })
            : t('header.seatOriginPlant')}
      </span>
    </div>
  )

  const loyTierField = (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{t('header.loyTier')}</span>
      <Select value={value.loyTier} disabled={disabled} onChange={(e) => onChange({ loyTier: e.target.value })}>
        <option value="">{t('header.loyTierNone')}</option>
        {LOY_TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {t(`header.loyTierOptions.${tier}`)}
          </option>
        ))}
      </Select>
    </label>
  )

  // No frame and no heading of its own: ticket 113 dissolved the Header card into
  // the run strip's expansion, and `header.title` retires with it.
  return (
    <div className="flex flex-col gap-3">
      {/* `@[680px]` on the WORK AREA, not `md:` on the viewport (ticket 119) — this was
          the feature's last viewport prefix. `md:` (768 px of window) fired at a work
          area of ~500, four fields into 500 px; the container query fires when there is
          actually room for four. 680 = four ~155 px fields plus the grid's three gaps. */}
      <div className="grid grid-cols-2 gap-3 @[680px]:grid-cols-4">
        {field('plant', t('header.plant'), { autoFocus: autoFocusFirstField })}
        {seatField}
        {field('pricingDate', t('header.pricingDate'), { type: 'date' })}
        {field('salesOrganization', t('header.salesOrg'))}
        {field('distributionChannel', t('header.distChannel'))}
        {field('documentPricingProcedureKey', t('header.procedureKey'), {
          hint: t('header.procedureKeyHint'),
        })}
        {loyGroupsField}
        {loyTierField}
      </div>

      {/* The two flags ride under the fields — both are inputs to the same run,
          and both chip in the collapsed strip (promotion in either state). */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
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
            checked={unactivated}
            disabled={disabled}
            onChange={(e) => onUnactivatedChange(e.target.checked)}
          />
          {t('header.unactivated')}
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
  )
}
