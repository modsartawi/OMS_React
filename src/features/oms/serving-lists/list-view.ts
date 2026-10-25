/**
 * The Serving lists grid's row view (oms ticket 567, BackOffice spec 3042). Pure: no React, no i18n.
 */
import type { ServingListRow } from '@/core/models/serving-list'
import { formatCount } from '@/core/util/bidi'

/** Enabled of all members, as one `n / m` string (isolated once by the cell). */
export function membersLabel(row: ServingListRow): string {
  return formatCount(row.enabledMemberCount, row.memberCount)
}

export interface PointingChip {
  code: string
  /** The type's description, or its code when the description is blank. */
  tooltip: string
  competed: boolean
}

/** One chip per pointing type, in the door's order. Read-only: pointing a type is an HQ script. */
export function pointingChips(row: ServingListRow): PointingChip[] {
  return (row.pointingTypes ?? []).map((p) => ({
    code: p.documentType,
    tooltip: p.description.trim() || p.documentType,
    competed: p.isCompeted === true,
  }))
}

/**
 * What the row warns of, worst first:
 * - `noEnabledMember` — active, a competed type points at it, and no member is enabled: those deliveries
 *   record `ServingListInactive` and are never competed;
 * - `deactivatedCompeted` — deactivated while a competed type still points at it (the same outcome);
 * - `empty` — no member at all, and nothing competed depends on it.
 */
export type ListFlag = 'noEnabledMember' | 'deactivatedCompeted' | 'empty'

export function listFlag(row: ServingListRow): ListFlag | null {
  const competed = (row.pointingTypes ?? []).some((p) => p.isCompeted === true)
  if (competed && !row.isActive) return 'deactivatedCompeted'
  if (competed && row.enabledMemberCount === 0) return 'noEnabledMember'
  if (row.memberCount === 0) return 'empty'
  return null
}
