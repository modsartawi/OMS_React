/**
 * The other two of ticket 219's pure Proof bullets:
 * `theAttachmentTypeIsDerivedFromTheFile` and `theSameTitleTwiceIsAllowed`.
 *
 * The second is written as an **assertion that duplicates survive**, deliberately,
 * so nobody later "fixes" it into a refusal by analogy with the duplicate-item
 * rule at `addItem` — a duplicate engine line really does collide, a duplicate
 * title does not.
 */
import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_TITLES,
  IMAGE_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
  PDF_MAX_BYTES,
  attachmentBlockers,
  planAttachment,
  toSubmitAttachments,
  totalAttachmentBytes,
  type PreparedAttachment,
  type AttachmentTitle,
} from './attachment-prepare'

const prepared = (
  id: string,
  title: AttachmentTitle,
  contentType = IMAGE_CONTENT_TYPE,
): PreparedAttachment => ({
  id,
  title,
  fileName: `${id}.jpg`,
  contentType,
  attachment: 'BASE64',
  dataUrl: `data:${contentType};base64,BASE64`,
  originalBytes: 6_000_000,
  bytes: 250_000,
})

describe('theAttachmentTypeIsDerivedFromTheFile', () => {
  it('derives image/jpeg from a JPEG, and downscales it', () => {
    expect(planAttachment({ type: 'image/jpeg', size: 6_000_000 })).toEqual({
      ok: true,
      plan: { contentType: IMAGE_CONTENT_TYPE, downscale: true },
    })
  })

  it('🚩 turns a PNG into a JPEG too — which is what makes the service’s hardcoded content type true', () => {
    expect(planAttachment({ type: 'image/png', size: 900_000 })).toEqual({
      ok: true,
      plan: { contentType: IMAGE_CONTENT_TYPE, downscale: true },
    })
  })

  it('passes a PDF through untouched', () => {
    expect(planAttachment({ type: 'application/pdf', size: 412_000 })).toEqual({
      ok: true,
      plan: { contentType: PDF_CONTENT_TYPE, downscale: false },
    })
  })

  it('🚩 refuses a PDF over 5 MB AT THE PICKER, not after the request is built', () => {
    const answer = planAttachment({ type: 'application/pdf', size: PDF_MAX_BYTES + 1 })

    expect(answer.ok).toBe(false)
    expect(!answer.ok && answer.refusal).toEqual({
      reason: 'pdfTooLarge',
      bytes: PDF_MAX_BYTES + 1,
    })
  })

  it('accepts a PDF exactly at the cap — the limit is "over 5 MB", not "5 MB"', () => {
    expect(planAttachment({ type: 'application/pdf', size: PDF_MAX_BYTES }).ok).toBe(true)
  })

  it('does not cap an image by size, because the downscale is what makes it small', () => {
    expect(planAttachment({ type: 'image/jpeg', size: 20_000_000 }).ok).toBe(true)
  })

  it('refuses anything that is neither, and says what it was handed', () => {
    const answer = planAttachment({ type: 'application/vnd.ms-excel', size: 1000 })

    expect(!answer.ok && answer.refusal).toEqual({
      reason: 'unsupportedType',
      contentType: 'application/vnd.ms-excel',
    })
    // A file the browser could not type at all is the same refusal, not a crash.
    expect(planAttachment({ type: '', size: 1000 }).ok).toBe(false)
    expect(planAttachment({ type: null, size: 1000 }).ok).toBe(false)
  })
})

describe('theSameTitleTwiceIsAllowed', () => {
  it('🚩 keeps two rows with the same title — two prescriptions are two prescriptions', () => {
    const rows = [
      prepared('a', 'Prescription'),
      prepared('b', 'Prescription'),
      prepared('c', 'Id'),
    ]

    const body = toSubmitAttachments(rows)

    expect(body.map((a) => a.title)).toEqual(['Prescription', 'Prescription', 'Id'])
    // 🚩 And `sequence` is what distinguishes them on the wire — which is the
    // whole reason the duplicate does not have to be refused.
    expect(body.map((a) => a.sequence)).toEqual([1, 2, 3])
  })

  it('sends exactly §3.5’s four fields, and never the file name', () => {
    const [only] = toSubmitAttachments([prepared('a', 'Lab result', PDF_CONTENT_TYPE)])

    expect(Object.keys(only).sort()).toEqual(['attachment', 'contentType', 'sequence', 'title'])
    expect(only).toEqual({
      sequence: 1,
      title: 'Lab result',
      contentType: PDF_CONTENT_TYPE,
      attachment: 'BASE64',
    })
  })

  it('offers the closed seven-value list, with WPF’s `Id` wire value kept', () => {
    expect([...ATTACHMENT_TITLES]).toEqual([
      'Id',
      'Prescription',
      'Medical report',
      'Lab result',
      'Radiology report',
      'Insurance card',
      'Referral letter',
    ])
  })
})

describe('atLeastOneAttachmentIsAFormState', () => {
  it('blocks while there are none and clears on the first one', () => {
    expect(attachmentBlockers([])).toEqual(['noAttachment'])
    expect(attachmentBlockers([prepared('a', 'Prescription')])).toEqual([])
  })

  it('adds up what the request is about to carry', () => {
    expect(totalAttachmentBytes([prepared('a', 'Id'), prepared('b', 'Id')])).toBe(500_000)
  })
})
