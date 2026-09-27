/**
 * The upload store (spec 319's ticket 322, lifted by ticket 325): what goes on the
 * wire across a pick, a retry and a panel closed mid-send. `attachmentsApi.upload`
 * is mocked; the form it is handed is the one `attachmentUploadForm` built, so its
 * parts are what the server would have received.
 *
 * The slip's freshness after a 200 (its ByOwner and both grids) is the slip's, and
 * is pinned in `features/collection/inquiry/slip-freshness.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'

const upload = vi.hoisted(() => vi.fn())

// Only the send is mocked: the keys are the real ones, so a drifted key cannot pass here.
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  attachmentsApi: { upload },
}))

const { useAttachmentUploads, uploadInFlight, uploadsOf } = await import('./upload-store')

const OWNER = 'P019/2026-09-20'
/** A store day's slip target, spelled as the slip drawer's `slipTarget` spells it. */
const TARGET = { ownerKind: 'STORE_DAY', ownerKey: OWNER, category: 'CASH_CLOSE', kind: 'ECR_SLIP' }
const file = (name: string, type = 'image/jpeg', size = 1024) => new File([new Uint8Array(size)], name, { type })
const coded = (status: number, code: string) =>
  new ApiError('business', code, status, [{ errorCode: code, internalErrorCode: '', errorMessage: code }])

/** The ClientRequestId of every request sent so far, in order. */
const sentIds = () => upload.mock.calls.map(([form]) => (form as FormData).get('ClientRequestId'))
const items = () => uploadsOf(useAttachmentUploads.getState(), TARGET) ?? []
const settle = () => new Promise((r) => setTimeout(r, 0))

/** The caller's freshness after a 200 (the slip drawer's is `markSlipDayChanged`). */
let onStored: ReturnType<typeof vi.fn<() => void>>
beforeEach(() => {
  upload.mockReset()
  useAttachmentUploads.setState({ byOwner: {} })
  onStored = vi.fn()
})

