import type { ServingListRow } from '@/core/models/serving-list'

export interface HeaderActionsProps {
  /** The list's row (the header renders the slot only once it is known). */
  list: ServingListRow
  /** `canEditServingLists`. */
  canEdit: boolean
}

/**
 * 🧩 SEAM for ticket 570 — the detail header's actions (rename, deactivate / reactivate), at the header's
 * end. `ListHeader` always renders it; it renders nothing until 570 replaces this file.
 */
export default function HeaderActions(_props: HeaderActionsProps) {
  return null
}
