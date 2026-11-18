/**
 * The order page's **Attachments tab** (spec 324, ticket 327) — the pure rules the page
 * reads: whether the tab is drawn at all, the number on its badge, and what it lists.
 *
 * Pure: no React, no network, no i18n. The panel, the reads and the grants are the
 * shared ones in `@/core/attachments`; what is here is what they MEAN for an order.
 *
 * 🔑 **It fails closed.** Every input the page has — the document's two server-stamped
 * fields and the one permissions answer (oms 909) — must be present and agree,
 * or there is no tab. Nothing here guesses a category: not from the page's
 * `documentType`/`documentSource`, not from `attachmentOwnerDocument`, not from a copy
 * of the accept list (spec 324 ruled all three out).
 */
import { canReadAttachmentCategory, canWithdrawAttachment } from '@/core/attachments/access'
import type { AttachmentTarget } from '@/core/attachments/upload'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import type { Permissions } from '@/core/permissions'

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
 * **"Filed on order \<no\>"** (ticket 329) — the order number a delivery's page heads its
 * Attachments tab with, or `null` for no heading.
 *
 * The tab always lists `attachmentOwnerNo`'s files, so on a delivery's page they are
 * its order's (an ATBI owner is an order document too, and reads the same). The two
 * numbers are compared trimmed: the heading shows only when the owner is NOT the
 * route's own document, so an order's page has none, and an absent owner has none.
 * The number comes back trimmed, ready for the sentence and its link.
 */
export function filedOnOrder(ownerNo: unknown, routeNo: string | null | undefined): string | null {
  if (!present(ownerNo)) return null
  const owner = ownerNo.trim()
  return owner === (routeNo ?? '').trim() ? null : owner
}

/**
 * Is the Attachments tab drawn? Only when all three hold:
 * - `attachmentOwnerNo` is present;
 * - `attachmentCategory` is present;
 * - the session reads that category — `Attachments:03:<category>` by its exact spelling,
 *   with the File Server set up (`canReadAttachmentCategory`).
 *
 * A pending or failed permissions answer holds nothing, so both hide the tab.
 */
export function attachmentsTabGate(document: AttachmentFields | null | undefined, permissions: Permissions): boolean {
  return admittedTarget(document, permissions) !== null
}

/** The tab's target when its gate admits, else `null` — the one place both gates start from. */
function admittedTarget(document: AttachmentFields | null | undefined, permissions: Permissions): AttachmentTarget | null {
  const target = orderAttachmentTarget(document)
  return target && canReadAttachmentCategory(permissions, target.category) ? target : null
}

/**
 * Is **Withdraw…** offered on the tab's previewed file (ticket 331)? Only when all
 * three hold:
 * - the tab's own gate (`attachmentsTabGate`): owner, category, and the READ grant;
 * - the session may withdraw from that category — `Attachments:04:<category>` beside
 *   `:03:` (`canWithdrawAttachment`). Per BackOffice 2062 only `P2E` and `ALTIBBI` have a
 *   withdraw grant, so an `ERX` order never offers it;
 * - `reasons` — ByOwner's `withdrawReasons` as read (`withdrawReasonsFrom`) — is a
 *   non-empty list. Absent (not read yet, or an older SIS.Api) or empty hides it: there
 *   is no client fallback list.
 *
 * A bare 403 on the withdraw itself takes it away for the rest of the visit; that is
 * the panel's, not this rule's.
 */
export function canWithdrawOn(
  document: AttachmentFields | null | undefined,
  permissions: Permissions,
  reasons: readonly unknown[] | null | undefined,
): boolean {
  const target = admittedTarget(document, permissions)
  if (!target) return false
  return canWithdrawAttachment(permissions, target.category) && Array.isArray(reasons) && reasons.length > 0
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
