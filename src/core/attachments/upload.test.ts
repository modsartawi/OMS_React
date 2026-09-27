/**
 * Add a file (spec 319's ticket 322, BackOffice 2035's `## Web contract`; lifted by
 * ticket 325) — the browser's check, and when a refusal earns a retry. The slip's
 * six-part form is pinned beside the slip, in `features/collection/inquiry/slips.test.ts`.
 *
 * 🔑 The retry rule is the one that reads right and is wrong: `NOT_SET_UP` and
 * `FILE_SERVER_UNREACHABLE` are BOTH coded 503s, so a rule keyed on the status would
 * offer a retry for a server that has no File Server at all. The cases below pin
 * the code, and the status-keyed mutation goes red on them.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  ATTACHMENT_MAX_BYTES,
  FILE_SERVER_UNREACHABLE,
  attachmentFileRefusal,
  canSendUpload,
  isRetryableUpload,
  keepsIdOnClose,
  pickAttachmentFiles,
  type AttachmentUpload,
} from './upload'

const file = (name: string, type: string, size = 1024) => new File([new Uint8Array(size)], name, { type })
const meta = (name: string, type: string, size = 1024) => ({ name, type, size })

/** A coded envelope refusal, as `core/api` builds it. */
const coded = (status: number, code: string) =>
  new ApiError('business', `${code} — English.\nالعربية.`, status, [
    { errorCode: code, internalErrorCode: '', errorMessage: code },
  ])

describe('attachmentFileRefusal — the browser check before sending', () => {
  it('admits jpg, jpeg, png and pdf by extension, whatever the type says', () => {
    for (const name of ['slip.jpg', 'slip.jpeg', 'slip.png', 'slip.pdf', 'SLIP.JPG', 'a.b.Pdf']) {
      expect(attachmentFileRefusal(meta(name, ''))).toBeNull()
    }
  })

  it('admits by type when the name has no usable extension', () => {
    for (const type of ['image/jpeg', 'image/png', 'application/pdf', 'IMAGE/PNG']) {
      expect(attachmentFileRefusal(meta('photo', type))).toBeNull()
    }
    expect(attachmentFileRefusal(meta('scan.bin', 'application/pdf'))).toBeNull()
  })

  it('refuses an unknown type', () => {
    expect(attachmentFileRefusal(meta('notes.txt', 'text/plain'))).toBe('type')
    expect(attachmentFileRefusal(meta('slip.heic', 'image/heic'))).toBe('type')
    expect(attachmentFileRefusal(meta('noextension', ''))).toBe('type')
    expect(attachmentFileRefusal(meta('slip.jpg.exe', 'application/x-msdownload'))).toBe('type')
  })

  it('passes exactly 10,485,760 bytes and refuses one more', () => {
    expect(ATTACHMENT_MAX_BYTES).toBe(10_485_760)
    expect(attachmentFileRefusal(meta('slip.jpg', 'image/jpeg', 10_485_760))).toBeNull()
    expect(attachmentFileRefusal(meta('slip.jpg', 'image/jpeg', 10_485_761))).toBe('size')
  })

  it('an empty file is not the browser’s to refuse (the server decides)', () => {
    expect(attachmentFileRefusal(meta('slip.png', 'image/png', 0))).toBeNull()
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

describe('pickAttachmentFiles — one new id per picked file', () => {
  let n = 0
  const mint = () => `id-${++n}`

  it('mints a new ClientRequestId for each file, and checks each in the browser', () => {
    n = 0
    const picked = pickAttachmentFiles(
      [file('a.jpg', 'image/jpeg'), file('b.txt', 'text/plain'), file('c.pdf', 'application/pdf', ATTACHMENT_MAX_BYTES + 1)],
      mint,
    )
    expect(picked.map((p) => p.clientRequestId)).toEqual(['id-1', 'id-2', 'id-3'])
    expect(picked.map((p) => p.status)).toEqual(['queued', 'local-refused', 'local-refused'])
    expect(picked.map((p) => p.localRefusal)).toEqual([null, 'type', 'size'])
  })

  it('a second pick of the same file is a new capture with a new id', () => {
    const same = file('a.jpg', 'image/jpeg')
    const [first] = pickAttachmentFiles([same], mint)
    const [second] = pickAttachmentFiles([same], mint)
    expect(second.clientRequestId).not.toBe(first.clientRequestId)
  })

  it('has no count cap', () => {
    expect(pickAttachmentFiles(Array.from({ length: 25 }, (_, i) => file(`s${i}.png`, 'image/png')), mint)).toHaveLength(25)
  })
})

describe('canSendUpload — the in-flight guard', () => {
  const item = (change: Partial<AttachmentUpload>): AttachmentUpload => ({
    clientRequestId: 'id',
    file: file('a.jpg', 'image/jpeg'),
    status: 'queued',
    localRefusal: null,
    error: null,
    retryable: false,
    ...change,
  })

  it('sends a queued file, and a refused one only when its refusal is retryable', () => {
    expect(canSendUpload(item({}))).toBe(true)
    expect(canSendUpload(item({ status: 'refused', retryable: true }))).toBe(true)
    expect(canSendUpload(item({ status: 'refused', retryable: false }))).toBe(false)
  })

  it('never a file in flight, a stored one, or one the browser refused', () => {
    expect(canSendUpload(item({ status: 'sending' }))).toBe(false)
    expect(canSendUpload(item({ status: 'stored' }))).toBe(false)
    expect(canSendUpload(item({ status: 'local-refused', localRefusal: 'type' }))).toBe(false)
  })

  it('keepsIdOnClose: a file in flight and a retryable refusal keep their id; the settled are forgotten', () => {
    expect(keepsIdOnClose(item({ status: 'sending' }))).toBe(true)
    expect(keepsIdOnClose(item({ status: 'refused', retryable: true }))).toBe(true)
    expect(keepsIdOnClose(item({ status: 'refused', retryable: false }))).toBe(false)
    expect(keepsIdOnClose(item({ status: 'stored' }))).toBe(false)
    expect(keepsIdOnClose(item({ status: 'local-refused', localRefusal: 'size' }))).toBe(false)
  })
})
