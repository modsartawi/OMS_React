/**
 * The Add slip store (ticket 322): what goes on the wire across a pick, a retry and
 * a drawer closed mid-send. `collectionApi.uploadSlip` is mocked; the form it is
 * handed is the one `slipUploadForm` built, so its parts are what the server would
 * have received.
 */
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'

const uploadSlip = vi.hoisted(() => vi.fn())

// Only the send is mocked: the keys are the real ones, so a drifted key cannot pass here.
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  collectionApi: { uploadSlip },
}))

const { useSlipUploads, slipUploadInFlight } = await import('./slip-upload-store')

const OWNER = 'P019/2026-09-20'
const file = (name: string, type = 'image/jpeg', size = 1024) => new File([new Uint8Array(size)], name, { type })
const coded = (status: number, code: string) =>
  new ApiError('business', code, status, [{ errorCode: code, internalErrorCode: '', errorMessage: code }])

/** The ClientRequestId of every request sent so far, in order. */
const sentIds = () => uploadSlip.mock.calls.map(([form]) => (form as FormData).get('ClientRequestId'))
const items = () => useSlipUploads.getState().byOwner[OWNER] ?? []
const settle = () => new Promise((r) => setTimeout(r, 0))

let client: QueryClient
beforeEach(() => {
  uploadSlip.mockReset()
  useSlipUploads.setState({ byOwner: {} })
  client = new QueryClient()
})

describe('Add slip — one request per file', () => {
  it('sends only the files the browser admitted', async () => {
    uploadSlip.mockResolvedValue({})
    useSlipUploads
      .getState()
      .add(OWNER, [file('ok.jpg'), file('big.jpg', 'image/jpeg', 10_485_761), file('notes.txt', 'text/plain')], client)
    await settle()
    expect(uploadSlip).toHaveBeenCalledTimes(1)
    expect((uploadSlip.mock.calls[0][0] as FormData).get('File')).toMatchObject({ name: 'ok.jpg' })
    expect(items().map((i) => i.status)).toEqual(['stored', 'local-refused', 'local-refused'])
  })

  it('a retry reuses the file’s ClientRequestId; a newly picked file gets a new one', async () => {
    uploadSlip.mockRejectedValueOnce(coded(503, 'FILE_SERVER_UNREACHABLE')).mockResolvedValue({})
    const { add, retry } = useSlipUploads.getState()
    add(OWNER, [file('slip.jpg')], client)
    await settle()
    const [first] = items()
    expect(first).toMatchObject({ status: 'refused', retryable: true })

    retry(OWNER, first.clientRequestId, client)
    await settle()
    expect(items()[0].status).toBe('stored')
    expect(sentIds()).toEqual([first.clientRequestId, first.clientRequestId])

    add(OWNER, [file('slip.jpg')], client)
    await settle()
    expect(sentIds()).toHaveLength(3)
    expect(sentIds()[2]).not.toBe(first.clientRequestId)
  })

  it('offers no retry for NOT_SET_UP, and a retry call sends nothing', async () => {
    uploadSlip.mockRejectedValue(coded(503, 'NOT_SET_UP'))
    const { add, retry } = useSlipUploads.getState()
    add(OWNER, [file('slip.jpg')], client)
    await settle()
    expect(items()[0]).toMatchObject({ status: 'refused', retryable: false })
    retry(OWNER, items()[0].clientRequestId, client)
    await settle()
    expect(uploadSlip).toHaveBeenCalledTimes(1)
  })

  it('a file in flight cannot be sent again', async () => {
    let answer!: (v: unknown) => void
    uploadSlip.mockReturnValue(new Promise((r) => (answer = r)))
    const { add, retry } = useSlipUploads.getState()
    add(OWNER, [file('slip.jpg')], client)
    const id = items()[0].clientRequestId
    expect(slipUploadInFlight(items())).toBe(true)
    retry(OWNER, id, client)
    retry(OWNER, id, client)
    expect(uploadSlip).toHaveBeenCalledTimes(1)
    answer({})
    await settle()
    expect(slipUploadInFlight(items())).toBe(false)
  })

  it('a drawer closed mid-send keeps the file and its id; only settled files are forgotten', async () => {
    let answer!: (v: unknown) => void
    uploadSlip
      .mockRejectedValueOnce(coded(413, 'TOO_LARGE'))
      .mockRejectedValueOnce(new ApiError('network', 'offline', 0))
      .mockReturnValueOnce(new Promise((r) => (answer = r)))
    const { add, clearSettled } = useSlipUploads.getState()
    add(OWNER, [file('refused.jpg'), file('flaky.jpg'), file('slow.jpg'), file('bad.txt', 'text/plain')], client)
    await settle()
    const slow = items().find((i) => i.file.name === 'slow.jpg')!

    clearSettled(OWNER)
    expect(items().map((i) => i.file.name)).toEqual(['flaky.jpg', 'slow.jpg'])
    expect(items()[1].clientRequestId).toBe(slow.clientRequestId)

    answer({})
    await settle()
    expect(items()[1]).toMatchObject({ status: 'stored', clientRequestId: slow.clientRequestId })
  })
})

describe('Add slip — freshness after a 200', () => {
  it('re-reads ByOwner and marks both grids stale without refetching them', async () => {
    uploadSlip.mockResolvedValue({})
    const spy = vi.spyOn(client, 'invalidateQueries')
    useSlipUploads.getState().add(OWNER, [file('slip.jpg')], client)
    await settle()
    expect(spy.mock.calls.map(([f]) => f)).toEqual([
      { queryKey: ['collection', 'slips', 'by-owner', OWNER] },
      { queryKey: ['collection', 'ready'], refetchType: 'none' },
      { queryKey: ['collection', 'collections'], refetchType: 'none' },
    ])
  })

  it('invalidates nothing on a refusal', async () => {
    uploadSlip.mockRejectedValue(coded(415, 'UNSUPPORTED_TYPE'))
    const spy = vi.spyOn(client, 'invalidateQueries')
    useSlipUploads.getState().add(OWNER, [file('slip.jpg')], client)
    await settle()
    expect(spy).not.toHaveBeenCalled()
  })
})
