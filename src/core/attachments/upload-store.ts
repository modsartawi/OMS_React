import { create } from 'zustand'

import type { AttachmentOwner } from '@/core/models/attachment'
import { mintRequestId } from '@/core/util/request-id'
import { attachmentsApi } from './api'
import {
  attachmentUploadForm,
  canSendUpload,
  isRetryableUpload,
  keepsIdOnClose,
  pickAttachmentFiles,
  type AttachmentTarget,
  type AttachmentUpload,
} from './upload'

/**
 * The files being added from the web (spec 319's ticket 322, lifted by 325), per
 * owner — **keyed by owner kind + owner key**, so a store day's slips and an order's
 * prescriptions can never share a slot, even under the same key text.
 *
 * 🔑 **Module-scoped, outside the panel**, on `search-store`'s pattern: a file's
 * `ClientRequestId` has to outlive the component that picked it. The slip drawer
 * refuses to be dismissed while a file is sending, but if it goes anyway (the grid's
 * probe stops admitting, the route changes), the send still settles here and a
 * re-opened drawer shows the same item under the same id — it never mints a new one
 * for a file still in flight. In memory only: a page reload starts fresh.
 */
interface AttachmentUploadsState {
  /** By `uploadSlot(owner)`. Read it through `uploadsOf`, never by a hand-built key. */
  byOwner: Record<string, AttachmentUpload[]>
  /**
   * Check and send one pick's files, each under a new id. `onStored` runs after each
   * 200 — the caller's freshness (the slip drawer re-reads the day and marks its
   * grids stale).
   */
  add: (target: AttachmentTarget, files: Iterable<File>, onStored: () => void) => void
  /** Send one refused file again, under its SAME id — only when its refusal said a retry can help. */
  retry: (target: AttachmentTarget, clientRequestId: string, onStored: () => void) => void
  /**
   * Forget the owner's settled files when its panel closes. What survives is what
   * still needs its id: a file in flight, and one a retry can still help.
   */
  clearSettled: (owner: AttachmentOwner) => void
}

/**
 * An owner's slot in the store. Owner kinds are machine codes (`STORE_DAY`,
 * `SD_DOCUMENT`) with no space in them, so the first space always splits the two
 * back apart; a key may hold anything, a store day's `/` included.
 */
export function uploadSlot({ ownerKind, ownerKey }: AttachmentOwner): string {
  return `${ownerKind} ${ownerKey}`
}

/** An owner's files in the store, or `undefined` when it has none. */
export function uploadsOf(state: Pick<AttachmentUploadsState, 'byOwner'>, owner: AttachmentOwner) {
  return state.byOwner[uploadSlot(owner)]
}

/** Is any file of this owner in flight? The slip drawer is not dismissible while one is. */
export function uploadInFlight(items: readonly AttachmentUpload[] | undefined): boolean {
  return (items ?? []).some((item) => item.status === 'sending')
}

export const useAttachmentUploads = create<AttachmentUploadsState>((set, get) => {
  const patch = (slot: string, clientRequestId: string, change: Partial<AttachmentUpload>) =>
    set((state) => ({
      byOwner: {
        ...state.byOwner,
        [slot]: (state.byOwner[slot] ?? []).map((item) =>
          item.clientRequestId === clientRequestId ? { ...item, ...change } : item,
        ),
      },
    }))

  /**
   * One request per file. On 200 the caller's `onStored` runs — never on a refusal.
   */
  const send = async (target: AttachmentTarget, clientRequestId: string, onStored: () => void) => {
    const slot = uploadSlot(target)
    const item = get().byOwner[slot]?.find((x) => x.clientRequestId === clientRequestId)
    // The in-flight guard: a file already sending (or settled for good) is not sent again.
    if (!item || !canSendUpload(item)) return
    patch(slot, clientRequestId, { status: 'sending', error: null, retryable: false })
    try {
      await attachmentsApi.upload(attachmentUploadForm(item, target))
      patch(slot, clientRequestId, { status: 'stored' })
      onStored()
    } catch (error) {
      patch(slot, clientRequestId, { status: 'refused', error, retryable: isRetryableUpload(error) })
    }
  }

  return {
    byOwner: {},
    add: (target, files, onStored) => {
      const picked = pickAttachmentFiles(files, mintRequestId)
      if (picked.length === 0) return
      const slot = uploadSlot(target)
      set((state) => ({
        byOwner: { ...state.byOwner, [slot]: [...(state.byOwner[slot] ?? []), ...picked] },
      }))
      for (const item of picked) void send(target, item.clientRequestId, onStored)
    },
    retry: (target, clientRequestId, onStored) => void send(target, clientRequestId, onStored),
    clearSettled: (owner) =>
      set((state) => {
        const slot = uploadSlot(owner)
        const kept = (state.byOwner[slot] ?? []).filter(keepsIdOnClose)
        const byOwner = { ...state.byOwner }
        if (kept.length) byOwner[slot] = kept
        else delete byOwner[slot]
        return { byOwner }
      }),
  }
})
