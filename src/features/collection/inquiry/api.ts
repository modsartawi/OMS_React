/**
 * The Collections feature's server calls (spec 249).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular
 * is never caught here.
 *
 * **The door is real** as of ticket 259. `CollectionWeb/*` is BackOffice 1089–1093
 * (one file, one tag, four grant gates, plus the two document builders), and every
 * route below has now been answered by a live SIS.Api rather than by a Playwright
 * stub. Two things about the wave that shipped before it are worth keeping in
 * mind here, because both are still true:
 *
 * - ⚠️ **A 403 means the cookie marker, not the grant.** Issue 802 inverted
 *   `ApiKeyEndpointFilter`'s cookie branch to default-deny, so an unmarked route
 *   answers a browser 403 — deliberately a 403 and not a 401, so a missed marker
 *   breaks ONE screen instead of logging the whole tab out.
 * - ⚠️ **`Attempts` refuses most sessions on day one.** `CollectionAttempts` never
 *   had a legacy WPF seed (that screen rode ADMIN's bypass), so no migrated grant
 *   carries a holder until an admin binds it in Authz Admin. A refusal there is
 *   configuration, not a defect.
 */
import { api } from '@/core/api'
import type {
  AcrDocument,
  AcrInquiryRow,
  CollectionAccessResult,
  CollectionAttemptRow,
  CollectionInquiryRow,
  DepositInquiryResult,
  VoucherDocument,
} from '@/core/models/collection'
import type { AssignmentBranch, AssignmentPairing, SaveAssignmentBody } from './assignment'
import type { AssignmentOptions } from './served-by'

/**
 * The two refusal codes the print routes branch on (245 §7), spelled once.
 *
 * 🚩 They are **envelope codes, not HTTP statuses** — `EndpointHelpers.ExecuteAsync`
 * answers a miss with `success: false` and one of these in `errors[0].errorCode`,
 * which `core/api` turns into a `business` `ApiError`. Branching on the status
 * instead would be branching on the transport.
 *
 * ⚠️ `AcrNotFound` is **reused** from the ACR family rather than given a document
 * twin: there is no second code for the same fact. `CollectionReceiptNotFound` is
 * the one new code the wave added, and it covers an unknown id *and* a lookup that
 * matched zero rows — indistinguishable over an inquiry, and the same sentence to
 * the reader either way.
 */
export const RECEIPT_NOT_FOUND = 'CollectionReceiptNotFound'
export const ACR_NOT_FOUND = 'AcrNotFound'

/**
 * The ONE cache key the four Collections nav leaves and all four screens' own
 * in-page guards share, so a gated area costs **one** network call and not one
 * per consumer. Exported rather than re-spelled at each site: a typo in a string
 * literal would not fail a build, it would silently split the cache entry and
 * let the nav and a screen disagree about whether the session is allowed in.
 */
export const COLLECTION_ACCESS_KEY = ['collection', 'access'] as const

/**
 * …and the ONE set of options every reader of that key passes.
 *
 * 🚩 The key alone was not enough once a second reader appeared (ticket 257's
 * `Collections ▸` gate, beside `ScreenGate`'s own): react-query merges the options
 * of concurrent observers, so a screen that quietly dropped `retry: false` would
 * make a **refused** probe retry under a gate whose whole ruling is to fail closed
 * on the first no. The options travel with the key, spelled once.
 *
 * `staleTime: Infinity` because a grant does not change inside a page life;
 * `retry: false` because a 403 is an answer and not an outage.
 */
