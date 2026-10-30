/**
 * A donor request's HOST (BackOffice spec 3242, ticket 672): the picking source it was raised on, named by a
 * (source type, key) pair. A delivery is one host among several — a prescription session (`PSES`), a Wasfaty+
 * order (`WP`), and later Nphies (`NPHS`) and Wasfaty (`WSFT`) approvals or a parked till transaction (`POS`).
 * The key still travels in `deliveryNo` (up to 64 characters). Pure: no React, no `t`.
 *
 * The words for the host are the SERVER's (`hostLabel` / `hostLabelAr`, BackOffice `DonorHostWords`): this side
 * never words a source type itself. 🔑 A blank or missing source type is a delivery — an older server sends none
 * (and the server's own reading of a blank code is OMS), so such a row reads exactly as it did before 3242.
 */

/** The source type of a delivery host: the only host Document Details can open. */
export const DELIVERY_HOST = 'OMS'

export interface DonorHost {
  /** Upper-cased; `OMS` for a blank or missing one. */
  sourceType: string
  /** The host key as sent (`deliveryNo` / `hostKey`), trimmed. */
  key: string
  isDelivery: boolean
  /** The server's words for the host; `''` when it sent none (an older server). */
  labelEn: string
  labelAr: string
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export function donorHost(
  sourceType: string | null | undefined,
  key: string | null | undefined,
  labelEn?: string | null,
  labelAr?: string | null,
): DonorHost {
  const type = text(sourceType).toUpperCase() || DELIVERY_HOST
  return { sourceType: type, key: text(key), isDelivery: type === DELIVERY_HOST, labelEn: text(labelEn), labelAr: text(labelAr) }
}

/**
 * The host as a person reads it in `lang`: the server's Arabic label under Arabic when it sent one, else its English
 * one. A host the server sent no words for reads as its key — which is what a delivery always showed.
 */
export function hostLabelIn(host: DonorHost, lang: string): string {
  if (lang.startsWith('ar') && host.labelAr) return host.labelAr
  return host.labelEn || host.labelAr || host.key
}

/**
 * The host as a list cell says it: a delivery as its bare number, exactly as before 3242; any other host in the
 * server's words ("Wasfaty+ order 98765"), which carry the key.
 */
export function hostCellText(host: DonorHost, lang: string): string {
  return host.isDelivery ? host.key : hostLabelIn(host, lang)
}
