import type { ICellRendererParams } from 'ag-grid-community'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import type { OrderGuardState } from './guard-check'

const SEV: Record<OrderGuardState, Severity> = { none: 'mute', actionNeeded: 'warn', pending: 'go', unchecked: 'mute' }

/**
 * The order list's Guard check cell (BackOffice 3142, oms ticket 616): the state's word as a pill, nothing
 * for `none`. The word is the column's value (its `valueGetter`, from `insurance-order-guards:state.*`), so
 * sort, filter, Ctrl+C and the export read the same word; it is isolated here (`<bdi>`), as a column with
 * its own renderer must.
 */
export function GuardStateCell(params: ICellRendererParams<{ guardState?: OrderGuardState }>) {
  const state = params.data?.guardState
  if (!state || state === 'none' || !params.value) return null
  return (
    <span data-guard-state={state}>
      <StatusBadge sev={SEV[state] ?? 'mute'}>
        <bdi>{String(params.value)}</bdi>
      </StatusBadge>
    </span>
  )
}