describe('Add a file — one request per file', () => {
  it('sends only the files the browser admitted', async () => {
    upload.mockResolvedValue({})
    useAttachmentUploads
      .getState()
      .add(TARGET, [file('ok.jpg'), file('big.jpg', 'image/jpeg', 10_485_761), file('notes.txt', 'text/plain')], onStored)
    await settle()
    expect(upload).toHaveBeenCalledTimes(1)
    expect((upload.mock.calls[0][0] as FormData).get('File')).toMatchObject({ name: 'ok.jpg' })
    expect(items().map((i) => i.status)).toEqual(['stored', 'local-refused', 'local-refused'])
  })

  it('a retry reuses the file’s ClientRequestId; a newly picked file gets a new one', async () => {
    upload.mockRejectedValueOnce(coded(503, 'FILE_SERVER_UNREACHABLE')).mockResolvedValue({})
    const { add, retry } = useAttachmentUploads.getState()
    add(TARGET, [file('slip.jpg')], onStored)
    await settle()
    const [first] = items()
    expect(first).toMatchObject({ status: 'refused', retryable: true })

    retry(TARGET, first.clientRequestId, onStored)
    await settle()
    expect(items()[0].status).toBe('stored')
    expect(sentIds()).toEqual([first.clientRequestId, first.clientRequestId])

    add(TARGET, [file('slip.jpg')], onStored)
    await settle()
    expect(sentIds()).toHaveLength(3)
    expect(sentIds()[2]).not.toBe(first.clientRequestId)
  })

  it('offers no retry for NOT_SET_UP, and a retry call sends nothing', async () => {
    upload.mockRejectedValue(coded(503, 'NOT_SET_UP'))
    const { add, retry } = useAttachmentUploads.getState()
    add(TARGET, [file('slip.jpg')], onStored)
    await settle()
    expect(items()[0]).toMatchObject({ status: 'refused', retryable: false })
    retry(TARGET, items()[0].clientRequestId, onStored)
    await settle()
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('a file in flight cannot be sent again', async () => {
    let answer!: (v: unknown) => void
    upload.mockReturnValue(new Promise((r) => (answer = r)))
    const { add, retry } = useAttachmentUploads.getState()
    add(TARGET, [file('slip.jpg')], onStored)
    const id = items()[0].clientRequestId
    expect(uploadInFlight(items())).toBe(true)
    retry(TARGET, id, onStored)
    retry(TARGET, id, onStored)
    expect(upload).toHaveBeenCalledTimes(1)
    answer({})
    await settle()
    expect(uploadInFlight(items())).toBe(false)
  })

  it('a drawer closed mid-send keeps the file and its id; only settled files are forgotten', async () => {
    let answer!: (v: unknown) => void
    upload
      .mockRejectedValueOnce(coded(413, 'TOO_LARGE'))
      .mockRejectedValueOnce(new ApiError('network', 'offline', 0))
      .mockReturnValueOnce(new Promise((r) => (answer = r)))
    const { add, clearSettled } = useAttachmentUploads.getState()
    add(TARGET, [file('refused.jpg'), file('flaky.jpg'), file('slow.jpg'), file('bad.txt', 'text/plain')], onStored)
    await settle()
    const slow = items().find((i) => i.file.name === 'slow.jpg')!

    clearSettled(TARGET)
    expect(items().map((i) => i.file.name)).toEqual(['flaky.jpg', 'slow.jpg'])
    expect(items()[1].clientRequestId).toBe(slow.clientRequestId)

    answer({})
    await settle()
    expect(items()[1]).toMatchObject({ status: 'stored', clientRequestId: slow.clientRequestId })
  })
})

describe('the caller’s freshness', () => {
  it('runs onStored once per 200, and never on a refusal', async () => {
    upload.mockResolvedValueOnce({}).mockRejectedValueOnce(coded(415, 'UNSUPPORTED_TYPE'))
    useAttachmentUploads.getState().add(TARGET, [file('a.jpg'), file('b.jpg')], onStored)
    await settle()
    expect(items().map((i) => i.status)).toEqual(['stored', 'refused'])
    expect(onStored).toHaveBeenCalledTimes(1)
  })

  it('keeps owners apart by kind AND key — one key under two kinds is two slots', async () => {
    upload.mockResolvedValue({})
    const order = { ...TARGET, ownerKind: 'SD_DOCUMENT', category: 'P2E', kind: 'PRESCRIPTION' }
    useAttachmentUploads.getState().add(order, [file('rx.jpg')], onStored)
    await settle()
    expect(items()).toEqual([])
    expect(uploadsOf(useAttachmentUploads.getState(), order)?.map((i) => i.file.name)).toEqual(['rx.jpg'])
    expect((upload.mock.calls[0][0] as FormData).get('OwnerKind')).toBe('SD_DOCUMENT')
  })
})

describe('Add prescription — one file with a caption (ticket 330)', () => {
  const ORDER = { ownerKind: 'SD_DOCUMENT', ownerKey: '2000000551', category: 'P2E', kind: 'PRESCRIPTION' }
  const orderItems = () => uploadsOf(useAttachmentUploads.getState(), ORDER) ?? []
  const ARABIC = 'الوصفة الطبية — صفحة ٢'

  it('sends the caption as a Caption part, and a retry sends the SAME id and the SAME caption', async () => {
    upload.mockRejectedValueOnce(new ApiError('network', 'offline', 0)).mockResolvedValue({})
    const { add, retry } = useAttachmentUploads.getState()
    add(ORDER, [file('rx.pdf', 'application/pdf')], onStored, ARABIC)
    await settle()
    const [first] = orderItems()
    expect(first).toMatchObject({ status: 'refused', retryable: true, caption: ARABIC })

    retry(ORDER, first.clientRequestId, onStored)
    await settle()
    const forms = upload.mock.calls.map(([form]) => form as FormData)
    expect(forms.map((f) => f.get('ClientRequestId'))).toEqual([first.clientRequestId, first.clientRequestId])
    expect(forms.map((f) => f.get('Caption'))).toEqual([ARABIC, ARABIC])
    expect(orderItems()[0].status).toBe('stored')
    expect(onStored).toHaveBeenCalledTimes(1)
  })

  it('a caption with nothing in it sends no Caption part', async () => {
    upload.mockResolvedValue({})
    useAttachmentUploads.getState().add(ORDER, [file('rx.pdf', 'application/pdf')], onStored, '   ')
    await settle()
    expect((upload.mock.calls[0][0] as FormData).has('Caption')).toBe(false)
  })

  it('ATTACHMENT_TOO_MANY is the server’s cap: sent, refused, and never offered a retry', async () => {
    upload.mockRejectedValue(coded(409, 'ATTACHMENT_TOO_MANY'))
    const { add, retry } = useAttachmentUploads.getState()
    add(ORDER, [file('eleventh.pdf', 'application/pdf')], onStored, '')
    await settle()
    expect(orderItems()[0]).toMatchObject({ status: 'refused', retryable: false })
    retry(ORDER, orderItems()[0].clientRequestId, onStored)
    await settle()
    expect(upload).toHaveBeenCalledTimes(1)
    expect(onStored).not.toHaveBeenCalled()
  })
})
