/**
 * The Pick support console's door calls (ticket 496, BackOffice brief 2691; doors 2687–2690).
 * They live in `core/` rather than with the console because Document Details (ticket 499) reads
 * the same diagnosis, and a feature may not import another (`feature-structure`). The precedent
 * is `@/core/attachments`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 * 🚩 The doors are built but not confirmed deployed: every proof until ticket 500 is a stub of
 * the brief's JSON.
 */
import { api } from '@/core/api'
import type {
  PickSupportCensus,
  PickSupportCensusParams,
  PickSupportDiagnosis,
  PickSupportFixRequest,
  PickSupportFixResult,
  PickSupportResolution,
} from '@/core/models/pick-support'

export const pickSupportApi = {
  /**
   * `GET PickSupport/Resolve?key=` — any number a store sent to its deliveries (and, for a
   * serial, the documents holding it). `matched: false` is a 200 carrying the server's sentence,
   * not an error. A blank key is refused `PICK-00003`; the caller never sends one.
   */
  resolve(key: string): Promise<PickSupportResolution> {
    return api.get<PickSupportResolution>('PickSupport/Resolve', { key })
  },

  /**
   * `GET PickSupport/StuckNow?store=&shape=` (ticket 498) — every delivery stuck now, one row per
   * delivery per shape. Read afresh on every call: there is no background job behind it. A shape
   * that is not one of the three codes is refused `PICK-00003`.
   */
  stuckNow(params: PickSupportCensusParams): Promise<PickSupportCensus> {
    return api.get<PickSupportCensus>('PickSupport/StuckNow', params)
  },

  /** `GET PickSupport/Delivery/{deliveryNo}` — the diagnosis. Unknown → `PICK-00002`. */
  delivery(deliveryNo: string): Promise<PickSupportDiagnosis> {
    return api.get<PickSupportDiagnosis>(`PickSupport/Delivery/${encodeURIComponent(deliveryNo)}`)
  },

  /**
   * `POST PickSupport/Delivery/{deliveryNo}/Fix` (ticket 497) — a shape's one fix, which the
   * server applies only while the delivery is still in that shape (`PICK-00224` otherwise). The
   * body is `{ shape, reason, complaintRef }` and nothing else: the session is the actor.
   */
  fix(deliveryNo: string, body: PickSupportFixRequest): Promise<PickSupportFixResult> {
    return api.post<PickSupportFixResult>(`PickSupport/Delivery/${encodeURIComponent(deliveryNo)}/Fix`, body)
  },
}

/**
 * The query keys, under one root so a later write (497's fix) can invalidate every read of a
 * delivery at once. No long `staleTime` anywhere: support reads the delivery as it is now.
 */
export const pickSupportKeys = {
  all: ['pick-support'] as const,
  resolve: (key: string) => ['pick-support', 'resolve', key] as const,
  delivery: (deliveryNo: string) => ['pick-support', 'delivery', deliveryNo] as const,
  /** Every diagnosis read, whichever delivery. */
  deliveries: ['pick-support', 'delivery'] as const,
  census: (params: PickSupportCensusParams) => ['pick-support', 'census', params.store ?? '', params.shape ?? ''] as const,
}

/** The diagnosis query's options — shared by the console and Document Details (499). */
export function pickSupportDiagnosisQuery(deliveryNo: string) {
  return {
    queryKey: pickSupportKeys.delivery(deliveryNo),
    queryFn: () => pickSupportApi.delivery(deliveryNo),
    retry: false,
  } as const
}
