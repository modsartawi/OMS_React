import type { ServingListRow } from '@/core/models/serving-list'

export interface MembersToolbarProps {
  servingListId: string
  /** The list's row; undefined while it loads or when the id is unknown. */
  list: ServingListRow | undefined
  /** `canEditServingLists`. */
  canEdit: boolean
}

/**
 * 🧩 SEAM for ticket 569 — the Members tab's toolbar, at the end of the filter bar (the add-stores picker's
 * button). `MembersTab` always renders it; it renders nothing until 569 replaces this file.
 */
export default function MembersToolbar(_props: MembersToolbarProps) {
  return null
}
