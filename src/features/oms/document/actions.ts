/**
 * Pure helpers for the Screen 2 corrective actions.
 *
 * Every mutating action maps to a 4-letter `actionType` chosen by the
 * document's CATEGORY, and posts to `UpdateDelivery` (category `D`) or
 * `UpdateDocument` (anything else) — except Reschedule, which has its own
 * endpoint pair, and Return Document, which does not mutate at all.
 *
 * Kept free of React so the code/endpoint selection — including the WPF quirks
 * it faithfully reproduces — is plain data and plain functions.
 */
import type { UpdateSdDocumentHeader } from '@/core/models/sd-document'

/** Actions that post an `UpdateSdDocumentHeader` keyed by a 4-letter `actionType`. */
export type UpdateActionKind =
  | 'add-note'
  | 'close'
  | 'force-close'
  | 'change-store'
  | 'request-close'
  | 'cancel-close-request'

/**
 * Every action on the command panel. Beyond the `UpdateActionKind`s,
 * `reschedule` posts to its own endpoint (no `actionType`) and
 * `return-document` is a placeholder.
 */
export type CommandKind = UpdateActionKind | 'reschedule' | 'return-document'

/** What the command panel emits when the operator triggers an action. */
export interface CommandRequest {
  kind: CommandKind
  /**
   * The free-text note. Required for Add Note; carried by the other Update
   * actions (Close, Force Close, Change Store, Cancel Close Request) to match
   * the WPF. Ignored by Reschedule, Request Close (whose note IS the chosen
   * reason) and Return Document.
   */
  note: string
}

/**
 * Whether this record was opened as a document or a delivery — the ROUTE's
 * answer, not the payload's.
 *
 * Here rather than beside the page component because it is half of the
 * D-17/D-19 pair `isDeliveryCategory` below is the other half of, and the two
 * are read together every time one of them is.
 */
export type OpenedAs = 'document' | 'delivery'

/** `documentCategory` codes that matter to endpoint/action selection. */
const DELIVERY_CATEGORY = 'D'
const ORDER_CATEGORY = 'O'
const ERX_CATEGORY = 'X'

/** Normalise a raw category code for comparison. */
function category(documentCategory: string | null | undefined): string {
  return (documentCategory ?? '').trim()
}

/**
 * Whether a document is routed to the `…Delivery` endpoints — true ONLY for
 * `documentCategory === 'D'`.
 *
 * Distinct from the `openedAs` rule that picks the LOAD endpoint (D-17/D-19),
 * and the two are not interchangeable. Live proof: delivery `9000000003` is
 * opened as a delivery but carries `documentCategory: 'T'` (delivery-return),
 * so it LOADS from `Delivery/{no}` and MUTATES through `UpdateDocument`. Keying
 * either choice off the other field breaks that document.
 */
export function isDeliveryCategory(documentCategory: string | null | undefined): boolean {
  return category(documentCategory) === DELIVERY_CATEGORY
}

/** The `actionType` codes for one Update action, one per document category. */
interface ActionCodes {
  delivery: string
  order: string
  erx: string
  /** Every other category — the return/memo/billing/log categories. */
  other: string
}

/**
 * The `actionType` catalogue, faithful to the WPF `DocumentDetailsController`.
 * The irregularities are the WPF's, and are deliberately preserved:
 *
 * - **Add Note** — its `_` switch arm yields the eRx code for any non-Delivery,
 *   non-Order category.
 * - **Close / Force Close / Cancel Close Request** — no eRx-specific code at
 *   all; every non-Delivery category takes the Order code.
 * - **Change Store** — a non-D/O/X category (which the WPF rejected outright)
 *   falls to the eRx code.
 * - **Request Close** — the WPF default for any other category is the Order code.
 *
 * The `other` column is live, not theoretical: categories `T` and `R` both
 * appear in real data.
 */
const ACTION_CODES: Record<UpdateActionKind, ActionCodes> = {
  'add-note': { delivery: 'DADN', order: 'OADN', erx: 'XADN', other: 'XADN' },
  close: { delivery: 'DCLS', order: 'OCLS', erx: 'OCLS', other: 'OCLS' },
  'force-close': { delivery: 'DFCL', order: 'OFCL', erx: 'OFCL', other: 'OFCL' },
  'change-store': { delivery: 'DCST', order: 'OCST', erx: 'XCST', other: 'XCST' },
  'request-close': { delivery: 'DRCL', order: 'ORCL', erx: 'XRCL', other: 'ORCL' },
  'cancel-close-request': { delivery: 'DCCR', order: 'OCCR', erx: 'OCCR', other: 'OCCR' },
}

/** Resolve the `actionType` for an Update action and document category. */
export function resolveActionType(kind: UpdateActionKind, documentCategory: string): string {
  const codes = ACTION_CODES[kind]
  switch (category(documentCategory)) {
    case DELIVERY_CATEGORY:
      return codes.delivery
    case ORDER_CATEGORY:
      return codes.order
    case ERX_CATEGORY:
      return codes.erx
    default:
      return codes.other
  }
}

/** Extra `UpdateSdDocumentHeader` fields — set only by Change Store. */
export interface UpdateHeaderExtras {
  /** New store code. */
  actionData?: string
  /** Shipping city (delivery mode only). */
  actionData2?: string
}

/**
 * Build the `UpdateSdDocumentHeader` body. The note is trimmed — it lands in the
 * append-only audit log, so incidental whitespace is dropped. `actionData` /
 * `actionData2` are included only when non-empty, keeping a simple action's body
 * minimal.
 */
export function buildUpdateHeader(
  documentNo: string,
  actionType: string,
  note: string,
  extras?: UpdateHeaderExtras,
): UpdateSdDocumentHeader {
  const body: UpdateSdDocumentHeader = {
    documentNo,
    actionType,
    note: (note ?? '').trim(),
  }
  const actionData = (extras?.actionData ?? '').trim()
  if (actionData) body.actionData = actionData

  const actionData2 = (extras?.actionData2 ?? '').trim()
  if (actionData2) body.actionData2 = actionData2

  return body
}
