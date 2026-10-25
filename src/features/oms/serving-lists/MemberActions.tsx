import type { ComponentType } from 'react'
import type { MemberCellParams } from './member-columns'

/**
 * 🧩 SEAM for ticket 570 — a member row's actions (enable / disable, remove).
 *
 * `MembersTab` passes this to `buildMemberColumns(t, { actions: MemberActionsCell })`. While it is `null`
 * the Members grid has no actions column. 570 replaces this file's export with a cell renderer; the column
 * (pinned at the end, colId `actions`) then appears. The renderer reads the row as `p.data` and
 * `{ servingListId, list, canEdit }` as `p.context` (`MembersGridContext`), and after a write invalidates
 * `[...SERVING_LIST_MEMBERS_KEY, servingListId]` and `SERVING_LISTS_KEY` (`./api`).
 */
export const MemberActionsCell: ComponentType<MemberCellParams> | null = null
