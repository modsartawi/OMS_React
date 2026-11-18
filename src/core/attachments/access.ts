/**
 * The attachment register's grants, read off the one permissions answer (oms 909, BackOffice spec 4002 row 3). The
 * Attachments screen key carries a third field, the category: `Attachments:03:<category>` reads it,
 * `Attachments:04:<category>` withdraws from it. The categories are derived from the answer's `screens`, never
 * hard-coded, and the File Server's readiness is `extras.fileServerReady` (what the old probe's 503 `NOT_SET_UP` said).
 *
 * ⚠️ For drawing only: every `AttachmentWeb` route checks the grant again. ADMIN holds no three-field key, so ADMIN
 * reads no category here — by design, not a special case.
 */
import type { Permissions } from '@/core/permissions'

const READ_PREFIX = 'Attachments:03:'

/** The categories the session may read: the suffix of every `Attachments:03:<category>` key it holds. */
export function attachmentReadCategories(p: Permissions): string[] {
  return p.screens.filter((s) => s.startsWith(READ_PREFIX) && s.length > READ_PREFIX.length).map((s) => s.slice(READ_PREFIX.length))
}

/** The register is drawable at all: the File Server is set up on this host and some category is readable. */
export function canOpenAttachments(p: Permissions): boolean {
  return p.extras.fileServerReady && attachmentReadCategories(p).length > 0
}

/** One category is readable: the File Server is set up and `Attachments:03:<category>` is held. Exact spelling. */
export function canReadAttachmentCategory(p: Permissions, category: string): boolean {
  return p.extras.fileServerReady && p.has(`Attachments:03:${category}`)
}

/** One category may be withdrawn from: `Attachments:04:<category>` AND `Attachments:03:<category>`. */
export function canWithdrawAttachment(p: Permissions, category: string): boolean {
  return p.has(`Attachments:04:${category}`) && p.has(`Attachments:03:${category}`)
}
