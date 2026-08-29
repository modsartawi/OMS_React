/**
 * The IDoc Inspector feature's server calls (spec 1386).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular
 * is never caught here.
 *
 * **Modelled on `features/reports/retail-invoice/api.ts`, file for file.** The
 * spec says outright that this feature copies that rail rather than re-deciding
 * it: both are a keyed lookup that renders a document and serves a download,
 * both sit behind one screen grant whose probe answers a denial with a 200.
 * ⚠️ **Copied, not imported** — a feature may not import a feature
 * ([feature-structure](../../../../.claude/rules/feature-structure.md)).
 *
 * Ticket 296 landed the access probe; **297 adds `Transaction`**. `Download`
 * (through `api.blob`, because the enveloped helper would try to unwrap raw XML)
 * is 299's, and `Metadata` is 300's.
 *
 * ⚠️ **The door is not built yet.** BackOffice 1387 is this ticket's dependency
 * and is open — so unlike retail-invoice, nothing here has been exercised
 * against a live SIS.Api. That changes what is *proven*, not what is *written*:
 * the fail-closed posture below is the same either way.
 */
import { api } from '@/core/api'
import type {
  IDocInspectorAccessResult,
  IDocInspectorTransaction,
} from '@/core/models/idoc-inspector'
import type { LookupKey } from './lookup-key'

/**
 * The ONE cache key the Reports nav leaf and the screen's own in-page guard
 * share, so a gated screen costs **one** network call and not one per consumer.
 *
 * Exported rather than re-spelled at each site: a typo in a string literal would
 * not fail a build, it would silently split the cache entry and let the nav and
 * the screen disagree about whether the session is allowed in. (Same reasoning
 * as `RETAIL_INVOICE_ACCESS_KEY` beside it.)
 *
 * 🚩 A **separate key from retail-invoice's**, because it is a separate grant.
 * The two screens share an area, a namespace and a nav group; they share no
 * permission, and one probe answering for both would hand a consultant the
 * inspector because they can print receipts.
 */
export const IDOC_INSPECTOR_ACCESS_KEY = ['reports', 'idoc-inspector', 'access'] as const

/**
 * …and the ONE set of options every reader of that key passes.
 *
 * 🚩 The key alone is not enough once there are two readers (the nav leaf and
 * `ScreenGate`): react-query merges the options of concurrent observers, so a
 * consumer that quietly dropped `retry: false` would make a refused probe retry
 * under a gate whose whole ruling is to fail closed on the first no.
 *
 * `staleTime: Infinity` because a grant does not change inside a page life;
 * `retry: false` because 🔑 **a refusal is an answer and not an outage** — the
 * single decision this ticket exists to get right.
 */
export function idocInspectorAccessQuery() {
  return {
    queryKey: IDOC_INSPECTOR_ACCESS_KEY,
    queryFn: () => idocInspectorApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The probe's one predicate, read by BOTH the nav leaf and the screen's guard.
 *
 * `=== true` and nothing looser, so a malformed answer (`{}`, `null`, a string
 * `"true"`) is a denial and not an accident of truthiness. This is the whole of
 * "hidden from the nav without the grant" and "guards itself when reached
 * directly": one function, two callers, no second reading to drift.
 */
export const canOpenIDocInspector = (
  r: IDocInspectorAccessResult | null | undefined,
): boolean => r?.screenAllowed === true

export const idocInspectorApi = {
  /**
   * `GET IDocInspector/Access` → `{ screenAllowed }` (spec 1386, BackOffice 1387).
   *
   * Cookie-gated and deliberately **not** grant-gated: it must be able to answer
   * a session that holds nothing, and 🔑 **it answers a denial with 200**. The
   * client's job is to render that as a shut door — not as an error, and above
   * all not as something to retry.
   *
   * ⚠️ **Fails closed.** No 404-tolerant catch, unlike the `Bby/Access` and
   * `Notifications/Access` probes which degrade to *allowed* while their
   * endpoints are unbuilt. This door is unbuilt too (1387 is open), and that is
   * precisely why it must not degrade open: what is behind it is every IDoc the
   * SAP rail has generated, behind one grant that ships bound to nobody. The
   * shell already treats a pending or errored probe as hidden, so failing closed
   * is the *absence* of a catch rather than code.
   */
  access(): Promise<IDocInspectorAccessResult> {
    return api.get<IDocInspectorAccessResult>('IDocInspector/Access')
  },

  /**
   * `GET IDocInspector/Transaction?storeCode=…&trxNumber=…` → the verdict, an
   * optional attention block and **the whole nested document graph**
   * (spec 1386, BackOffice 1388).
   *
   * 🔑 **One call, and there is never a second.** Selecting a document in the rail
   * or opening a line is a render, not a request: production measurement caps a
   * transaction at five documents, 210 conditions and 515 rows, so the graph is
   * always small enough to send whole. There is no paging at any level and no
   * per-document route to add later — a second round-trip would buy nothing but a
   * loading state.
   *
   * 🚩 **Nested, not flat, and the client must keep it that way.** The document row
   * is the only bridge between the transaction key space (`storeCode`,
   * `trxNumber`) and the document key space (`pharmacyId`, `receiptNumber`).
   * Flattening the graph here would move that join into this repo — the one piece
   * of knowledge the API exists to hold.
   *
   * ⚠️ **An empty result is an ANSWER, not a failure.** Every way of having nothing
   * to show arrives as a 200 carrying a named `verdict` — never a 404, never an
   * empty 200. The two real failures are a blank half of the key (which
   * `buildLookupKey` makes unreachable from this client) and an unexpected fault.
   * Ticket 298 owns the ten verdicts and their wording.
   *
   * The key is built by `lookup-key.ts`, which cannot produce a blank half — so
   * `400 STORE_CODE_REQUIRED` / `TRX_NUMBER_REQUIRED` stay the server's defence
   * rather than a state this screen can reach.
   *
   * ⚠️ Grant-gated server-side and independently of the access probe, which only
   * hides the menu leaf.
   */
  transaction(key: LookupKey): Promise<IDocInspectorTransaction> {
    return api.get<IDocInspectorTransaction>('IDocInspector/Transaction', key)
  },
}
