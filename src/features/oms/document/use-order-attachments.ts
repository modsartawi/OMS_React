import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  READ_ONCE_PER_VISIT,
  attachmentAccessQuery,
  attachmentsByOwnerQuery,
  forgetAttachments,
  rereadAttachments,
} from '@/core/attachments/api'
import type { AttachmentTarget } from '@/core/attachments/upload'
import type { WithdrawReason } from '@/core/attachments/withdraw'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import {
  SD_DOCUMENT,
  attachmentsBadgeCount,
  attachmentsTabGate,
  canWithdrawOn,
  filedOnOrder,
  orderAttachmentTarget,
} from './attachments-tab'

/** What the ByOwner observer keys on while there is no owner to list — never fetched. */
const NO_OWNER = { ownerKind: SD_DOCUMENT, ownerKey: '' }

/** No reasons: the list is not read yet, or the server sent none it could use. */
const NO_REASONS: readonly WithdrawReason[] = []

/** The Attachments disclosure as the page reads it. */
export interface OrderAttachments {
  /** What the disclosure lists — `null` whenever it is not drawn (the gate refuses). */
  target: AttachmentTarget | null
  /** Has the disclosure been opened on this visit? The list waits on it. */
  opened: boolean
  /** The badge's number, or `null` for no badge (`attachmentsBadgeCount`). */
  badge: number | null
  /** ByOwner's `withdrawReasons`, in the order sent — none until the list is read (331). */
  withdrawReasons: readonly WithdrawReason[]
  /** Is Withdraw… offered (`canWithdrawOn`)? A bare 403 still takes it away, in the panel. */
  withdrawOffered: boolean
  /** The order the files are filed on when it is not the route's own document (329), else `null`. */
  filedOnOrderNo: string | null
  /** The disclosure was opened: latch it (the first opening starts the one read). */
  open: () => void
  /** The page's Refresh: re-read the list, only if the disclosure has been opened. */
  refresh: () => void
}

/**
 * **The order page's Attachments state** (spec 324, ticket 327; a tab until ticket 404
 * made it a disclosure of the facts column) — the probe, the
 * gate, the first-opening latch, the audited list read and the badge, in one place so
 * the page stays about the document.
 *
 * - The probe is the ONE shared `AttachmentWeb/Access` entry the slip grids read too,
 *   asked only once the document names both an owner and a category.
 * - 🔑 The list is an AUDITED read. It waits on the latch, never on the page load or the
 *   panel's mount (the panel stays mounted while the disclosure is folded). The page observes it
 *   here for the badge with exactly the panel's options — `READ_ONCE_PER_VISIT`, the one
 *   constant `AttachmentsTab` passes — so the two observers share one request.
 * - Withdraw… (331) is offered by `canWithdrawOn`: the gate, the probe's
 *   `withdrawCategories` holding the category, and the reasons ByOwner sent beside the
 *   list (no client list). Nothing is read for it: the reasons ride on the one read.
 * - The latch is by owner and resets on a new route number: the router may keep this
 *   page mounted from one document to another (or Back to one already opened), and
 *   coming back must not read the files without a click.
 * - Latching drops any list still cached under that owner, so a visit's first opening
 *   is ALWAYS its own read. The page's own observer holds the old key while the next
 *   number loads, so `gcTime: 0` alone does not drop it when two numbers on one route
 *   name the same owner (328's review).
 */
export function useOrderAttachments(document: SdDocumentHeaderModel | null, routeId: string): OrderAttachments {
  const queryClient = useQueryClient()
  const [openedOwner, setOpenedOwner] = useState<string | null>(null)
  // Reset while rendering, before any query sees the new document.
  const [latchRoute, setLatchRoute] = useState(routeId)
  if (latchRoute !== routeId) {
    setLatchRoute(routeId)
    setOpenedOwner(null)
  }

  const named = useMemo(() => orderAttachmentTarget(document), [document])
  const access = useQuery({ ...attachmentAccessQuery(), enabled: named !== null })
  const target = attachmentsTabGate(document, access.data) ? named : null
  const opened = target !== null && openedOwner === target.ownerKey
  const list = useQuery({ ...attachmentsByOwnerQuery(target ?? NO_OWNER, READ_ONCE_PER_VISIT), enabled: opened })
  const withdrawReasons = (opened ? list.data?.withdrawReasons : undefined) ?? NO_REASONS

  return {
    target,
    opened,
    badge: attachmentsBadgeCount(document?.attachmentCount, opened ? list.data?.stored : undefined),
    withdrawReasons,
    withdrawOffered: canWithdrawOn(document, access.data, withdrawReasons),
    filedOnOrderNo: target ? filedOnOrder(target.ownerKey, routeId) : null,
    open: () => {
      if (!target || opened) return
      // Every observer of the key is disabled until the latch is set, so forgetting
      // refetches nothing: the one read is the one the latch enables.
      void forgetAttachments(queryClient, target)
      setOpenedOwner(target.ownerKey)
    },
    refresh: () => {
      if (opened && target) void rereadAttachments(queryClient, target)
    },
  }
}
