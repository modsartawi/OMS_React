/**
 * Central invoicing's server calls (BackOffice spec 2094, ticket 2099; client ticket 332).
 *
 * In `@/core/` rather than in a feature because it has two feature consumers — the
 * delivery page's *Central invoice…* action (`features/oms/document`) and the bulk screen
 * (`features/oms/central-invoice`) — plus the menu leaf, and a feature may never import
 * another feature ([feature-structure](../../../.claude/rules/feature-structure.md)). The
 * OMS and Nphies probes moved here for the same reason.
 *
 * Every call goes through `@/core/api` (`api-envelope`): the envelope, the error taxonomy
 * and 401 are that module's.
 *
 * What a central invoice contains, and every eligibility rule, lives on the server. This
 * client asks and shows the answer.
 */
import type { QueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/core/api'
import type {
  CentralInvoiceAccessResult,
  CentralInvoiceRaiseRequest,
  CentralInvoiceRaiseResponse,
  CentralInvoiceRaiseResult,
} from '@/core/models/central-invoice'

/**
 * The server's cap on one request (`CentralInvoiceRequestService.MaxDeliveriesPerRequest`),
 * counted on DISTINCT deliveries. The client holds a request over it back rather than
 * letting the server refuse it whole with a 400.
 */
export const CENTRAL_INVOICE_MAX_DELIVERIES = 200

/**
 * The ONE cache key the menu leaf, the bulk screen's gate and the delivery page's action
 * share, so the grant costs one network call and not three. Exported rather than
 * re-spelled: a typo would silently split the cache entry, and a door shut by a 403 on
 * one consumer would stay open on another.
 */
export const CENTRAL_INVOICE_ACCESS_KEY = ['central-invoice', 'access'] as const

/**
 * …and the ONE set of options every reader of that key passes (the `ScreenGate` contract).
 * `staleTime: Infinity` because a grant does not change inside a page life; `retry: false`
 * because a refusal is an answer, not an outage.
 */
export function centralInvoiceAccessQuery() {
  return {
    queryKey: CENTRAL_INVOICE_ACCESS_KEY,
    queryFn: () => centralInvoiceApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The grant's one predicate, read by the menu leaf, the screen's gate and the delivery
 * page. `=== true` and nothing looser, so a malformed answer is a denial.
 */
export const canOpenCentralInvoice = (r: CentralInvoiceAccessResult | null | undefined): boolean =>
  r?.canOpen === true

/**
 * Whether a failure is the grant refusing this session: a **403**, bare (the grant filter refuses
 * with no body, so it reaches here as `kind: 'unknown'`) or enveloped. Keyed on the
 * status because that is the one thing the bare refusal carries.
 *
 * A 400 is not this — that is a request refused as a whole (no reason, over the cap),
 * with the server's sentence to show.
 */
export function isGrantRefused(err: unknown): boolean {
  return err instanceof ApiError && err.statusCode === 403
}

/**
 * Revoke the grant for the rest of the page life, after a 403 from either call: the shared
 * probe entry is overwritten with a denial, so the menu leaf, the bulk screen's gate and
 * the delivery page's action all drop together — the answer the server just gave
 * outranks the probe's earlier one.
 */
export function revokeCentralInvoiceAccess(queryClient: QueryClient): void {
  queryClient.setQueryData<CentralInvoiceAccessResult>(CENTRAL_INVOICE_ACCESS_KEY, { canOpen: false })
}

export const centralInvoiceApi = {
  /**
   * `GET Sd/CentralInvoice/Access` → `{ canOpen }`.
   *
   * ⚠️ **Fails closed** — no 404-tolerant catch. What is behind it bypasses the pick
   * gate and mints invoices, so an unreachable probe hides the action and the screen.
   */
  access(): Promise<CentralInvoiceAccessResult> {
    return api.get<CentralInvoiceAccessResult>('Sd/CentralInvoice/Access')
  },

  /**
   * `POST Sd/CentralInvoice` with `{ deliveryNos, reason }` → one result per distinct
   * delivery, in the order sent.
   *
   * A delivery's own refusal (or *wait*) rides the 200. A request refused as a whole —
   * no reason, over 200 — is a 400 with the server's sentence. Without the grant it is a
   * bare 403 and nothing is read or queued.
   *
   * The actor is never sent: the server records the session's user.
   */
  async raise(request: CentralInvoiceRaiseRequest): Promise<CentralInvoiceRaiseResult[]> {
    // Named field by field, so a wider object handed in cannot put an extra field on the wire.
    const body: CentralInvoiceRaiseRequest = { deliveryNos: request.deliveryNos, reason: request.reason }
    const data = await api.post<CentralInvoiceRaiseResponse>('Sd/CentralInvoice', body)
    return data?.results ?? []
  },
}