export function collectionAccessQuery() {
  return {
    queryKey: COLLECTION_ACCESS_KEY,
    queryFn: () => collectionApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The ONE cache key and options the *Served by* picker and every screen that lands
 * on its `defaultScope` share (BackOffice 1163 for the picker, 1165 for the
 * landing), on `collectionAccessQuery`'s shape and for its reasons: react-query
 * merges concurrent observers' options, so the key and its options travel together
 * rather than being re-spelled per consumer.
 *
 * `staleTime: Infinity` because the roster does not change inside a page life;
 * `retry: false` because an unreachable sink is the same failure class the grid
 * beside it already shows on a read — the picker is simply empty and the screen
 * lands unscoped. No retry storm over a filter.
 */
export const ASSIGNMENT_OPTIONS_KEY = ['collection', 'assignment-options'] as const

export function assignmentOptionsQuery() {
  return {
    queryKey: ASSIGNMENT_OPTIONS_KEY,
    queryFn: () => collectionApi.assignmentOptions(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The probe's four predicates, one per screen (244 §10).
 *
 * `=== true` and nothing looser, so a malformed answer (`{}`, `null`, a string
 * `"true"`) is a denial and not an accident of truthiness. They are named
 * exports because they are this ticket's pure Proof, and because the nav leaf
 * and the screen guard must read the *same* predicate rather than two spellings
 * of it.
 *
 * 🚩 They are **independent**. A session granted only `DepositInquiry` sees one
 * item, not three that would bounce it — a ragged group is the correct answer,
 * and it is what makes the menu honest about what the server will actually
 * serve.
 */
type Access = CollectionAccessResult | null | undefined

export const canOpenCollections = (r: Access): boolean => r?.canOpenCollections === true
export const canOpenAcrs = (r: Access): boolean => r?.canOpenAcrs === true
export const canOpenDeposits = (r: Access): boolean => r?.canOpenDeposits === true
export const canOpenAttempts = (r: Access): boolean => r?.canOpenAttempts === true

/**
 * The fifth predicate (BackOffice 1169) — the Collection Assignment admin screen.
 *
 * 🚩 **Reads its OWN flag and nothing else.** Assigning branches is a different
 * privilege from reading collection lists: a session holding all four inquiry
 * grants must still not see this item, because the screen behind it rewrites the
 * master data those four grids filter by. `=== true` for the same reason as its
 * siblings, and because an older SIS.Api simply omits the field.
 */
export const canOpenAssignment = (r: Access): boolean => r?.canOpenAssignment === true

export const collectionApi = {
  /**
   * `GET CollectionWeb/Access` → the four booleans. Cookie-gated and
   * deliberately **not** grant-gated: it must be able to answer a session that
   * holds nothing.
   *
   * ⚠️ **Fails closed.** No 404-tolerant catch, unlike the `Notifications/Access`
   * and `Bby/Access` probes which degrade to *allowed* while their endpoints are
   * unbuilt. These four screens are the chain's cash, and 253 asks for exactly
   * this: an unknown or failed probe hides the group rather than offering a
   * screen the server will refuse. The shell already treats a pending or errored
   * probe as hidden, so failing closed is the *absence* of a catch rather than
   * code.
   */
  access(): Promise<CollectionAccessResult> {
    return api.get<CollectionAccessResult>('CollectionWeb/Access')
  },

  /**
   * `GET CollectionWeb/Collections` → the Cash Collections grid's rows (ticket
   * 254), grant-gated on `CollectionInquiry`.
   *
   * `params` arrives already built by the pure `buildCollectionsParams`, which
   * owns the PascalCase names `[AsParameters] CollectionInquiryOptions` binds and
   * the dropping of empty filters. This function deliberately adds nothing: a
   * second place that could decide what goes on the wire is a second place the
   * decision can drift.
   *
   * ⚠️ **The whole matched result, not a page.** `Limit` rides in `params` as a
   * system cap; the browser pages what comes back at 50 a time, which is what
   * keeps sort, per-column filter and 258's export operating over every matched
   * row (244 §3).
   */
  collections(params: Record<string, unknown>): Promise<CollectionInquiryRow[]> {
    return api.get<CollectionInquiryRow[]>('CollectionWeb/Collections', params)
  },

  /**
   * `GET CollectionWeb/AssignmentOptions` → the shared *Served by* picker's three
   * groups (BackOffice tracer 1163).
   *
   * ⚠️ **Cookie-gated and deliberately NOT grant-gated**, the same posture as
   * `Access` above — and for a structural reason rather than a lax one. ONE payload
   * fills the picker on all four screens, but the four screens hold four
   * *independent* grants: gating it on any one of them would leave a session holding
   * only `DepositInquiry` looking at an empty picker on the very screen it is
   * entitled to open. The rows behind the filter stay locked; every grid is still
   * its own grant's.
   *
   * 🚩 **Names come from the roster's own `DisplayName` and nowhere else.** None of
   * the 8 accountants exists in `Staff` / `UaEmployee` / `UaUser`, so there is no
   * master to resolve them against — which is also why this is one server-side read
   * rather than a join across two databases.
   *
   * 🚩 **The payload also carries `defaultScope`** — who the CALLER is on that
   * roster, and therefore the scope the screen opens on (BackOffice 1165). It is a
   * default selection for the control, never a filter this door applied: the screen
   * lands the picker on it and sends the ordinary pair, and `null` (no roster row)
   * means the screen opens on the estate exactly as it did before.
   */
  assignmentOptions(): Promise<AssignmentOptions> {
    return api.get<AssignmentOptions>('CollectionWeb/AssignmentOptions')
  },

  /**
   * `GET CollectionWeb/Assignment/Branches` → the Collection Assignment screen's
   * rows (BackOffice 1169), grant-gated on `CollectionAssignment` — its own grant,
   * never an inquiry's.
   *
   * 🔑 **Every open branch, not the assigned ones.** `Store LEFT JOIN
   * PosCollectionAssignment`: ~1394 rows of which ~1255 carry a gap, because the
   * gap is the work. It takes no parameters at all — the screen filters, searches
   * and pages over the one payload client-side, and opens on **everything,
   * unfiltered**, which is deliberately not the default-to-mine the four inquiry
   * screens land on.
   *
   * ⚠️ **No name columns.** The two people are ids; their names come from the
   * roster `assignmentOptions()` already fetched — the same list the two dropdowns
   * are built from, so the screen has one name source instead of two that can
   * disagree.
   */
  assignmentBranches(): Promise<AssignmentBranch[]> {
    return api.get<AssignmentBranch[]>('CollectionWeb/Assignment/Branches')
  },

  /**
   * `POST CollectionWeb/Assignment/SetStore` → save ONE branch's pairing, and get
   * back the pairing the server now holds (⚠️ the two slots and the stamp — NOT a
   * branches-list row, whose name/city/area this call cannot move).
   *
   * 🔑 **The body carries no actor.** Attribution is stamped server-side from the
   * cookie session, so a browser cannot attribute a reassignment to somebody else
   * — the `CouponsAdminWebService` shape.
   *
   * 🚩 **Per-row, never a batch.** A batch holds state the server does not, and a
   * partial failure has to say which of forty rows landed; this says which branch
   * failed by being about one branch. A refusal (unknown branch, an id off the
   * roster, or one filed under the other Role) comes back as a `business`
   * `ApiError` and **stages nothing** — the branch is left exactly as it was, so
   * the screen can keep the row and its unsaved edit on screen and let the user
   * fix it.
   */
  saveAssignment(body: SaveAssignmentBody): Promise<AssignmentPairing> {
    return api.post<AssignmentPairing>('CollectionWeb/Assignment/SetStore', body)
  },

  /**
   * `GET CollectionWeb/Acrs` → the ACRs grid's rows (ticket 255), grant-gated on
   * `AcrInquiry`.
   *
   * `params` arrives already built by the pure `buildAcrsParams`, which owns the
   * PascalCase names, the dropping of empty filters, and the rule that a Status
   * of `All` sends nothing. This function deliberately adds nothing: a second
   * place that could decide what goes on the wire is a second place the decision
   * can drift.
   *
   * ⚠️ One of those params, `AcrNumber`, is a filter `AcrInquiryOptions` does not
   * have yet — logged as a BackOffice 1090 dependency in `.afk/HITL-255.md`
   * rather than worked around client-side.
   */
  acrs(params: Record<string, unknown>): Promise<AcrInquiryRow[]> {
    return api.get<AcrInquiryRow[]>('CollectionWeb/Acrs', params)
  },

  /**
   * `GET CollectionWeb/Deposits` → the Deposits screen's **whole** payload
   * (ticket 256), grant-gated on `DepositInquiry`.
   *
   * 🚩 **Not a bare list.** `{ rows, balances }`, each row carrying its own
   * `lines` and `attachments` — so the grid, the stacked detail region and the
   * per-collector balances panel all come out of **one** request. There is
   * deliberately no second call for the detail: a deposit whose banked total no
   * longer matches its claimed ACRs is what the accountant opens this screen to
   * find, and drift behind a fetch is drift taken on faith.
   *
   * ⚠️ **The hardest door of the four.** `Deposit/Inquiry` rides
   * `CollectorEndpointFilter`, which demands an api-key *plus* a `Mobile`-channel
   * Bearer session and explicitly rejects a browser-minted token — it has no
   * cookie branch to mark, so this needs a genuinely new door rather than an
   * `.AllowCookieSession()` marker (BackOffice 1090).
   *
   * `params` arrives already built by the pure `buildDepositsParams`, which owns
   * the PascalCase names, the dropping of empty filters, and the rule that a
   * Status of `All` sends nothing. This function deliberately adds nothing: a
   * second place that could decide what goes on the wire is a second place the
   * decision can drift. ⚠️ One of those params, `DepositNumber`, is a filter
   * `DepositInquiryOptions` does not have yet — logged as a BackOffice 1090
   * dependency in `.afk/HITL-256.md` rather than worked around client-side.
   */
  deposits(params: Record<string, unknown>): Promise<DepositInquiryResult> {
    return api.get<DepositInquiryResult>('CollectionWeb/Deposits', params)
  },

  /**
   * `GET CollectionWeb/Attempts` → the Collection Attempts grid's rows (ticket
   * 255), grant-gated on `CollectionAttempts`.
   *
   * The one read in this file that owes the backend nothing: every filter it
   * sends already exists on `CollectionAttemptInquiryOptions`.
   */
  attempts(params: Record<string, unknown>): Promise<CollectionAttemptRow[]> {
    return api.get<CollectionAttemptRow[]>('CollectionWeb/Attempts', params)
  },

  /**
   * `GET CollectionWeb/Receipt/{collectionReceiptId}` → the print-ready سند قبض,
   * `{ pages }`, one page per collected shift (ticket 259).
   *
   * Behind the **Cash Collections** grant, not a grant of its own: the document is
   * that screen's row action, so a session that may not open the grid may not print
   * its receipts either.
   *
   * 🚩 **The whole page set in one call, and the order is the server's** — the
   * shift's `OpenedAt` ascending. That is not a detail: fetching the pages together
   * is what puts the `-1` / `-2` suffix back on a multi-shift receipt, whose
   * `noText` the WPF historically DUPLICATED across pages.
   *
   * The id is a ULID and rides as a **path segment**, `encodeURIComponent`'d like
   * the `LoyWeb/Member/{loyId}` precedent — a hand-typed id reaches here as
   * whatever the user pasted into the URL bar, and it must not be able to shift the
   * path it lands on.
   */
  receipt(collectionReceiptId: string): Promise<VoucherDocument> {
    return api.get<VoucherDocument>(
      `CollectionWeb/Receipt/${encodeURIComponent(collectionReceiptId)}`,
    )
  },

  /**
   * `GET CollectionWeb/AcrForm/{acrId}` → the print-ready ACR,
   * `{ form, rowsPerPage, pages }` (ticket 259). Behind the **ACRs** grant, on the
   * same reasoning as the receipt.
   *
   * ⚠️ **Empty is not a miss.** An ACR with no linked collections answers 200 with
   * ONE page and `rows: []` — `Paginate`'s own behaviour, and a real document that
   * prints with totals `0.00` and its summary present. Only an unknown id refuses,
   * with `AcrNotFound`. Reading the empty case as a refusal would turn an idle ACR
   * into an error screen, which is why the print route branches on the CODE and
   * never on the row count.
   *
   * 🚩 `form` is **hoisted out of the pages** rather than repeated on each: every
   * page references one form carrying the whole row list, so a naive page list
   * would ship the rows once per page.
   */
  acrForm(acrId: string): Promise<AcrDocument> {
    return api.get<AcrDocument>(`CollectionWeb/AcrForm/${encodeURIComponent(acrId)}`)
  },
}
