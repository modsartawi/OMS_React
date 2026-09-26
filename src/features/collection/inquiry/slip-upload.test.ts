/**
 * Add slip (ticket 322, BackOffice 2035's `## Web contract`) — the browser's check,
 * the six-part form, and when a refusal earns a retry.
 *
 * 🔑 The retry rule is the one that reads right and is wrong: `NOT_SET_UP` and
 * `FILE_SERVER_UNREACHABLE` are BOTH coded 503s, so a rule keyed on the status would
 * offer a retry for a server that has no File Server at all. The cases below pin
 * the code, and the status-keyed mutation goes red on them.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  ECR_SLIP,
  FILE_SERVER_UNREACHABLE,
  SLIP_MAX_BYTES,
  canSendSlip,
  isRetryableUpload,
  keepsIdOnClose,
  pickSlipFiles,
  slipFileRefusal,
  slipUploadForm,
  type SlipUpload,
} from './slip-upload'
import { CASH_CLOSE, STORE_DAY, storeDayOwnerKey } from './slips'

const file = (name: string, type: string, size = 1024) => new File([new Uint8Array(size)], name, { type })
const meta = (name: string, type: string, size = 1024) => ({ name, type, size })

/** A coded envelope refusal, as `core/api` builds it. */
const coded = (status: number, code: string) =>
  new ApiError('business', `${code} — English.\nالعربية.`, status, [
    { errorCode: code, internalErrorCode: '', errorMessage: code },
  ])

describe('slipFileRefusal — the browser check before sending', () => {
  it('admits jpg, jpeg, png and pdf by extension, whatever the type says', () => {
    for (const name of ['slip.jpg', 'slip.jpeg', 'slip.png', 'slip.pdf', 'SLIP.JPG', 'a.b.Pdf']) {
      expect(slipFileRefusal(meta(name, ''))).toBeNull()
    }
  })

  it('admits by type when the name has no usable extension', () => {
    for (const type of ['image/jpeg', 'image/png', 'application/pdf', 'IMAGE/PNG']) {
      expect(slipFileRefusal(meta('photo', type))).toBeNull()
    }
    expect(slipFileRefusal(meta('scan.bin', 'application/pdf'))).toBeNull()
  })

  it('refuses an unknown type', () => {
    expect(slipFileRefusal(meta('notes.txt', 'text/plain'))).toBe('type')
    expect(slipFileRefusal(meta('slip.heic', 'image/heic'))).toBe('type')
    expect(slipFileRefusal(meta('noextension', ''))).toBe('type')
    expect(slipFileRefusal(meta('slip.jpg.exe', 'application/x-msdownload'))).toBe('type')
  })

  it('passes exactly 10,485,760 bytes and refuses one more', () => {
    expect(SLIP_MAX_BYTES).toBe(10_485_760)
    expect(slipFileRefusal(meta('slip.jpg', 'image/jpeg', 10_485_760))).toBeNull()
    expect(slipFileRefusal(meta('slip.jpg', 'image/jpeg', 10_485_761))).toBe('size')
  })

  it('an empty file is not the browser’s to refuse (the server decides)', () => {
    expect(slipFileRefusal(meta('slip.png', 'image/png', 0))).toBeNull()
  })
})

describe('slipUploadForm — POST AttachmentWeb/Upload', () => {
  const row = { storeId: 'P019', businessDay: '2026-09-20T00:00:00' }
  const ownerKey = storeDayOwnerKey(row.storeId, row.businessDay)!
  const slip = file('ecr slip.jpg', 'image/jpeg')
  const form = slipUploadForm({ clientRequestId: 'id-1', file: slip }, ownerKey)

  it('carries exactly the six parts the contract names, and no SourceDevice', () => {
    expect([...form.keys()]).toEqual(['ClientRequestId', 'OwnerKind', 'OwnerKey', 'Category', 'Kind', 'File'])
    expect(form.has('SourceDevice')).toBe(false)
  })

  it('fills them from the contract’s constants and the day’s own owner key', () => {
    expect(form.get('ClientRequestId')).toBe('id-1')
    expect(form.get('OwnerKind')).toBe(STORE_DAY)
    expect(form.get('OwnerKey')).toBe('P019/2026-09-20')
    expect(form.get('OwnerKey')).toBe(ownerKey)
    expect(form.get('Category')).toBe(CASH_CLOSE)
    expect(form.get('Kind')).toBe(ECR_SLIP)
    expect([STORE_DAY, CASH_CLOSE, ECR_SLIP]).toEqual(['STORE_DAY', 'CASH_CLOSE', 'ECR_SLIP'])
  })

  it('sends the picked file itself, under its own name', () => {
    const part = form.get('File')
    expect(part).toBeInstanceOf(File)
    expect((part as File).name).toBe('ecr slip.jpg')
    expect((part as File).size).toBe(slip.size)
  })
})

