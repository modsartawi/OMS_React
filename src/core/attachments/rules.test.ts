/**
 * The attachment register's pure rules (spec 319's tickets 320-321, lifted by ticket
 * 325): where a file came from, its preview, its stamps, the Withdrawn (n) order,
 * ByOwner's two lists and what a failed `/Content` means.
 *
 * These cases moved here from the slip suite with their assertions unchanged; the
 * slip-only ones (the count, the "No slip" filter, the owner key, the probe's
 * `CASH_CLOSE` reading) stay in `features/collection/inquiry/slips.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import type { ApiEnvelope } from '@/core/api'
import type { AttachmentOwnerSiblings, StoredAttachment, WithdrawnAttachment } from '@/core/models/attachment'
import {
  attachmentCaption,
  attachmentContentFailure,
  attachmentOwnerList,
  attachmentPreviewKind,
  attachmentSource,
  holdsCategory,
  wallClockText,
  withdrawnNewestFirst,
} from './rules'

describe('holdsCategory — array membership and nothing looser', () => {
  it('admits an array holding the exact code', () => {
    expect(holdsCategory(['CASH_CLOSE'], 'CASH_CLOSE')).toBe(true)
    expect(holdsCategory(['P2E', 'ALTIBBI'], 'ALTIBBI')).toBe(true)
  })

  it('🔑 refuses a bare string — the String.includes trap — and anything not an array', () => {
    expect(holdsCategory('P2E', 'P2E')).toBe(false)
    expect(holdsCategory('P2E,ERX', 'P2E')).toBe(false)
    for (const list of [undefined, null, {}, 0, true]) expect(holdsCategory(list, 'P2E'), String(list)).toBe(false)
  })

  it('refuses an empty list and a near-miss spelling', () => {
    expect(holdsCategory([], 'P2E')).toBe(false)
    expect(holdsCategory(['p2e', 'P2E '], 'P2E')).toBe(false)
  })
})

describe('attachmentSource — the till column', () => {
  it('names the device when the till sent it', () => {
    expect(attachmentSource({ sourceDevice: 'P001-01', uploadedBy: '20145' })).toEqual({ kind: 'device', device: 'P001-01' })
  })

  it('a web upload (empty device) names its uploader', () => {
    expect(attachmentSource({ sourceDevice: '', uploadedBy: 'U123' })).toEqual({ kind: 'web', uploadedBy: 'U123' })
  })

  it('a blank or absent device is a web upload too', () => {
    expect(attachmentSource({ sourceDevice: '   ', uploadedBy: 'U123' }).kind).toBe('web')
    expect(attachmentSource({ sourceDevice: null, uploadedBy: 'U123' }).kind).toBe('web')
    expect(attachmentSource({ uploadedBy: undefined })).toEqual({ kind: 'web', uploadedBy: '' })
  })
})

describe('attachmentPreviewKind — by content type', () => {
  it('jpeg and png are images', () => {
    expect(attachmentPreviewKind('image/jpeg')).toBe('image')
    expect(attachmentPreviewKind('image/png')).toBe('image')
    expect(attachmentPreviewKind('IMAGE/PNG; charset=binary')).toBe('image')
  })

  it('pdf is a frame', () => {
    expect(attachmentPreviewKind('application/pdf')).toBe('pdf')
  })

  it('anything else previews nothing', () => {
    for (const type of ['image/gif', 'image/svg+xml', 'text/html', 'application/octet-stream', '', null, undefined])
      expect(attachmentPreviewKind(type), String(type)).toBe('none')
  })
})

describe('wallClockText — the stamps as sent', () => {
  it('cuts the T and any fraction, and keeps the server’s digits', () => {
    expect(wallClockText('2026-09-24T22:31:07')).toBe('2026-09-24 22:31:07')
    expect(wallClockText('2026-09-24T22:31:07.1234567')).toBe('2026-09-24 22:31:07')
    expect(wallClockText('2026-09-24T23:59')).toBe('2026-09-24 23:59')
  })

  it('shows anything else exactly as sent, and nothing for a non-string', () => {
    expect(wallClockText('yesterday')).toBe('yesterday')
    expect(wallClockText(null)).toBe('')
  })
})

const withdrawn = (id: string, withdrawnAt: string): WithdrawnAttachment => ({
  attachmentId: id,
  category: 'CASH_CLOSE',
  kind: 'ECR_SLIP',
  fileName: `${id}.jpg`,
  sourceDevice: '',
  uploadedBy: 'U123',
  storedAt: '2026-09-24T22:31:07',
  withdrawnBy: 'U456',
  withdrawnAt,
  reasonCode: 'DUPLICATE',
  reasonLabel: 'Duplicate',
  reasonLabelArabic: 'مكرر',
  note: '',
})

describe('withdrawnNewestFirst — the Withdrawn (n) list', () => {
  it('orders newest withdrawal first, and n is its length', () => {
    const list = withdrawnNewestFirst([
      withdrawn('a', '2026-09-25T09:12:40'),
      withdrawn('b', '2026-09-26T08:00:00'),
      withdrawn('c', '2026-09-25T23:59:59.5'),
    ])
    expect(list.map((w) => w.attachmentId)).toEqual(['b', 'c', 'a'])
    expect(list).toHaveLength(3)
  })

  it('keeps the server’s order on a tie, and puts a missing stamp last', () => {
    const list = withdrawnNewestFirst([
      withdrawn('x', ''),
      withdrawn('a', '2026-09-25T09:12:40'),
      withdrawn('b', '2026-09-25T09:12:40'),
    ])
    expect(list.map((w) => w.attachmentId)).toEqual(['a', 'b', 'x'])
  })

  it('never mutates what it was given, and reads a non-array as none', () => {
    const given = [withdrawn('a', '2026-09-24T00:00:00'), withdrawn('b', '2026-09-25T00:00:00')]
    withdrawnNewestFirst(given)
    expect(given.map((w) => w.attachmentId)).toEqual(['a', 'b'])
    expect(withdrawnNewestFirst(undefined)).toEqual([])
    expect(withdrawnNewestFirst('nope')).toEqual([])
  })
})

describe('attachmentOwnerList — ByOwner’s envelope', () => {
  const stored = { attachmentId: 's1', fileName: 's1.pdf' } as StoredAttachment
  const answer = (
    extra: Partial<ApiEnvelope<StoredAttachment[], AttachmentOwnerSiblings>>,
  ): ApiEnvelope<StoredAttachment[], AttachmentOwnerSiblings> => ({
    statusCode: 200,
    success: true,
    message: '',
    errors: [],
    data: [stored],
    ...extra,
  })

  it('keeps data as sent and reads withdrawn from BESIDE it', () => {
    const list = attachmentOwnerList(
      answer({ withdrawn: [withdrawn('a', '2026-09-24T00:00:00'), withdrawn('b', '2026-09-25T00:00:00')] }),
    )
    expect(list.stored).toEqual([stored])
    expect(list.withdrawn.map((w) => w.attachmentId)).toEqual(['b', 'a'])
  })

  it('an absent withdrawn list is none, and an absent data list is empty', () => {
    expect(attachmentOwnerList(answer({})).withdrawn).toEqual([])
    expect(attachmentOwnerList(answer({ data: null as never })).stored).toEqual([])
  })
})

describe('attachmentContentFailure — by code, never by status', () => {
  it('NOT_FOUND is a slip gone meanwhile; FILE_SERVER_MISSING is a lost file', () => {
    expect(attachmentContentFailure('NOT_FOUND')).toBe('gone')
    expect(attachmentContentFailure('FILE_SERVER_MISSING')).toBe('lost')
  })

  it('every other refusal — the other 502 included — is the server’s own words', () => {
    for (const code of ['FILE_SERVER_KEY_REFUSED', 'FILE_SERVER_UNAVAILABLE', 'NOT_SET_UP', null, undefined])
      expect(attachmentContentFailure(code), String(code)).toBe('other')
  })
})

describe('attachmentCaption — an order file’s caption, shown only when not empty (ticket 327)', () => {
  it('reads the caption as sent, Arabic included', () => {
    expect(attachmentCaption({ caption: 'Front page' })).toBe('Front page')
    expect(attachmentCaption({ caption: 'وصفة الطبيب' })).toBe('وصفة الطبيب')
  })

  it('is empty for an empty or blank caption, and for none at all (a slip carries none)', () => {
    expect(attachmentCaption({ caption: '' })).toBe('')
    expect(attachmentCaption({ caption: '   ' })).toBe('')
    expect(attachmentCaption({})).toBe('')
    expect(attachmentCaption({ caption: null })).toBe('')
    expect(attachmentCaption({ caption: 7 })).toBe('')
    expect(attachmentCaption(null)).toBe('')
  })
})
