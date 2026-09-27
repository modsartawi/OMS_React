import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  READ_ONCE_PER_VISIT,
  attachmentAccessQuery,
  attachmentsByOwnerQuery,
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
  orderAttachmentTarget,
} from './attachments-tab'

/** What the ByOwner observer keys on while there is no owner to list — never fetched. */
const NO_OWNER = { ownerKind: SD_DOCUMENT, ownerKey: '' }

/** No reasons: the list is not read yet, or the server sent none it could use. */
const NO_REASONS: readonly WithdrawReason[] = []

/** The Attachments tab as the page reads it. */
export interface OrderAttachments {
  /** What the tab lists — `null` whenever the tab is not drawn (the gate refuses). */
  target: AttachmentTarget | null
  /** Has the tab been selected on this visit? The list waits on it. */
  opened: boolean
  /** The badge's number, or `null` for no badge (`attachmentsBadgeCount`). */
  badge: number | null
  /** ByOwner's `withdrawReasons`, in the order sent — none until the list is read (331). */
  withdrawReasons: readonly WithdrawReason[]
  /** Is Withdraw… offered (`canWithdrawOn`)? A bare 403 still takes it away, in the panel. */
  withdrawOffered: boolean
  /** The tab was selected: latch it open (the first selection starts the one read). */
  open: () => void
  /** The page's Refresh: re-read the list, only if the tab has been opened. */
  refresh: () => void
}

/**
 * **The order page's Attachments tab state** (spec 324, ticket 327) — the probe, the
 * gate, the first-selection latch, the audited list read and the badge, in one place so
 * the page stays about the document.
 *
 * - The probe is the ONE shared `AttachmentWeb/Access` entry the slip grids read too,
 *   asked only once the document names both an owner and a category.
 * - 🔑 The list is an AUDITED read. It waits on the latch, never on the page load or the
 *   panel's mount (the page keeps its tab panels mounted, hidden). The page observes it
 *   here for the badge with exactly the panel's options — `READ_ONCE_PER_VISIT`, the one
 *   constant `AttachmentsTab` passes — so the two observers share one request.
 * - Withdraw… (331) is offered by `canWithdrawOn`: the gate, the probe's
 *   `withdrawCategories` holding the category, and the reasons ByOwner sent beside the
 *   list (no client list). Nothing is read for it: the reasons ride on the one read.
 * - The latch is by owner and resets on a new route number: the router may keep this
 *   page mounted from one document to another (or Back to one already opened), and
 *   coming back must not read the files without a click.
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
    open: () => {
      if (target) setOpenedOwner(target.ownerKey)
    },
    refresh: () => {
      if (opened && target) void rereadAttachments(queryClient, target)
    },
  }
}
