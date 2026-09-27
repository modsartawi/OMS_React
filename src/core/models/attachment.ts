/* ════════════════════════════════════════════════════════════════════════════
 * The attachment register's web door (`AttachmentWeb/*`), shared by every owner
 * kind that reads it — a store day's ECR slips (spec 319) and, from spec 324, an
 * order's prescriptions. Lifted out of `collection.ts` by ticket 325; the slip names
 * there are aliases of these, and nothing is renamed on the wire.
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Whose files: the owner kind (a machine code, never shown — `STORE_DAY`,
 * `SD_DOCUMENT`) and the owner's key under it. ByOwner, the upload store's slot and
 * the list's cache key are all by this pair.
 */
export interface AttachmentOwner {
  ownerKind: string
  ownerKey: string
}

/**
 * `GET AttachmentWeb/Access` — which attachment categories the session holds
 * (BackOffice 2034) and which it may withdraw from (BackOffice 2035). Cookie-only,
 * not grant-gated, and a 503 `NOT_SET_UP` until the File Server key exists.
 *
 * ⚠️ **For drawing only**: every AttachmentWeb route checks the grant again.
 * Both lists are read with a strict array-membership test, never truthiness — a
 * malformed answer (a bare string, a missing field) is a denial.
 */
export interface AttachmentAccess {
  categories: string[]
  /** The withdraw grant's categories (BackOffice 2035). Optional: an older SIS.Api omits it. */
  withdrawCategories?: string[]
}

/**
 * `GET AttachmentWeb/ByOwner?ownerKind=…&ownerKey=…` — one STORED attachment of an
 * owner (BackOffice 2034 + 2035, `AttachmentDto` on pricing2), camel-cased by the
 * serializer, with **nothing added and nothing renamed**. `data` is these, newest
 * first as sent.
 *
 * ⚠️ `storedAt` is **local wall clock with no zone**. It is drawn as sent, never
 * parsed through `new Date(...)`, which would read it as UTC or as the browser's zone.
 */
export interface StoredAttachment {
  attachmentId: string
  status: string
  ownerKind: string
  ownerKey: string
  category: string
  kind: string
  /** The uploader's original file name — and the name a download saves under. */
  fileName: string
  sizeBytes: number
  storedAt: string
  /** The till that sent it; `''` for a web upload (BackOffice 2034). */
  sourceDevice: string
  /** The till's staff id, or the web user's Ua `UserId` when `sourceDevice` is empty (BackOffice 2035). */
  uploadedBy: string
}

/**
 * One withdrawn attachment, **metadata only** (BackOffice 2035, `WithdrawnAttachmentDto`).
 * There is no preview and no download of it: `/Content` answers 404 for a withdrawn
 * row (C6), so `attachmentId` is a list key here, never a handle to the bytes.
 *
 * `reasonLabel` / `reasonLabelArabic` are the SERVER's copies of the reason, and
 * the list draws those — never a client-side table. Both timestamps are local wall
 * clock with no zone, like `storedAt`.
 */
export interface WithdrawnAttachment {
  attachmentId: string
  category: string
  kind: string
  fileName: string
  sourceDevice: string
  uploadedBy: string
  storedAt: string
  withdrawnBy: string
  withdrawnAt: string
  reasonCode: string
  reasonLabel: string
  reasonLabelArabic: string
  /** `''` when none was given. */
  note: string
}

/**
 * One STORED file of an order (`SD_DOCUMENT`, spec 324): the shared item plus the
 * uploader's `caption` (BackOffice 2056, `AttachmentDto.Caption`), `''` when none was
 * given. Shown when not empty.
 */
export interface SdDocumentAttachment extends StoredAttachment {
  caption: string
}

/**
 * One withdraw reason of the listed owner's kind, as `ByOwner` sends it beside `data`
 * (BackOffice 2062, `AttachmentWithdrawReason`), in picker order. The labels are the
 * server's, English and Arabic, never a client copy. Read by ticket 331.
 */
export interface AttachmentWithdrawReasonModel {
  code: string
  label: string
  labelArabic: string
  noteRequired: boolean
}

/**
 * The siblings `ByOwner` puts **beside** `data` (BackOffice 2035 + 2062,
 * `AttachmentOwnerListResponse`), read through `api.getEnvelope`: the owner's
 * withdrawn attachments, newest withdrawal first, and the owner kind's withdraw
 * reasons (optional: an older SIS.Api omits them).
 */
export interface AttachmentOwnerSiblings {
  withdrawn: WithdrawnAttachment[]
  withdrawReasons?: AttachmentWithdrawReasonModel[]
}
