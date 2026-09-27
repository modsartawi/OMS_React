/**
 * Add slip's freshness after a 200 (ticket 322): the day's ByOwner re-read, and both
 * grids marked stale without a refetch. The shared store (`@/core/attachments`,
 * since ticket 325) runs the caller's `onStored`; the drawer's Add passes
 * `markSlipDayChanged`, exactly as below. `attachmentsApi.upload` is mocked.
 */
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'

const uploadSlip = vi.hoisted(() => vi.fn())

// Only the send is mocked: the keys are the real ones, so a drifted key cannot pass here.
vi.mock('@/core/attachments/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/attachments/api')>()),
  attachmentsApi: { upload: uploadSlip },
}))

const { useAttachmentUploads } = await import('@/core/attachments/upload-store')
const { markSlipDayChanged } = await import('./api')
const { slipTarget } = await import('./slips')

const OWNER = 'P019/2026-09-20'
const file = (name: string, type = 'image/jpeg', size = 1024) => new File([new Uint8Array(size)], name, { type })
const coded = (status: number, code: string) =>
  new ApiError('business', code, status, [{ errorCode: code, internalErrorCode: '', errorMessage: code }])
const settle = () => new Promise((r) => setTimeout(r, 0))

let client: QueryClient
/** What the drawer's Add does with a pick: the slip's target, and `markSlipDayChanged` on a 200. */
const add = (files: File[]) =>
  useAttachmentUploads.getState().add(slipTarget(OWNER), files, () => markSlipDayChanged(client, OWNER))

beforeEach(() => {
  uploadSlip.mockReset()
  useAttachmentUploads.setState({ byOwner: {} })
  client = new QueryClient()
})

describe('Add slip — freshness after a 200', () => {
  it('re-reads ByOwner and marks both grids stale without refetching them', async () => {
    uploadSlip.mockResolvedValue({})
    const spy = vi.spyOn(client, 'invalidateQueries')
    add([file('slip.jpg')])
    await settle()
    expect(spy.mock.calls.map(([f]) => f)).toEqual([
      { queryKey: ['attachments', 'by-owner', 'STORE_DAY', OWNER] },
      { queryKey: ['collection', 'ready'], refetchType: 'none' },
      { queryKey: ['collection', 'collections'], refetchType: 'none' },
    ])
  })

  it('invalidates nothing on a refusal', async () => {
    uploadSlip.mockRejectedValue(coded(415, 'UNSUPPORTED_TYPE'))
    const spy = vi.spyOn(client, 'invalidateQueries')
    add([file('slip.jpg')])
    await settle()
    expect(spy).not.toHaveBeenCalled()
  })
})
