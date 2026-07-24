/**
 * The five live document payloads captured by ticket 078, as the fixture corpus
 * for this feature's pure tests (spec 083, Testing Decisions).
 *
 * They are imported from `.issues/assets/078-document-payloads/` rather than
 * hand-written: every rule on this screen was derived from those files, and a
 * hand-copied fixture is a rule tested against a hypothesis. Redactions
 * (`courierDriverMasterPinCode`, `customer.nationalIdNumber`) are already applied
 * in the files; each carries a `_capture` block saying so.
 *
 * Test-only. Nothing in the app imports this module — the payloads live outside
 * `src/` and never reach the bundle.
 */
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import erx from '../../../../../.issues/assets/078-document-payloads/2000000551-erx.json'
import driverAssigned from '../../../../../.issues/assets/078-document-payloads/8000000121-driver-assigned.json'
import cancellationRequested from '../../../../../.issues/assets/078-document-payloads/8000000174-cancellation-requested.json'
import delivery from '../../../../../.issues/assets/078-document-payloads/8000000253-delivery.json'
import deliveryReturn from '../../../../../.issues/assets/078-document-payloads/9000000003-delivery-return.json'

/**
 * The captures are whole `HttpGeneralResponse` envelopes; the document is their
 * `data`.
 *
 * The cast goes through `unknown` deliberately. `SdDocumentHeaderStatusModel`
 * declares its coded fields as `string`, and live data emits `null` for
 * `availabilityStatus` on all five documents — that gap between the declared
 * contract and the wire is precisely what these rules are written to survive, so
 * the fixtures keep the payload verbatim rather than being widened to fit.
 */
function payload(capture: { data: unknown }): SdDocumentHeaderModel {
  return capture.data as unknown as SdDocumentHeaderModel
}

/** The five captures, keyed by document number, in ascending order. */
export const PAYLOADS = {
  '2000000551': payload(erx),
  '8000000121': payload(driverAssigned),
  '8000000174': payload(cancellationRequested),
  '8000000253': payload(delivery),
  '9000000003': payload(deliveryReturn),
} as const

export type CapturedDocumentNo = keyof typeof PAYLOADS

/** The corpus in ascending document-number order — the order every table uses. */
export const DOCUMENT_NUMBERS = Object.keys(PAYLOADS) as CapturedDocumentNo[]
