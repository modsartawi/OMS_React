/**
 * The one shape a refused serving-list write takes (BackOffice spec 3042, oms tickets 569-570): a bare 403 is the
 * Execute grant not held; a coded refusal keeps its code and server text ("English / Arabic"), takes this side's
 * words for a known code, and says whether the screen is behind the server (refetch); anything without a code is
 * the taxonomy's network / server line. Pure: no React, no `t` — a dialog turns `labelKey` into words.
 *
 * `./write-refusal` and `./add-stores-refusal` are this skeleton with their own label map and stale codes.
 */
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'

export type Refusal =
  /** A bare 403: the Execute grant is not held (the probe said otherwise, or it was revoked since). */
  | { kind: 'notGranted' }
  /** An envelope refusal: its code and server text, this side's words for a known code, and whether to refetch. */
  | { kind: 'refused'; code: string; labelKey: string | null; message: string; stale: boolean }
  /** Anything without a code: the taxonomy's network / server line, or a crash (`''` — the dialog words it). */
  | { kind: 'failed'; message: string }

export interface RefusalMap {
  /** A known code → its label key. */
  labels: Readonly<Record<string, string>>
  /** The codes that mean the screen is stale. */
  stale: ReadonlySet<string>
}

export function refusalOf(err: unknown, map: RefusalMap): Refusal {
  if (isBareDenial(err)) return { kind: 'notGranted' }
  const message = apiErrorMessage(err, '')
  const code = apiErrorCode(err)
  if (!code) return { kind: 'failed', message }
  return { kind: 'refused', code, labelKey: map.labels[code] ?? null, message, stale: map.stale.has(code) }
}
