/**
 * Cancellation reasons for the Request Close picker.
 *
 * **Risk R-2.** The canonical reason list lives on a legacy `orderCancelReasons`
 * endpoint on a different base URL than SIS.Api, with no SIS.Api equivalent yet
 * (confirmed against `SdDocumentEndpoints.cs`). Per the owner's decision the web
 * UI ships this hardcoded list; a dedicated endpoint replaces it later.
 *
 * The reason the operator picks becomes the `note` on the Request Close call —
 * there are no codes, the string IS the note. Order is meaningful (it is the
 * dropdown order); keep it identical to the Angular prototype's list.
 *
 * These are deliberately NOT i18n keys: they are data standing in for a server
 * list, not UI chrome, and inventing translations would fake a contract the
 * replacement endpoint will own.
 */
export const CANCEL_REASONS: readonly string[] = [
  'Customer requested cancellation',
  'Customer not reachable',
  'Item out of stock',
  'Duplicate order',
  'Wrong item ordered',
  'Incorrect or incomplete delivery address',
  'Delivery delay',
  'Pricing or payment issue',
  'Prescription not valid',
  'Order placed by mistake',
]
