/**
 * The Retail Invoice feature's server calls (spec 261).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular
 * is never caught here.
 *
 * **The door is real and live.** `RetailInvoice/*` shipped from BackOffice map
 * 984 (spec 1042) and the whole leg — login → Access → Search → Download —
 * was exercised end to end on 2026-08-10. Ticket 266 is the slice that points
 * this screen at it; 263–265 are proven on fixtures, which is a sequencing
 * choice about a two-process manual setup and not a statement that anything here
 * is unbuilt.
 *
 * All three routes live here now: `Access` (263), `Search` (264) and `Download`
 * (265) — the last through 262's binary door, because the envelope client cannot
 * fetch a non-JSON body.
 */
import { api, type FileResponse } from '@/core/api'
import type {
  InvoiceSearchResult,
  RetailInvoiceAccessResult,
  RetailInvoiceKey,
} from '@/core/models/retail-invoice'
import type { InvoiceSearchQuery } from './invoice-criteria'

/**
 * The ONE cache key the Reports nav leaf and the screen's own in-page guard
 * share, so a gated area costs **one** network call and not one per consumer.
 *
 * Exported rather than re-spelled at each site: a typo in a string literal would
 * not fail a build, it would silently split the cache entry and let the nav and
 * the screen disagree about whether the session is allowed in. (Same reasoning
 * as `COLLECTION_ACCESS_KEY` at ticket 253.)
 */
export const RETAIL_INVOICE_ACCESS_KEY = ['reports', 'retail-invoice', 'access'] as const

/**
 * …and the ONE set of options every reader of that key passes.
 *
 * 🚩 The key alone is not enough once there are two readers (the nav leaf and
 * `ScreenGate`): react-query merges the options of concurrent observers, so a
 * consumer that quietly dropped `retry: false` would make a refused probe retry
 * under a gate whose whole ruling is to fail closed on the first no. The options
 * travel with the key, spelled once — the shape ticket 257 settled for
 * collection.
 *
 * `staleTime: Infinity` because a grant does not change inside a page life;
 * `retry: false` because a refusal is an answer and not an outage.
 */
export function retailInvoiceAccessQuery() {
  return {
    queryKey: RETAIL_INVOICE_ACCESS_KEY,
    queryFn: () => retailInvoiceApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The probe's one predicate, read by BOTH the nav leaf and the screen's guard.
 *
 * `=== true` and nothing looser, so a malformed answer (`{}`, `null`, a string
 * `"true"`) is a denial and not an accident of truthiness.
 */
export const canOpenRetailInvoice = (
  r: RetailInvoiceAccessResult | null | undefined,
): boolean => r?.screenAllowed === true

export const retailInvoiceApi = {
  /**
   * `GET RetailInvoice/Access` → `{ screenAllowed }` (contract §1).
   *
   * Cookie-gated and deliberately **not** grant-gated: it must be able to answer
   * a session that holds nothing, and it answers a denial with **200**.
   *
   * ⚠️ **Fails closed.** No 404-tolerant catch, unlike the `Bby/Access` and
   * `Notifications/Access` probes which degrade to *allowed* while their
   * endpoints are unbuilt. This door is built, so an unknown or failed probe has
   * no benign reading — and what is behind it is every retail transaction in the
   * estate behind a single grant (988 D16). The shell already treats a pending or
   * errored probe as hidden, so failing closed is the *absence* of a catch rather
   * than code.
   */
  access(): Promise<RetailInvoiceAccessResult> {
    return api.get<RetailInvoiceAccessResult>('RetailInvoice/Access')
  },

  /**
   * `GET RetailInvoice/Search?trxNumber=…[&storeCode=…]` → the candidate list
   * (contract §1, ticket 264).
   *
   * The params are built by `invoice-criteria.ts`, which cannot produce a blank
   * `trxNumber` — so `400 TRX_NUMBER_REQUIRED` stays the server's defence rather
   * than a state this screen can reach.
   *
   * 🚩 **No matches is a `200` with `rows: []`, never a 404**, and a single match
   * is still a **one-row list** rather than a redirect or an automatic download:
   * the client parses exactly one success shape (contract D14, re-confirmed at
   * 988). ⚠️ And the list is **unfiltered** — cash clearances, training and
   * suspended sales come back with everything else, deliberately (owner ruling,
   * 988), which is why `trxType`/`trxStatus` are columns.
   *
   * ⚠️ Grant-gated server-side, and a refusal here is a **bare 403 with no body
   * at all** — no envelope, no `errorCode` — so the screen branches on
   * `statusCode === 403`, not on a code. The access probe only hides the menu.
   */
  search(params: InvoiceSearchQuery): Promise<InvoiceSearchResult> {
    return api.get<InvoiceSearchResult>('RetailInvoice/Search', params)
  },

  /**
   * `GET RetailInvoice/Download?storeCode=…&machineCode=…&trxNumber=…` → the PDF
   * itself (contract §1, ticket 265).
   *
   * 🔑 **Through `api.blob`, and it could not be anything else.** `request<T>`
   * always calls `res.json()`, so a raw `application/pdf` body reaches it as an
   * `ApiError('unknown')` — that is the reason 262 exists. And a plain `<a href>`
   * or `window.open` cannot work either: the cookie branch of SIS.Api's
   * `ApiKeyEndpointFilter` requires the `X-Web-Client` CSRF header on every
   * cookie-authenticated request and a browser navigation cannot send one, so a
   * download link answers 401 (contract §5).
   *
   * 🔑 **The key is THREE parts, spelled out one by one.** `RetailTrx`'s primary
   * key is four — `Client` + `StoreCode` + `MachineCode` + `TrxNumber` — but
   * `Client` is a fixed `'000'` estate-wide and slated for removal (owner ruling,
   * 988), so it is not a request parameter, not a response field and not on the
   * wire. ⚠️ **Do not add a fourth part.** The three are named individually
   * rather than spread, so a row object handed in whole cannot put an extra
   * field on the query string.
   *
   * ⚠️ **Identity is never sent.** SIS.Api reads the user from the session row
   * and passes it to the renderer as `requestedBy` for the journal;
   * `staffid`/`storecode` headers are ignored on the cookie path. There is no
   * "who" parameter to add, and every attempt is journalled server-side in the HQ
   * `ReportRenderAttempt` table — **there is no separate audit, so the client
   * adds no logging of its own.**
   *
   * The key is built from a clicked row, never from user input: a missing part is
   * a `400 INVALID_KEY`, which means the row was malformed — a client bug rather
   * than a message for a user.
   */
  download(key: RetailInvoiceKey): Promise<FileResponse> {
    return api.blob('RetailInvoice/Download', {
      storeCode: key.storeCode,
      machineCode: key.machineCode,
      trxNumber: key.trxNumber,
    })
  },
}
