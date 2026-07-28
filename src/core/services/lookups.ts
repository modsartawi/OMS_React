import { queryOptions } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  DeliveryDocumentTypeModel,
  DocumentSourceModel,
  SdDistrictModel,
  SdDocumentTypeModel,
  StoreDetailModel,
} from '@/core/models/lookups'
import type { SdDocumentRescheduleReasonModel, TimeSlotsModel } from '@/core/models/slots'

/**
 * The OMS reference lookups, fetched at most once per session — with ONE
 * deliberate exception at the foot of the table (`availableSlots`), which is
 * store- and time-specific and therefore never cached at all.
 *
 * `staleTime: Infinity` + the shared QueryClient reproduce the Angular
 * prototype's `shareReplay({refCount:false})` semantics — the first caller
 * triggers the request, every later caller (filter dropdowns AND the grid's
 * code resolver) shares the same result — without the RxJS shape (403 §8.3).
 * A failure is NOT cached, so a later mount re-probes.
 */
const session = { staleTime: Infinity, gcTime: Infinity, retry: false } as const

// ⚠️ These five stay on the ungated `SdDocument/*` door on purpose — ticket 125 moved the
// OMS list, loads and write actions to `SdDocumentWeb/*` behind a grant, but not these.
// `storeDetails` feeds the store switcher on EVERY screen, so putting them behind the OMS
// grant would break the shell for an admin-only user. Don't "finish" the swap here.

export const lookupQueries = {
  documentTypes: () =>
    queryOptions({
      queryKey: ['lookup', 'documentTypes'],
      queryFn: () => api.get<SdDocumentTypeModel[]>('SdDocument/DocumentTypes'),
      ...session,
    }),
  documentSources: () =>
    queryOptions({
      queryKey: ['lookup', 'documentSources'],
      queryFn: () => api.get<DocumentSourceModel[]>('SdDocument/DocumentSources'),
      ...session,
    }),
  deliveryDocumentTypes: () =>
    queryOptions({
      queryKey: ['lookup', 'deliveryDocumentTypes'],
      queryFn: () => api.get<DeliveryDocumentTypeModel[]>('SdDocument/DeliveryDocumentTypes'),
      ...session,
    }),
  storeDetails: () =>
    queryOptions({
      queryKey: ['lookup', 'storeDetails'],
      queryFn: () => api.get<StoreDetailModel[]>('SdDocument/StoreDetails'),
      ...session,
    }),
  /** Districts for the Screen 2 Change Store picker in delivery mode (~1.7k rows). */
  districts: () =>
    queryOptions({
      queryKey: ['lookup', 'districts'],
      queryFn: () => api.get<SdDistrictModel[]>('SdDocument/Districts'),
      ...session,
    }),
  /**
   * The bookable delivery windows at one store — `Slots/AvailableSlots/{storeCode}`.
   *
   * 🚩 **Deliberately not session-cached.** Slots are store- AND time-specific: a
   * window free two minutes ago may be full now, so this one is refetched on
   * every open rather than shared like the five above it.
   *
   * It sits here rather than on a feature's `api.ts` because TWO features ask it
   * — Screen 2's reschedule dialog and the call-center console's slot chip — and
   * a feature may never import a feature (`.claude/rules/feature-structure.md`).
   * It stays on the ungated `Slots/*` path on purpose: spec 750 OQ2 ruled it is
   * not an `SdDocument` endpoint, and 137 re-confirmed it off the call-center
   * door on its own terms — slot availability is store *operational* data, with
   * no document or customer data in it.
   */
  availableSlots: (storeCode: string) =>
    queryOptions({
      queryKey: ['lookup', 'availableSlots', storeCode],
      queryFn: () => api.get<TimeSlotsModel>(`Slots/AvailableSlots/${encodeURIComponent(storeCode.trim())}`),
      staleTime: 0,
      gcTime: 0,
      retry: false,
      refetchOnMount: 'always' as const,
    }),
  /** Reasons for the Screen 2 Reschedule picker. */
  rescheduleReasons: () =>
    queryOptions({
      queryKey: ['lookup', 'rescheduleReasons'],
      queryFn: () => api.get<SdDocumentRescheduleReasonModel[]>('Slots/RescheduleReasons'),
      ...session,
    }),
}
