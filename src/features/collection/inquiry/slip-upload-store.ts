import { create } from 'zustand'
import type { QueryClient } from '@tanstack/react-query'

import { mintRequestId } from '@/core/util/request-id'
import { collectionApi, markSlipDayChanged } from './api'
import {
  canSendSlip,
  isRetryableUpload,
  keepsIdOnClose,
  pickSlipFiles,
  slipUploadForm,
  type SlipUpload,
} from './slip-upload'

/**
 * The slips being added from the drawer (ticket 322), per store day.
 *
 * 🔑 **Module-scoped, outside the drawer**, on `search-store`'s pattern: a file's
 * `ClientRequestId` has to outlive the component that picked it. The drawer refuses
 * to be dismissed while a file is sending, but if it goes anyway (the grid's probe
 * stops admitting, the route changes), the send still settles here and a re-opened
 * drawer shows the same item under the same id — it never mints a new one for a file
 * still in flight. In memory only: a page reload starts fresh.
 */
interface SlipUploadsState {
  byOwner: Record<string, SlipUpload[]>
  /** Check and send one pick's files, each under a new id. */
  add: (ownerKey: string, files: Iterable<File>, queryClient: QueryClient) => void
  /** Send one refused file again, under its SAME id — only when its refusal said a retry can help. */
  retry: (ownerKey: string, clientRequestId: string, queryClient: QueryClient) => void
  /**
   * Forget the day's settled files when its drawer closes. What survives is what
   * still needs its id: a file in flight, and one a retry can still help.
   */
  clearSettled: (ownerKey: string) => void
}

/** Is any file of this day in flight? The drawer is not dismissible while one is. */
export function slipUploadInFlight(items: readonly SlipUpload[] | undefined): boolean {
  return (items ?? []).some((item) => item.status === 'sending')
}

export const useSlipUploads = create<SlipUploadsState>((set, get) => {
  const patch = (ownerKey: string, clientRequestId: string, change: Partial<SlipUpload>) =>
    set((state) => ({
      byOwner: {
        ...state.byOwner,
        [ownerKey]: (state.byOwner[ownerKey] ?? []).map((item) =>
          item.clientRequestId === clientRequestId ? { ...item, ...change } : item,
        ),
      },
    }))

  /**
   * One request per file. On 200 the day's list is re-read and both grids' queries
   * are marked stale WITHOUT a refetch (`refetchType: 'none'`): the row's count
   * catches up on the grid's next read, never under the user.
   */
  const send = async (ownerKey: string, clientRequestId: string, queryClient: QueryClient) => {
    const item = get().byOwner[ownerKey]?.find((x) => x.clientRequestId === clientRequestId)
    // The in-flight guard: a file already sending (or settled for good) is not sent again.
    if (!item || !canSendSlip(item)) return
    patch(ownerKey, clientRequestId, { status: 'sending', error: null, retryable: false })
    try {
      await collectionApi.uploadSlip(slipUploadForm(item, ownerKey))
      patch(ownerKey, clientRequestId, { status: 'stored' })
      markSlipDayChanged(queryClient, ownerKey)
    } catch (error) {
      patch(ownerKey, clientRequestId, { status: 'refused', error, retryable: isRetryableUpload(error) })
    }
  }

  return {
    byOwner: {},
    add: (ownerKey, files, queryClient) => {
      const picked = pickSlipFiles(files, mintRequestId)
      if (picked.length === 0) return
      set((state) => ({
        byOwner: { ...state.byOwner, [ownerKey]: [...(state.byOwner[ownerKey] ?? []), ...picked] },
      }))
      for (const item of picked) void send(ownerKey, item.clientRequestId, queryClient)
    },
    retry: (ownerKey, clientRequestId, queryClient) => void send(ownerKey, clientRequestId, queryClient),
    clearSettled: (ownerKey) =>
      set((state) => {
        const kept = (state.byOwner[ownerKey] ?? []).filter(keepsIdOnClose)
        const byOwner = { ...state.byOwner }
        if (kept.length) byOwner[ownerKey] = kept
        else delete byOwner[ownerKey]
        return { byOwner }
      }),
  }
})
