/**
 * **What happens to a file between the picker and the submit body** (ticket 219,
 * spec 209 stories 47–55, contract v1.0 §3.5).
 *
 * Pure: no React, no i18n, no network, and **no DOM** — the canvas and the file
 * reader live next door in `./attachment-file`, so every decision this module
 * makes is testable in node (spec 209's tier-1 ruling) while the browser work
 * that carries it out is not something a test would tell you anything about.
 *
 * The three rulings that would otherwise regress silently:
 *
 * 1. 🚩 **The type dropdown does not exist** — `contentType` is derived from the
 *    file's own MIME. WPF makes the agent pick image or PDF *to get a file
 *    filter*; the browser already knows.
 * 2. 🚩 **Images are downscaled and re-encoded to JPEG** before base64: 2000 px
 *    longest edge at q0.85, so a 6 MB phone photo becomes ~250 KB. A deliberate
 *    divergence from the old client, which sends the original whole — justified
 *    because the payload crosses two hops with **no configured size limit** and
 *    the only ceiling is an un-configured ~28.6 MB default, inside a synchronous
 *    100 s submit. A side effect worth naming: it makes the service's hardcoded
 *    `image/jpeg` (`Extensions.cs:725`) *true* for the web's traffic, where for
 *    the old client's PNGs it is a lie.
 * 3. 🚩 **PDFs pass through untouched and are refused over 5 MB at the picker**,
 *    with a re-scan message. There is nothing in a PDF to downscale, and finding
 *    out at submit — after the whole request is built — is the failure this moves.
 *
 * 🚩 **The same title twice is allowed**, and this module owns that statement.
 * Two prescriptions are two prescriptions and `sequence` already distinguishes
 * the rows on the wire. It is the *opposite* of the duplicate-item refusal at
 * `addItem` (§2.3) and correctly so — a duplicate engine line really does
 * collide, a duplicate title does not. Nothing here de-duplicates, and the test
 * says so out loud precisely so nobody "fixes" it by analogy.
 */

import type { NphiesSubmitAttachment } from '@/core/models/nphies'

/**
 * §3.5's **closed seven-value title list**, verbatim. No free-text escape: the
 * value reaches a national exchange as typed, and `Id` in particular keeps WPF's
 * wire value rather than being prettied into "National ID".
 *
 * These are wire values, not labels — the screen renders each through its own
 * translation key and sends the code.
 */
export const ATTACHMENT_TITLES = [
  'Id',
  'Prescription',
  'Medical report',
  'Lab result',
  'Radiology report',
  'Insurance card',
  'Referral letter',
] as const

export type AttachmentTitle = (typeof ATTACHMENT_TITLES)[number]

/** The title the picker starts on. A prescription is what a prior authorization
 *  is nearly always evidenced by; `Id` is WPF's default and is the one that
 *  reaches the payer wrongly most often. */
export const DEFAULT_ATTACHMENT_TITLE: AttachmentTitle = 'Prescription'

/** 5 MB, §3.5. A PDF over it is refused **at the picker**. */
export const PDF_MAX_BYTES = 5 * 1024 * 1024

/** The longest edge an image is scaled down to, and the JPEG quality it is
 *  re-encoded at (§3.5). */
export const IMAGE_MAX_EDGE = 2000
export const IMAGE_JPEG_QUALITY = 0.85

/** What the file input offers. Anything else is refused by `planAttachment`
 *  anyway — the `accept` attribute is a courtesy, not the rule. */
export const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,application/pdf'

/** The MIME every image becomes, whatever it arrived as. */
export const IMAGE_CONTENT_TYPE = 'image/jpeg'
export const PDF_CONTENT_TYPE = 'application/pdf'

/** Why a file was refused at the picker. */
export type AttachmentRefusal =
  /** A PDF over `PDF_MAX_BYTES` — the message asks for a re-scan, because that is
   *  the act that fixes it. */
  | { reason: 'pdfTooLarge'; bytes: number }
  /** Neither an image nor a PDF. The exchange takes those two and nothing else. */
  | { reason: 'unsupportedType'; contentType: string }

