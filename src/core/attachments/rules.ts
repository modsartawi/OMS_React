/**
 * The attachment register's pure rules (spec 319's slip drawer, lifted by ticket 325
 * for spec 324's order page): the probe's membership test, where a file came from,
 * its preview, its stamps, the Withdrawn (n) order, ByOwner's two lists and what a
 * failed `/Content` means.
 *
 * Pure: no React, no network, no i18n. The words are the caller's `t()`; this only
 * decides which. Nothing here names an owner kind, a category or a kind — the caller
 * passes those (`features/collection/inquiry/slips.ts` keeps the slip's).
 */
import type { ApiEnvelope } from '@/core/api'
import type { AttachmentOwnerSiblings, StoredAttachment, WithdrawnAttachment } from '@/core/models/attachment'

/**
 * Does a probe list hold `category`? **Array membership and nothing looser.**
 *
 * 🚩 The trap is a bare string: `"CASH_CLOSE".includes("CASH_CLOSE")` is true too,
 * so a door that answered `categories: "CASH_CLOSE"` would light the column through
 * a `String.prototype.includes`. Only an array that holds the exact code admits.
 */
export function holdsCategory(list: unknown, category: string): boolean {
  return Array.isArray(list) && list.includes(category)
}

/**
 * Where a file came from: the till's device code, or — a web upload has an empty
 * `sourceDevice` — the web user who filed it (BackOffice 2035, which supersedes
 * 2034's plain "Web"). The words are the caller's `t()`; this only decides which.
 */
export type AttachmentSource = { kind: 'device'; device: string } | { kind: 'web'; uploadedBy: string }

export function attachmentSource(item: { sourceDevice?: string | null; uploadedBy?: string | null }): AttachmentSource {
  const device = typeof item.sourceDevice === 'string' ? item.sourceDevice.trim() : ''
  if (device) return { kind: 'device', device }
  return { kind: 'web', uploadedBy: typeof item.uploadedBy === 'string' ? item.uploadedBy : '' }
}

/** How a fetched file is shown: an `<img>`, an `<iframe>`, or no preview (download only). */
export type AttachmentPreviewKind = 'image' | 'pdf' | 'none'

/**
 * The preview for a `/Content` answer's content type — `image/jpeg` and `image/png`
 * as an image, `application/pdf` in a frame, anything else not at all (its
 * download still works). Parameters and case are ignored; nothing is sniffed.
 */
export function attachmentPreviewKind(contentType: string | null | undefined): AttachmentPreviewKind {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (type === 'image/jpeg' || type === 'image/png') return 'image'
  if (type === 'application/pdf') return 'pdf'
  return 'none'
}

/** `yyyy-MM-ddTHH:mm[:ss]` at the head of a wall-clock stamp. */
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)/

/**
 * A wall-clock stamp as the list prints it: the server's own digits, the `T` cut
 * to a space and any fraction of a second dropped — `2026-09-24T22:31:07.1234567`
 * reads `2026-09-24 22:31:07`.
 *
 * 🔑 A string cut, never a `Date`: `storedAt` and `withdrawnAt` are local wall clock
 * with no zone, and parsing them would shift them by the browser's offset. Anything
 * that is not that shape is shown exactly as sent.
 */
export function wallClockText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const m = WALL_CLOCK.exec(value)
  return m ? `${m[1]} ${m[2]}` : value
}

/**
 * The Withdrawn (n) list: newest withdrawal first, and `n` is its length.
 *
 * The server already sends it in that order; this holds it there by comparing the
 * `withdrawnAt` strings — one ISO wall-clock shape, so the text order IS the time
 * order, with no `Date` in between. A stable sort, so a tie keeps the server's order;
 * a missing stamp sorts last. Returns a new array; a non-array is an empty list.
 */
export function withdrawnNewestFirst(list: unknown): WithdrawnAttachment[] {
  if (!Array.isArray(list)) return []
  const stamp = (w: WithdrawnAttachment | null | undefined) => (typeof w?.withdrawnAt === 'string' ? w.withdrawnAt : '')
  return [...(list as WithdrawnAttachment[])].sort((a, b) => {
    const x = stamp(a)
    const y = stamp(b)
    return x === y ? 0 : x < y ? 1 : -1
  })
}

/** An owner's files as the panel reads them. */
export interface AttachmentOwnerList {
  /** STORED files, newest first as sent. */
  stored: StoredAttachment[]
  /** Withdrawn files, newest withdrawal first. */
  withdrawn: WithdrawnAttachment[]
}

/**
 * `ByOwner`'s envelope → the two lists. `withdrawn` rides BESIDE `data`
 * (BackOffice 2035), which is why the read keeps the envelope; an older SIS.Api
 * omits it, and that reads as nothing withdrawn.
 */
export function attachmentOwnerList(
  envelope: ApiEnvelope<StoredAttachment[], AttachmentOwnerSiblings>,
): AttachmentOwnerList {
  return {
    stored: Array.isArray(envelope.data) ? envelope.data : [],
    withdrawn: withdrawnNewestFirst(envelope.withdrawn),
  }
}

/**
 * The two `/Content` refusal codes the panel words itself (`AttachmentContentResult`
 * on pricing2). Branched on the CODE, never the status: a 502 is also
 * `FILE_SERVER_KEY_REFUSED`, which is IT's to fix, not a lost file.
 */
export const CONTENT_NOT_FOUND = 'NOT_FOUND'
export const CONTENT_FILE_MISSING = 'FILE_SERVER_MISSING'

/**
 * What a failed `/Content` means for the panel:
 * - `gone`: 404 `NOT_FOUND`. The file is no longer readable (withdrawn meanwhile):
 *   say so and re-read `ByOwner`.
 * - `lost`: 502 `FILE_SERVER_MISSING`. The File Server no longer holds the file. Not
 *   the user's fault, and no retry.
 * - `other`: anything else, shown as the server sent it.
 */
export type AttachmentContentFailure = 'gone' | 'lost' | 'other'

export function attachmentContentFailure(code: string | null | undefined): AttachmentContentFailure {
  if (code === CONTENT_NOT_FOUND) return 'gone'
  if (code === CONTENT_FILE_MISSING) return 'lost'
  return 'other'
}
