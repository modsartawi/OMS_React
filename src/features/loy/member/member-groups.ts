/**
 * The member's loyalty groups as the header shows them (ticket 635, brief 3173 "Lookup (3176)").
 *
 * Pure, beside `member-header.ts`, for the same reason: the show-or-hide rule is the one an agent
 * could get wrong silently, and it has no business living in JSX.
 *
 * Names come from `@/core/loy-groups` — never from `features/loy/groups` (features never import
 * features).
 */
import { loyGroupName } from '@/core/loy-groups/api'
import type { LoyGroup } from '@/core/models/loy-groups'

export interface MemberGroupChip {
  code: string
  /** The group's name in the UI language, as stored; the code itself when the list has no name for it. */
  name: string
}

/** `show: false` ⇒ draw nothing. `show: true` with no chips ⇒ the member is in no group. */
export type MemberGroupsView = { show: false } | { show: true; chips: MemberGroupChip[] }

/**
 * 🚩 **Absent or `[]` without the view grant means "not shown", never "in no group".** The door sends
 * the field only to a caller holding view, so the row appears only when BOTH the grant and the field
 * are there; a field arriving without the grant is still hidden (HQ-only, brief "Never show groups to a
 * cashier or agent"). Order is the server's (sorted codes) — not re-sorted by name.
 */
export function memberGroups(
  codes: readonly string[] | null | undefined,
  canView: boolean,
  list: readonly LoyGroup[] | undefined,
  lang: string,
): MemberGroupsView {
  if (!canView || !Array.isArray(codes)) return { show: false }
  // Case-insensitive, as the picker's selection reads codes (`@/core/loy-groups/selection`).
  const byCode = new Map((list ?? []).map((g) => [g.code.toUpperCase(), g]))
  return {
    show: true,
    chips: codes.map((code) => {
      const g = byCode.get(code.toUpperCase())
      const name = g ? loyGroupName(g, lang) : ''
      return { code, name: name.trim() === '' ? code : name }
    }),
  }
}
