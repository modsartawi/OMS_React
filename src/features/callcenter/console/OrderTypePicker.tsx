/**
 * The order-type picker and badge (ticket 1007, spec 1006 D1, D10, default A).
 *
 * - **The picker** is one segmented control in the header's ledger, beside the source: *Phone order ·
 *   Wasfaty · Nphies*, only the types the seat may mint (`offeredOrderTypes`), and absent when
 *   that leaves no choice. Each option is the shared `Chip` (`toggle`), so the control costs the
 *   ratchet nothing. Choosing a type sends `setOrderType`; the picker draws its own failure.
 * - **The badge** names a Wasfaty or Nphies order on the order title and the receipt, so it is
 *   never mistaken for a phone order mid-call. A phone order carries none: it is the default.
 */
import { useTranslation } from 'react-i18next'
import type { OrderType, SessionState } from '@/core/models/callcenter'
import Chip from '@/core/ui/Chip'
import { isPrescriptionOrder, offeredOrderTypes, orderTypeLabelKey, orderTypeOf } from './order-type'

export interface OrderTypeActions {
  /** Absent while the order is not open — the options then draw as a readout. */
  onPick?: (type: OrderType) => void
  pending: boolean
  /** The last switch's refusal, worded by the page. */
  error: string | null
}

export function OrderTypePicker({ state, actions }: { state: SessionState; actions?: OrderTypeActions }) {
  const { t } = useTranslation('callcenter')
  const options = offeredOrderTypes(state.capabilities)
  if (options.length === 0) return null
  const current = orderTypeOf(state.header)
  const onPick = actions?.onPick
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-cc-order-type={current}>
      <span className="shrink-0 text-[10.5px] uppercase tracking-wide text-muted-foreground" id="cc-order-type-label">
        {t('orderType.label')}
      </span>
      <span role="group" aria-labelledby="cc-order-type-label" className="inline-flex gap-1">
        {options.map((type) => (
          <Chip
            key={type}
            on={type === current}
            disabled={!onPick || actions?.pending}
            onClick={type === current || !onPick ? undefined : () => onPick(type)}
            data-cc-order-type-option={type}
          >
            {t(orderTypeLabelKey(type))}
          </Chip>
        ))}
      </span>
      {actions?.error && (
        <span className="text-[11px] text-danger-800" role="alert" data-cc-order-type-error>
          {/* Server-supplied or worded by the page; free text in either script. */}
          <bdi>{actions.error}</bdi>
        </span>
      )}
    </span>
  )
}

/** The prescription order's badge. Nothing for a phone order. */
export function OrderTypeBadge({ state, where }: { state: SessionState; where: 'title' | 'receipt' }) {
  const { t } = useTranslation('callcenter')
  if (!isPrescriptionOrder(state.header)) return null
  const type = orderTypeOf(state.header)
  return (
    <span
      className="rounded border border-attention-border bg-attention-050 px-1.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-attention-800"
      title={t('orderType.badgeTitle')}
      data-cc-order-type-badge={where}
      data-cc-order-type-value={type}
    >
      {t(orderTypeLabelKey(type))}
    </span>
  )
}
