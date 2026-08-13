/**
 * The Settlement Account feature's server calls (spec 267).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular is
 * never caught here.
 *
 * 268 landed the surface — the screen's reading of its grant. **269 adds the first
 * door that reads the ledger: one branch's account.** The fleet, post, cancel,
 * close-out, repair and the two bulk doors (spec 267 D8) arrive with 270–273; the
 * joining ticket 274 settles every route string against a live SIS.Api.
 *
 * ⚠️ **There is no `Settlement/Access` probe and there must not be one.** The
 * settlement account is a **fifth grant on the Collections probe** (spec 267 D1),
 * not an area of its own — same nav group, same `/collection/*` prefix, same one
 * `CollectionWeb/Access` call. The key, the options and the call live in
 * `@/core/collection/api`, where ticket 268 graduated them the moment this feature
 * became their second consumer: a feature may not import another feature's api
 * (`.claude/rules/feature-structure.md`).
 */
import { api } from '@/core/api'
import type { CollectionAccessResult } from '@/core/models/collection'
import type {
  SettlementAccount,
  SettlementFleetRow,
  SettlementLedgerRow,
  SettlementRepairResult,
  SettlementWorklistResult,
} from '@/core/models/settlement'
import { ACCOUNT_LIMIT, LEDGER_LIMIT } from './cap'
import type { LedgerCriteria } from './ledger'
import { buildLedgerParams } from './ledger'

/**
 * The settlement account's predicate — this screen's own reading of the fifth flag.
 *
 * `=== true` and nothing looser, so a malformed answer (`{}`, `null`, a string
 * `"true"`) is a denial and not an accident of truthiness. That strictness is doing
 * real work today rather than guarding a hypothetical: the server does not answer
 * `canOpenSettlement` yet (BackOffice spec 1173), so every live probe currently
 * arrives with the field **absent** — and absent must read as no.
 *
 * Exported because the nav leaf and the screen's own gate must read the SAME
 * predicate rather than two spellings of it, which is what stops the menu and the
 * screen disagreeing about whether the session is allowed in.
 */
export const canOpenSettlement = (r: CollectionAccessResult | null | undefined): boolean =>
  r?.canOpenSettlement === true

export const settlementApi = {
  /**
   * `GET Settlement/Account?storeId=…` → one branch's whole position: every entry,
   * open and closed, and the flat array of consumptions behind them (spec 267 D8).
   *
   * 🚩 **One call, two arrays, no second round trip per entry.** The journal
   * drilldown is a re-render and never a request — the same shape `CollectionWeb/
   * Deposits` uses for its lines and slips (256), and for the same reason: an
   * accountant on a phone call opening four entries in a row must not be paying four
   * latencies to answer *"was my 500 used?"*.
   *
   * ⚠️ `Limit` is the cap the banner is measured against (`cap.ts`), asked for
   * rather than assumed — the door applies a 500-row `TOP` (D3) and a client that
   * did not name it would be inferring a number the server chose.
   *
   * ⚠️ The route string and the param casing are **274's to confirm** against a live
   * SIS.Api; D8 says as much in as many words. Until then 269's screens are driven
   * against `settlement-fixture.ts` served over this same door
   * (`tools/settlement-drive.mjs`), which is what makes 274 a joining event rather
   * than a rewiring.
   *
   * 401 is not caught here and must not be — `@/core/api` owns it
   * (`.claude/rules/api-envelope.md`).
   */
  account(storeId: string): Promise<SettlementAccount> {
    return api.get<SettlementAccount>('Settlement/Account', { storeId, limit: ACCOUNT_LIMIT })
  },

  /**
   * `GET Settlement/Fleet?scope=all` → one aggregated row per store (spec 267 D8).
   *
   * 🔑 **`scope=all`, always — and that is not the scope control being ignored.**
   * The control's three states are honoured in `scope.ts`, over the answer, for a
   * reason D2 makes load-bearing: *wrong money and cash waiting are always
   * estate-wide whatever the scope says*, and the search must **rank** rather than
   * refuse. A client that re-fetched per scope would either have to issue two
   * calls per change (one scoped, one estate-wide) or quietly lose the 1255
   * unassigned branches from the lanes — which is the exact failure the carve-out
   * exists to prevent.
   *
   * The parameter is still sent rather than omitted, because it is the contract's
   * and `all` is a real value on it. ⚠️ 274 confirms the string; if the door turns
   * out to want the scoping done server-side, the change is one call becoming two,
   * with the estate-wide one still feeding the lanes.
   *
   * The estate is 1394 rows of eleven scalars — a single answer a browser sorts,
   * filters and ranks without noticing. 🚩 **Nothing caches or denormalises it**
   * (the ticket's own boundary): it is a query per page life, and the per-store
   * balance table this design refused twice stays refused.
   */
  fleet(): Promise<SettlementFleetRow[]> {
    return api.get<SettlementFleetRow[]>('Settlement/Fleet', { scope: 'all' })
  },

  /**
   * `GET Settlement/Worklist` → the two enumerated lanes (a 270 extension of D8,
   * logged in `.afk/HITL-270.md`).
   *
   * 🔑 **It takes no parameters, and the absence is the design.** D8's `FleetRow`
   * can say a branch *has* an orphan; it cannot say which consumption, for how
   * much, or how old — and `Settlement/Repair` is keyed by a
   * `settlementConsumptionId`. A lane that could only point at a branch would send
   * the accountant hunting through an account for the row.
   *
   * A door with no scope to pass cannot be narrowed by accident, which is the
   * carve-out (D2) enforced by shape rather than by a comment.
   */
  worklist(): Promise<SettlementWorklistResult> {
    return api.get<SettlementWorklistResult>('Settlement/Worklist')
  },

  /**
   * `GET Settlement/Ledger` → the flat cross-estate ledger (a 270 extension of
   * D8, logged).
   *
   * **Filter-first and capped**, like the four inquiries: the criteria the reader
   * typed go on the wire, `LEDGER_LIMIT` bounds the answer, and the banner fires
   * when it bites. ⚠️ It is explicitly **not the account** — it can only assert a
   * total nobody owes and nobody consumes (D2), so its figures render as report
   * figures and the position stays on 269's account.
   *
   * It is also how an **entry number** is resolved to a branch: *"entry 143,
   * whichever branch it is on"* is this door with one criterion.
   */
  ledger(criteria: LedgerCriteria): Promise<SettlementLedgerRow[]> {
    return api.get<SettlementLedgerRow[]>('Settlement/Ledger', {
      ...buildLedgerParams(criteria),
      limit: LEDGER_LIMIT,
    })
  },

  /**
   * `POST Settlement/Repair` → puts an orphan consumption's money back on its
   * entry. **The only write on this screen** (the ticket's own boundary — posting
   * is 271's, correction 272's).
   *
   * 🔑 **A no-op is a 200, not a failure.** The server's guard is inside its
   * UPDATE and is predicated on the consumption still having no document, so a
   * late Z arriving mid-click means there was never anything to repair. That comes
   * back as `noOp: true` and the screen says so plainly. Likewise a refusal is
   * `accepted: false` with a reason — nothing here throws on a business outcome,
   * and `@/core/api` owns the ones that are genuinely errors.
   */
  repair(settlementConsumptionId: string, reason: string): Promise<SettlementRepairResult> {
    return api.post<SettlementRepairResult>('Settlement/Repair', {
      settlementConsumptionId,
      reason,
    })
  },
}
