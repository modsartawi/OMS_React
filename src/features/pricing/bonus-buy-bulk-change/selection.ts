/**
 * Which bonus buys the bulk change may take (BackOffice spec 4190 stories 14, 15, 32; oms 958). Pure.
 *
 * Only a **Planned OMS** bonus buy is selectable; every other row is shown locked with its reason. The
 * server enforces the same (a row that is not Planned when written is refused), so this lock is a
 * convenience, never the protection.
 */
import { readBbyStatus } from '@/core/bonus-buy/status'
import { readSalesArea, type SalesAreaFields } from '@/core/bonus-buy/sales-area'

/** Why a row cannot be picked. */
export type LockReason = 'tested' | 'activated' | 'deactivated' | 'notOms' | 'unknown'

export interface SelectableRow extends SalesAreaFields {
  bbyNumber: string
  bbyStatus: string | null | undefined
  /** The server's own lock (`BbyBulkListRow.Locked`: any status but Planned). */
  locked?: boolean | null
}

/** An OMS-authored bonus buy's number (`OMS` + nine digits); anything else is SAP's, never edited here. */
const OMS_NUMBER = /^OMS\d{9}$/

/** The server's per-call cap (`BbyBulkLimits.MaxBonusBuys`, both bulk acts; BackOffice 4193). */
export const BULK_CAP = 200

/** Null when the row may be picked; otherwise why not. A row the server says is locked is never picked. */
export function lockReason(row: SelectableRow): LockReason | null {
  if (!OMS_NUMBER.test(row.bbyNumber.trim())) return 'notOms'
  const status = readBbyStatus(row.bbyStatus)
  if (status !== 'planned') return status
  return row.locked === true ? 'unknown' : null
}

/** Select all: the Planned rows of `rows`, in order, and how many it left out. */
export function selectAllPlanned(rows: readonly SelectableRow[]): { selected: string[]; skipped: number } {
  const selected = rows.filter((r) => lockReason(r) === null).map((r) => r.bbyNumber)
  return { selected, skipped: rows.length - selected.length }
}

export type BatchProblem = 'empty' | 'overCap' | 'mixedSalesArea'

/**
 * What stops the selected rows being sent as one batch: none, more than the cap, or more than one
 * sales area (the server refuses such a batch whole — a maximum value is an amount in one currency).
 */
export function batchProblem(rows: readonly SelectableRow[]): BatchProblem | null {
  if (rows.length === 0) return 'empty'
  if (rows.length > BULK_CAP) return 'overCap'
  const areas = new Set(rows.map((r) => {
    const a = readSalesArea(r)
    return `${a.salesOrganization}/${a.distributionChannel}`
  }))
  return areas.size > 1 ? 'mixedSalesArea' : null
}
