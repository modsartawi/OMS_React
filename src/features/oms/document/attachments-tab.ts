/**
 * The order page's **Attachments tab** (spec 324, ticket 327) — the pure rules the page
 * reads: whether the tab is drawn at all, the number on its badge, and what it lists.
 *
 * Pure: no React, no network, no i18n. The panel, the reads and the probe's
 * membership test are the shared ones in `@/core/attachments`; what is here is what
 * they MEAN for an order.
 *
 * 🔑 **It fails closed.** Every input the page has — the document's two server-stamped
 * fields and the one shared `AttachmentWeb/Access` answer — must be present and agree,
 * or there is no tab. Nothing here guesses a category: not from the page's
 * `documentType`/`documentSource`, not from `attachmentOwnerDocument`, not from a copy
 * of the accept list (spec 324 ruled all three out).
 */
import { holdsCategory } from '@/core/attachments/rules'
import type { AttachmentTarget } from '@/core/attachments/upload'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'

/** The owner kind an order's files sit under in the attachment register. */
export const SD_DOCUMENT = 'SD_DOCUMENT'

/** The one kind every order accept-list line takes. */
export const PRESCRIPTION = 'PRESCRIPTION'

/** The two document fields the tab reads — BackOffice 2063's owner and 2077's category. */
type AttachmentFields = Pick<SdDocumentHeaderModel, 'attachmentOwnerNo' | 'attachmentCategory'>

/** A field that is there: a string with something in it. Absent, `''` and blank are all "not there". */
function present(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * What the tab lists (and, from 330, files onto): the `SD_DOCUMENT` owner the server
 * named, in the category it named, as a `PRESCRIPTION`. `null` without either field.
 *
 * ⚠ The owner is ALWAYS `attachmentOwnerNo` — on a delivery's page too — never the
 * route's number.
 */
export function orderAttachmentTarget(document: AttachmentFields | null | undefined): AttachmentTarget | null {
  const ownerKey = document?.attachmentOwnerNo
  const category = document?.attachmentCategory
  if (!present(ownerKey) || !present(category)) return null
  return { ownerKind: SD_DOCUMENT, ownerKey, category, kind: PRESCRIPTION }
}

/**
 * Is the Attachments tab drawn? Only when all three hold:
 * - `attachmentOwnerNo` is present;
 * - `attachmentCategory` is present;
 * - the probe's `categories` holds that category — `holdsCategory`, strict array
 *   membership, so a bare string `"P2E"` does not admit `P2E`.
 *
 * `access` is the probe query's `data` as it stands: `undefined` while pending and
 * after a refusal (503 `NOT_SET_UP`, a 403, a network failure), so both hide the tab,
 * as does anything malformed.
 */
export function attachmentsTabGate(document: AttachmentFields | null | undefined, access: unknown): boolean {
  const target = orderAttachmentTarget(document)
  if (!target) return false
  const categories = typeof access === 'object' && access !== null ? (access as { categories?: unknown }).categories : undefined
  return holdsCategory(categories, target.category)
}

/**
 * The tab's number — the badge now, and 328's Files row (one function, never a
 * second count):
 * - once the list has loaded, the length of the STORED list, which wins over the
 *   model's count (a till may have attached since the page loaded);
 * - before that, the model's `attachmentCount`, `0` shown as `0`;
 * - `null` — no badge, never `0` — when the model has no count and no list has loaded
 *   (BackOffice 2063: absent means the server could not count).
 */
export function attachmentsBadgeCount(modelCount: unknown, stored: readonly unknown[] | null | undefined): number | null {
  if (Array.isArray(stored)) return stored.length
  return typeof modelCount === 'number' && Number.isInteger(modelCount) && modelCount >= 0 ? modelCount : null
}