/**
 * What will be done with this file — **derived from the file, never asked**.
 *
 * `downscale` is what separates the two paths: an image is redrawn at
 * `IMAGE_MAX_EDGE` and re-encoded as JPEG, a PDF is read as-is. There is no third
 * path and no control that could choose one.
 */
export interface AttachmentPlan {
  contentType: string
  downscale: boolean
}

/**
 * The picker's whole decision, from a file's MIME and size.
 *
 * Takes the two fields it reads rather than a `File`, so the rule is testable
 * without a DOM and so nothing in here can reach for a browser API by accident.
 */
export function planAttachment(file: {
  type: string | null | undefined
  size: number
}): { ok: true; plan: AttachmentPlan } | { ok: false; refusal: AttachmentRefusal } {
  const mime = (file.type ?? '').trim().toLowerCase()
  if (mime === PDF_CONTENT_TYPE) {
    if (file.size > PDF_MAX_BYTES) {
      return { ok: false, refusal: { reason: 'pdfTooLarge', bytes: file.size } }
    }
    return { ok: true, plan: { contentType: PDF_CONTENT_TYPE, downscale: false } }
  }
  if (mime.startsWith('image/')) {
    // 🚩 Every image becomes a JPEG, so the derived content type is the one the
    // downscale will actually produce — not the one the file arrived as.
    return { ok: true, plan: { contentType: IMAGE_CONTENT_TYPE, downscale: true } }
  }
  return { ok: false, refusal: { reason: 'unsupportedType', contentType: mime } }
}

/**
 * One prepared attachment, held on the form until `submit` carries it (§1.2:
 * attachments are "not verbs, deliberately"). Nothing about it has been sent.
 */
export interface PreparedAttachment {
  /** A row identity for the list and the remove button. Local only — the wire has
   *  `sequence` and nothing else. */
  id: string
  title: AttachmentTitle
  /** The file's own name. Shown so the agent can tell two prescriptions apart;
   *  never sent — §3.5's body has four fields and this is not one of them. */
  fileName: string
  contentType: string
  /** The base64, with no `data:` prefix — exactly what `attachment` carries. */
  attachment: string
  /** 🚩 The **same** data URL the base64 came out of, so the preview shows what
   *  will be sent rather than a re-render of the original file. */
  dataUrl: string
  /** What the file weighed on disk, and what its base64 weighs now. The pair is
   *  what makes the downscale visible instead of merely claimed. */
  originalBytes: number
  bytes: number
}

/**
 * The submit body's `attachments[]` (§3.5), built from what the form holds.
 *
 * 🚩 **`sequence` is 1-based and positional**, which is what lets two rows carry
 * the same title. Nothing is de-duplicated, sorted or merged here.
 */
export function toSubmitAttachments(prepared: PreparedAttachment[]): NphiesSubmitAttachment[] {
  return prepared.map((row, index) => ({
    sequence: index + 1,
    title: row.title,
    contentType: row.contentType,
    attachment: row.attachment,
  }))
}

/**
 * 🚩 **At least one attachment is mandatory, and it is a FORM STATE.**
 *
 * `GeneralValidation()` refuses any non-advance authorization without one and v1
 * is claim type 0 only, so the request cannot go without one — but the agent
 * learns that from a banner and a disabled Submit while the form is empty, not
 * from an exception after everything else has been filled in.
 */
export function attachmentBlockers(prepared: PreparedAttachment[]): 'noAttachment'[] {
  return prepared.length === 0 ? ['noAttachment'] : []
}

/** What the whole set weighs as base64 — the figure the block shows beside the
 *  rows, because the reason the downscale exists is a payload nobody measured. */
export function totalAttachmentBytes(prepared: PreparedAttachment[]): number {
  return prepared.reduce((sum, row) => sum + row.bytes, 0)
}
