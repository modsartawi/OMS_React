/**
 * The Collections feature's server calls (spec 249).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular
 * is never caught here.
 *
 * ⚠️ **The door does not exist yet.** `CollectionWeb/*` is a BackOffice
 * dependency built on a parallel track (1090: one file, one tag, four grant
 * gates). Until it lands, every route here answers a browser **403** — issue
 * 802 inverted `ApiKeyEndpointFilter`'s cookie branch to default-deny — so this
 * feature is verified against envelopes stubbed at Playwright
 * (`tools/collection-drive.mjs`), the same code-complete / runtime-blocked
 * posture the Nphies and Loy waves shipped under. 🚩 Nothing here has been driven
 * against a live SIS.Api; ticket 259 is that event.
 *
 * The four inquiry reads and the two document reads join this file with their
 * own slices (254–257).
 */
import { api } from '@/core/api'
import type {
  AcrInquiryRow,
  CollectionAccessResult,
  CollectionAttemptRow,
  CollectionInquiryRow,
  DepositInquiryResult,
} from '@/core/models/collection'

/**
 * The ONE cache key the four Collections nav leaves and all four screens' own
 * in-page guards share, so a gated area costs **one** network call and not one
 * per consumer. Exported rather than re-spelled at each site: a typo in a string
 * literal would not fail a build, it would silently split the cache entry and
 * let the nav and a screen disagree about whether the session is allowed in.
 */
export const COLLECTION_ACCESS_KEY = ['collection', 'access'] as const

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
}
