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
 * Ticket 296 landed the access probe, 297 added `Transaction`, 300 added
 * `Metadata`, and **299 closes the set with `Download`** — through `api.blob`,
 * because the enveloped helper would try to unwrap raw XML.
 *
 * ⚠️ **The doors are built now but nothing here has met one.** BackOffice
 * 1387–1393 are all `done`, so the shapes in `core/models/idoc-inspector` are no
 * longer this client's reading of a spec — 300 reconciled them against the
 * shipped DTOs, which is where `iDocType` and the four fields the document does
 * not carry came from. What is still unproven is the *round trip*: no call in
 * this file has been made against a running SIS.Api, and the drive stubs every
 * one of them.
 */
import { api, type FileResponse } from '@/core/api'
import type {
  IDocInspectorAccessResult,
  IDocInspectorMetadata,
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
   * endpoints are unbuilt. This one must not degrade open even now that 1387 has
   * shipped it: what is behind it is every IDoc the
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

  /**
   * `GET IDocInspector/Metadata` → the nine closed vocabularies and the workflow
   * types this deployment has registered (spec 1386, BackOffice 1392).
   *
   * 🔑 **This is why no vocabulary is compiled into this bundle.** oms-react ships
   * on its own release cadence; a legend baked in here would be wrong the first
   * time a backend constant changes, and it would be wrong *silently*. The route
   * generates the legend by reflection off the pipeline's own constants classes,
   * so the labels and the pipeline are on one deployment.
   *
   * 🚩 **Once per session, and the query below is what makes that true** — not a
   * convention every caller has to remember. The vocabularies change only by
   * deployment, so re-asking inside a page life could only ever get the same
   * answer.
   *
   * ⚠️ **Grant-gated with `Transaction` and `Download`**, and deliberately so: it
   * enumerates the estate's IDoc code sets and this process's registered
   * workflows, which is no more public than the rows it explains. `Access` is the
   * only ungated route and the only one that can be.
   */
  metadata(): Promise<IDocInspectorMetadata> {
    return api.get<IDocInspectorMetadata>('IDocInspector/Metadata')
  },

  /**
   * `GET IDocInspector/Download?storeCode=…&trxNumber=…&idocType=…` → the XML
   * itself (spec 1386, BackOffice 1393).
   *
   * 🔑 **Through `api.blob`, and it could not be anything else.** `request<T>`
   * always calls `res.json()`, so a raw `application/xml` body reaches it as an
   * `ApiError('unknown')`. Only *failures* wear the envelope on this route — the
   * body of a 200 is the XML raw, not base64 and not wrapped — which is the
   * posture `RetailInvoice/Download` established and the reason the core client
   * carries two helpers.
   *
   * ⚠️ **A plain link cannot do this.** The cookie branch of SIS.Api's
   * `ApiKeyEndpointFilter` requires the `X-Web-Client` CSRF header on every
   * cookie-authenticated request, and an `<a href>` or a `window.open` cannot
   * send one — so a download link answers 401. That is also what makes
   * GET-versus-POST a non-question here.
   *
   * ⚠️ **`idocType` is REQUIRED, and one call is one file.** Aggregated and
   * financial are two downloads, never a bundle: all three serialisers emit the
   * same envelope, so a mixed file would be structurally legal and semantically
   * false, and the file handed to a SAP consultant must be the file their team
   * expects to read. The screen offers one button per type *present*
   * (`idocTypesPresent`), so a `404 IDOC_TYPE_NOT_PRESENT` is a client defect
   * rather than a state a consultant can browse into — an enveloped failure, not
   * a verdict.
   *
   * ⚠️ **Identity is never sent.** SIS.Api reads the user off the session row and
   * writes it into the `IDocInspectorAudit` row itself; there is no "who"
   * parameter to add. That audit row is the single write on this entire feature,
   * it is the server's business, and **the client adds no logging of its own**.
   *
   * 🚩 The parts are named one by one rather than spread, so a wider object
   * handed in whole cannot put an extra field on the query string.
   */
  download(key: LookupKey, idocType: string): Promise<FileResponse> {
    return api.blob('IDocInspector/Download', {
      storeCode: key.storeCode,
      trxNumber: key.trxNumber,
      idocType,
    })
  },
}

/**
 * The legend's ONE cache key — the whole of "fetched once per session and
 * reused" (ticket 300).
 *
 * 🚩 Deliberately **not** keyed on the lookup. The legend explains codes, not one
 * transaction, so keying it per lookup would re-fetch the same nine unchanging
 * vocabularies on every search — the exact cost the route was designed to be paid
 * once.
 */
export const IDOC_INSPECTOR_METADATA_KEY = ['reports', 'idoc-inspector', 'metadata'] as const

/**
 * …and the one set of options, spelled once beside the key for the same reason
 * `idocInspectorAccessQuery` is.
 *
 * `staleTime: Infinity` because the nine vocabularies are generated from C#
 * constants and change only by deployment — a second fetch inside a page life
 * could only ever get the same answer back.
 *
 * ⚠️ `retry: false`, and the screen must render **without** this. A legend that
 * refused is missing labels, never a missing screen: the raw codes are what the
 * consultant came for and they are on the transaction payload, not on this one.
 * Retrying would trade a slower screen for labels that are decoration.
 */
export function idocInspectorMetadataQuery() {
  return {
    queryKey: IDOC_INSPECTOR_METADATA_KEY,
    queryFn: () => idocInspectorApi.metadata(),
    staleTime: Infinity,
    retry: false,
  } as const
}