describe('isRetryableUpload — only when a retry can help, branched on the code', () => {
  it('true for a request that got no answer (the network arm)', () => {
    expect(isRetryableUpload(new ApiError('network', 'offline', 0))).toBe(true)
  })

  it('true for an answer that was not a JSON envelope (a codeless 5xx)', () => {
    expect(isRetryableUpload(new ApiError('server', 'server error', 502))).toBe(true)
  })

  it('true for FILE_SERVER_UNREACHABLE on its 503', () => {
    expect(isRetryableUpload(coded(503, FILE_SERVER_UNREACHABLE))).toBe(true)
  })

  it('false for NOT_SET_UP — on the SAME 503', () => {
    expect(isRetryableUpload(coded(503, 'NOT_SET_UP'))).toBe(false)
  })

  it('false for every other refusal the contract lists, and for a field name', () => {
    for (const [status, code] of [
      [413, 'TOO_LARGE'],
      [415, 'UNSUPPORTED_TYPE'],
      [403, 'CATEGORY_NOT_HELD'],
      [403, 'CATEGORY_NOT_WRITABLE'],
      [502, 'FILE_SERVER_REFUSED'],
      [409, 'STILL_UPLOADING'],
      [409, 'CAPTURE_REUSED'],
      [409, 'WITHDRAWN'],
      [400, 'OwnerKey'],
      [400, 'File'],
    ] as const) {
      expect(isRetryableUpload(coded(status, code)), code).toBe(false)
    }
  })

  it('false for a bare 403 with no body — an auth refusal, not a flaky transport', () => {
    expect(isRetryableUpload(new ApiError('unknown', 'unexpected (HTTP 403)', 403))).toBe(false)
  })

  it('false for the whole unknown arm — a non-JSON 2xx/4xx lands there too, and cannot be told from that 403', () => {
    // Pinned on purpose (HITL-322): kind and code are all the rule may read, and both are identical here.
    expect(isRetryableUpload(new ApiError('unknown', 'unexpected (HTTP 200)', 200))).toBe(false)
  })

  it('false for an uncoded business refusal, an ended session, and anything not an ApiError', () => {
    expect(isRetryableUpload(new ApiError('business', 'no', 400))).toBe(false)
    expect(isRetryableUpload(new ApiError('auth', 'session ended', 401))).toBe(false)
    expect(isRetryableUpload(new TypeError('a bug'))).toBe(false)
    expect(isRetryableUpload(null)).toBe(false)
  })
})

describe('pickSlipFiles — one new id per picked file', () => {
  let n = 0
  const mint = () => `id-${++n}`

  it('mints a new ClientRequestId for each file, and checks each in the browser', () => {
    n = 0
    const picked = pickSlipFiles(
      [file('a.jpg', 'image/jpeg'), file('b.txt', 'text/plain'), file('c.pdf', 'application/pdf', SLIP_MAX_BYTES + 1)],
      mint,
    )
    expect(picked.map((p) => p.clientRequestId)).toEqual(['id-1', 'id-2', 'id-3'])
    expect(picked.map((p) => p.status)).toEqual(['queued', 'local-refused', 'local-refused'])
    expect(picked.map((p) => p.localRefusal)).toEqual([null, 'type', 'size'])
  })

  it('a second pick of the same file is a new capture with a new id', () => {
    const same = file('a.jpg', 'image/jpeg')
    const [first] = pickSlipFiles([same], mint)
    const [second] = pickSlipFiles([same], mint)
    expect(second.clientRequestId).not.toBe(first.clientRequestId)
  })

  it('has no count cap', () => {
    expect(pickSlipFiles(Array.from({ length: 25 }, (_, i) => file(`s${i}.png`, 'image/png')), mint)).toHaveLength(25)
  })
})

describe('canSendSlip — the in-flight guard', () => {
  const item = (change: Partial<SlipUpload>): SlipUpload => ({
    clientRequestId: 'id',
    file: file('a.jpg', 'image/jpeg'),
    status: 'queued',
    localRefusal: null,
    error: null,
    retryable: false,
    ...change,
  })

  it('sends a queued file, and a refused one only when its refusal is retryable', () => {
    expect(canSendSlip(item({}))).toBe(true)
    expect(canSendSlip(item({ status: 'refused', retryable: true }))).toBe(true)
    expect(canSendSlip(item({ status: 'refused', retryable: false }))).toBe(false)
  })

  it('never a file in flight, a stored one, or one the browser refused', () => {
    expect(canSendSlip(item({ status: 'sending' }))).toBe(false)
    expect(canSendSlip(item({ status: 'stored' }))).toBe(false)
    expect(canSendSlip(item({ status: 'local-refused', localRefusal: 'type' }))).toBe(false)
  })

  it('keepsIdOnClose: a file in flight and a retryable refusal keep their id; the settled are forgotten', () => {
    expect(keepsIdOnClose(item({ status: 'sending' }))).toBe(true)
    expect(keepsIdOnClose(item({ status: 'refused', retryable: true }))).toBe(true)
    expect(keepsIdOnClose(item({ status: 'refused', retryable: false }))).toBe(false)
    expect(keepsIdOnClose(item({ status: 'stored' }))).toBe(false)
    expect(keepsIdOnClose(item({ status: 'local-refused', localRefusal: 'size' }))).toBe(false)
  })
})
