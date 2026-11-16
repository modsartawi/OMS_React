/**
 * A document's **family** (BackOffice spec 3953, endpoint 3954, shape fixed by ruling 3944):
 * `GET SdDocumentWeb/Document/{documentNo}/Family?category={category}` answers every member of the
 * family the asked (number, category) belongs to, as a flat list from which the client draws the tree.
 *
 * A member is always keyed by **number and category**: billings and return orders share the 30… range.
 * The answer carries no money and no quantities.
 */

/** A root partner order's partner reference (for example Bupa and its order id). */
export interface DocumentFamilyPartnerReference {
  source: string | null
  orderNo: string | null
  sourceReference: string | null
}

/** One member of the family. */
export interface DocumentFamilyNode {
  no: string
  /** Q O X R E (Sd document), D T (delivery), B (billing), C V (memos). Read from the member's own header. */
  category: string
  /** The family-link parent; both `null` on the root. */
  parentNo: string | null
  parentCategory: string | null
  documentType: string | null
  documentTypeDescription: string | null
  /** `null` on a billing (a billing header has no status). */
  status: string | null
  statusDescription: string | null
  storeCode: string | null
  storeName: string | null
  /** Local wall-clock, as stored (`no-utc-time`). */
  entryTime: string | null
  /** `"delivery"` (D, T) · `"document"` (Q, O, X, R, E) · `null` (B, C, V). */
  pageKind: 'delivery' | 'document' | null
  /** Root O/X only. */
  partnerReference: DocumentFamilyPartnerReference | null
  /** Billing only: its till invoice (`RefInvoiceNo`). */
  tillInvoiceNo: string | null
}

/** The endpoint's answer (the envelope's `data`). */
export interface DocumentFamily {
  askedNo: string
  askedCategory: string
  rootNo: string
  rootCategory: string
  /** The walk hit its cap (depth 6, 100 members); the path from the asked document to the root is still kept. */
  truncated: boolean
  nodes: DocumentFamilyNode[]
}
